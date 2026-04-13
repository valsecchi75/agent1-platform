/**
 * 5-step update engine with security validation and auto-rollback.
 *
 * Steps:
 * 1. Download zip from GitHub Releases
 * 2. Validate + extract (path traversal, zip bomb checks)
 * 3. Backup critical files
 * 4. Selective file replacement (whitelist only)
 * 5. npm install + verify + rollback on failure
 */

import { mkdirSync, existsSync, readFileSync, writeFileSync, readdirSync,
         statSync, rmSync, copyFileSync, cpSync, appendFileSync, unlinkSync } from 'fs';
import { join, resolve, dirname, relative, normalize } from 'path';
import { execSync } from 'child_process';
import extractZip from 'extract-zip';
import { decodeToken } from './token';
import { parseWhitelist, shouldInclude } from './whitelist';

// Files that must NEVER be overwritten by an update, regardless of whitelist.
// Protects secrets and user-specific config from being stomped by a release ZIP.
const NEVER_OVERWRITE: string[] = [
  'release/Token.txt',  // plaintext GitHub PAT — must never ship or be applied
  '.env',               // user secrets
];

function isNeverOverwrite(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  const basename = normalized.split('/').pop()?.toLowerCase() ?? '';
  if (NEVER_OVERWRITE.some(n => normalized === n || normalized.endsWith('/' + n))) return true;
  if (basename === 'token.txt') return true;
  if (basename === '.env') return true;
  return false;
}

// Use same STORAGE_DIR pattern as fileNaming.ts
const STORAGE_DIR = resolve(process.cwd(), 'storage');
const UPDATE_TEMP_DIR = join(STORAGE_DIR, '.update-temp');
const UPDATE_BACKUP_DIR = join(STORAGE_DIR, '.update-backup');
const UPDATE_LOG_PATH = join(STORAGE_DIR, 'update.log');
const APP_ROOT = process.cwd();

interface ReleaseManifest {
  version: string;
  previousVersion: string;
  type: 'full' | 'delta';
  files: string[];
  deleted: string[];
  timestamp: string;
  checksum?: string;
}

const MAX_ZIP_SIZE = 500 * 1024 * 1024;     // 500MB
const MAX_FILE_COUNT = 5000;
const MAX_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;
const NPM_INSTALL_TIMEOUT = 5 * 60 * 1000;  // 5 minutes

export interface UpdateProgress {
  step: number;
  status: string;
  progress?: number;
  done?: boolean;
  success?: boolean;
  newVersion?: string;
  error?: string;
  rolledBack?: boolean;
  requiresRestart?: boolean;
}

export type ProgressCallback = (progress: UpdateProgress) => void;

let isUpdating = false;

export function getIsUpdating(): boolean {
  return isUpdating;
}

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function cleanupTemp(): void {
  try {
    if (existsSync(UPDATE_TEMP_DIR)) {
      rmSync(UPDATE_TEMP_DIR, { recursive: true, force: true });
    }
  } catch { /* best effort */ }
}

function pruneBackups(maxKeep: number): void {
  try {
    if (!existsSync(UPDATE_BACKUP_DIR)) return;
    const entries = readdirSync(UPDATE_BACKUP_DIR)
      .filter(e => e.startsWith('backup-'))
      .sort()
      .reverse();
    for (let i = maxKeep; i < entries.length; i++) {
      rmSync(join(UPDATE_BACKUP_DIR, entries[i]), { recursive: true, force: true });
    }
  } catch { /* best effort */ }
}

function updateLog(msg: string): void {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  try {
    ensureDir(STORAGE_DIR);
    appendFileSync(UPDATE_LOG_PATH, line);
  } catch { /* best effort */ }
}

function readManifest(extractedRoot: string): ReleaseManifest | null {
  const manifestPath = join(extractedRoot, 'manifest.json');
  if (!existsSync(manifestPath)) return null;
  try {
    const content = readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as ReleaseManifest;
    if (!manifest.version || !manifest.type) return null;
    return manifest;
  } catch {
    return null;
  }
}

// Step 2.5: Process delta deletions
function processDeletions(
  manifest: ReleaseManifest,
  whitelist: ReturnType<typeof parseWhitelist>,
  onProgress: ProgressCallback
): void {
  if (manifest.type !== 'delta' || !manifest.deleted || manifest.deleted.length === 0) return;

  updateLog(`Processing ${manifest.deleted.length} file deletions from delta manifest`);

  for (const filePath of manifest.deleted) {
    // Safety: only delete files within whitelist scope
    if (!shouldInclude(filePath, whitelist)) {
      updateLog(`SKIP delete (not in whitelist): ${filePath}`);
      continue;
    }

    // Safety: no path traversal
    const absPath = resolve(APP_ROOT, filePath);
    const relFromRoot = relative(APP_ROOT, absPath);
    if (relFromRoot.startsWith('..') || normalize(relFromRoot) !== normalize(filePath)) {
      updateLog(`SKIP delete (path traversal): ${filePath}`);
      continue;
    }

    // Safety: don't delete critical infrastructure
    const critical = ['package.json', 'node_modules', '.env', '.git'];
    if (critical.some(c => filePath === c || filePath.startsWith(c + '/'))) {
      updateLog(`SKIP delete (critical file): ${filePath}`);
      continue;
    }

    try {
      if (existsSync(absPath)) {
        const stat = statSync(absPath);
        if (stat.isDirectory()) {
          rmSync(absPath, { recursive: true, force: true });
        } else {
          unlinkSync(absPath);
        }
        updateLog(`Deleted: ${filePath}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateLog(`WARN: failed to delete ${filePath}: ${msg}`);
    }
  }
}

// Allowed download hosts — blocks arbitrary URL injection from authenticated users.
const ALLOWED_DOWNLOAD_HOSTS = ['api.github.com', 'github.com', 'objects.githubusercontent.com'];

export function isAllowedDownloadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOWNLOAD_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

// Step 1: Download with streaming progress
async function downloadZip(
  downloadUrl: string,
  onProgress: ProgressCallback
): Promise<string> {
  onProgress({ step: 1, status: 'downloading', progress: 0 });

  // Validate URL against allowed hosts
  if (!isAllowedDownloadUrl(downloadUrl)) {
    throw new Error('Download URL non autorizzato: solo GitHub è consentito');
  }

  ensureDir(UPDATE_TEMP_DIR);
  const zipPath = join(UPDATE_TEMP_DIR, 'agent1-update.zip');

  const token = decodeToken();
  if (!token) throw new Error('Update token not available');

  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/octet-stream',
      'User-Agent': 'AGENT1-UpdateEngine',
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_ZIP_SIZE) {
    throw new Error(`Zip too large (${contentLength} bytes, max ${MAX_ZIP_SIZE})`);
  }

  // Stream download with incremental progress instead of buffering all at once
  const chunks: Buffer[] = [];
  let received = 0;

  if (response.body) {
    const reader = (response.body as unknown as ReadableStream<Uint8Array>).getReader();
    let lastProgressPct = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(Buffer.from(value));
      received += value.length;

      if (received > MAX_ZIP_SIZE) {
        throw new Error('Downloaded file exceeds size limit');
      }

      // Send progress every 5% to avoid flooding SSE
      if (contentLength > 0) {
        const pct = Math.floor((received / contentLength) * 100);
        if (pct >= lastProgressPct + 5 || pct === 100) {
          onProgress({ step: 1, status: 'downloading', progress: pct });
          lastProgressPct = pct;
        }
      }
    }
  } else {
    // Fallback: no streaming body available
    const buffer = Buffer.from(await response.arrayBuffer());
    chunks.push(buffer);
    received = buffer.length;
  }

  if (received === 0) throw new Error('Downloaded file is empty');

  const finalBuffer = Buffer.concat(chunks);
  writeFileSync(zipPath, finalBuffer);
  onProgress({ step: 1, status: 'downloading', progress: 100 });
  updateLog(`Downloaded ${(received / 1024 / 1024).toFixed(1)} MB`);
  return zipPath;
}

// Step 2: Validate + Extract (using extract-zip for cross-platform support)
async function validateAndExtract(
  zipPath: string,
  onProgress: ProgressCallback
): Promise<string> {
  onProgress({ step: 2, status: 'extracting' });

  const extractDir = join(UPDATE_TEMP_DIR, 'extracted');
  ensureDir(extractDir);

  let fileCount = 0;
  let totalSize = 0;

  try {
    await extractZip(zipPath, {
      dir: extractDir,
      onEntry: (entry) => {
        fileCount++;
        totalSize += entry.uncompressedSize || 0;

        // Path traversal check — look for actual traversal patterns (../ or ..\)
        // not just ".." which can appear in legitimate filenames
        const fn = entry.fileName.replace(/\\/g, '/');
        if (fn.includes('../') || fn.startsWith('..') || fn.split('/').some(seg => seg === '..')) {
          throw new Error(`Zip contains path traversal entry: ${entry.fileName}`);
        }

        // File count check
        if (fileCount > MAX_FILE_COUNT) {
          throw new Error(`Zip contains too many files (>${MAX_FILE_COUNT})`);
        }

        // Uncompressed size check (zip bomb prevention)
        if (totalSize > MAX_UNCOMPRESSED_SIZE) {
          throw new Error(`Uncompressed size exceeds limit (${MAX_UNCOMPRESSED_SIZE} bytes)`);
        }
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('traversal') || msg.includes('too many') || msg.includes('exceeds limit')) throw err;
    throw new Error(`Extraction failed: ${msg}`);
  }

  // Find the actual root (zip may have a top-level folder)
  const entries = readdirSync(extractDir);
  let effectiveRoot = extractDir;
  if (entries.length === 1) {
    const candidate = join(extractDir, entries[0]);
    if (statSync(candidate).isDirectory()) {
      effectiveRoot = candidate;
    }
  }

  // Sanity check: must contain package.json
  if (!existsSync(join(effectiveRoot, 'package.json'))) {
    throw new Error('Extracted zip does not contain package.json — invalid release');
  }

  return effectiveRoot;
}

// Step 3: Full-snapshot backup of all whitelisted files.
// Ensures complete rollback capability — not just package.json + token.ts.
function backupCriticalFiles(onProgress: ProgressCallback): string {
  onProgress({ step: 3, status: 'backing_up' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(UPDATE_BACKUP_DIR, `backup-${timestamp}`);
  ensureDir(backupDir);

  // Read current whitelist to know exactly what will be replaced
  const localWhitelistPath = join(APP_ROOT, 'release', '.releaseinclude');
  let whitelistContent = '';
  if (existsSync(localWhitelistPath)) {
    whitelistContent = readFileSync(localWhitelistPath, 'utf-8');
  }
  const whitelist = parseWhitelist(whitelistContent);

  let backedUpCount = 0;
  const totalEntries = whitelist.length;

  // Backup each whitelisted entry that exists on disk
  for (let i = 0; i < whitelist.length; i++) {
    const entry = whitelist[i];
    const srcPath = join(APP_ROOT, entry.path);
    if (!existsSync(srcPath)) continue;

    const destPath = join(backupDir, entry.path);
    try {
      if (entry.isDirectory) {
        cpSync(srcPath, destPath, { recursive: true });
      } else {
        ensureDir(dirname(destPath));
        copyFileSync(srcPath, destPath);
      }
      backedUpCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateLog(`WARN: backup failed for ${entry.path}: ${msg}`);
    }

    // Send periodic progress to keep SSE alive during long backups
    if (i % 3 === 0 || i === totalEntries - 1) {
      onProgress({ step: 3, status: 'backing_up', progress: Math.floor(((i + 1) / totalEntries) * 100) });
    }
  }

  updateLog(`Full snapshot backup created: ${backupDir} (${backedUpCount} entries)`);
  pruneBackups(3);
  return backupDir;
}

// Step 4: Selective replace (manifest-aware)
function replaceFiles(
  extractedRoot: string,
  manifest: ReleaseManifest | null,
  onProgress: ProgressCallback
): void {
  onProgress({ step: 4, status: 'replacing_files' });

  // Read whitelist from the NEW version (extracted zip) or current app
  const whitelistPath = join(extractedRoot, 'release', '.releaseinclude');
  const localWhitelistPath = join(APP_ROOT, 'release', '.releaseinclude');
  let whitelistContent: string;
  if (existsSync(whitelistPath)) {
    whitelistContent = readFileSync(whitelistPath, 'utf-8');
  } else if (existsSync(localWhitelistPath)) {
    whitelistContent = readFileSync(localWhitelistPath, 'utf-8');
  } else {
    // Fallback: use hardcoded default whitelist
    whitelistContent = [
      'src/', 'public/',
      'custom_nodes/agent1-foundation/',
      'custom_nodes/agent1_neural_atelier/',
      'custom_nodes/morpheus-model-management/',
      'package.json', 'package-lock.json',
      'next.config.ts', 'tsconfig.json',
      'tailwind.config.ts', 'postcss.config.mjs',
      'components.json', 'server.js',
      'start.bat', 'start.sh', 'release/',
    ].join('\n');
  }

  const whitelist = parseWhitelist(whitelistContent);

  // Process deletions from delta manifest BEFORE replacing files
  if (manifest) {
    processDeletions(manifest, whitelist, onProgress);
    updateLog(`Update type: ${manifest.type}, version: ${manifest.version}, files in zip: ${manifest.files.length}`);
  }

  if (manifest && manifest.type === 'delta') {
    // Delta mode: only replace files that exist in the ZIP
    // Walk the extracted directory and copy each file individually
    const copyRecursive = (srcDir: string, relBase: string) => {
      const entries = readdirSync(srcDir);
      for (const entry of entries) {
        if (entry === 'manifest.json' && relBase === '') continue; // Skip manifest itself
        const srcPath = join(srcDir, entry);
        const relPath = relBase ? `${relBase}/${entry}` : entry;
        const destPath = join(APP_ROOT, relPath);
        const stat = statSync(srcPath);

        if (stat.isDirectory()) {
          copyRecursive(srcPath, relPath);
        } else {
          // Only copy if in whitelist and not a protected file
          if (shouldInclude(relPath, whitelist) && !isNeverOverwrite(relPath)) {
            ensureDir(dirname(destPath));
            copyFileSync(srcPath, destPath);
            updateLog(`Updated: ${relPath}`);
          } else if (isNeverOverwrite(relPath)) {
            updateLog(`Skipped (protected): ${relPath}`);
          }
        }
      }
    };
    copyRecursive(extractedRoot, '');
  } else {
    // Full mode: replace entire whitelisted directories/files
    for (const entry of whitelist) {
      const srcPath = join(extractedRoot, entry.path);
      const destPath = join(APP_ROOT, entry.path);

      if (!existsSync(srcPath)) continue; // Skip if not in zip
      if (isNeverOverwrite(entry.path)) {
        updateLog(`Skipped (protected): ${entry.path}`);
        continue;
      }

      if (entry.isDirectory) {
        // Remove old directory, copy new
        if (existsSync(destPath)) {
          rmSync(destPath, { recursive: true, force: true });
        }
        cpSync(srcPath, destPath, { recursive: true });
      } else {
        // Overwrite single file
        ensureDir(dirname(destPath));
        copyFileSync(srcPath, destPath);
      }
    }
  }
}

// Step 5: Rebuild + Verify
function rebuildAndVerify(
  backupDir: string,
  onProgress: ProgressCallback
): string {
  onProgress({ step: 5, status: 'installing_dependencies' });

  try {
    execSync('npm install', {
      cwd: APP_ROOT,
      timeout: NPM_INSTALL_TIMEOUT,
      stdio: 'pipe',
    });
  } catch (err) {
    // npm install failed — attempt rollback
    onProgress({ step: 5, status: 'rolling_back' });
    rollbackFromBackup(backupDir);
    throw new Error('npm install failed — rolled back to previous version');
  }

  // Clean stale .next cache and rebuild.
  // Critical: the dev server (Turbopack) watches files and tries to hot-reload
  // during the file copy phase, causing race conditions where imports resolve
  // before their target modules have been written. A clean build after all files
  // are in place eliminates this class of errors.
  onProgress({ step: 5, status: 'rebuilding' });
  updateLog('Cleaning .next cache and rebuilding...');

  try {
    const nextDir = join(APP_ROOT, '.next');
    if (existsSync(nextDir)) {
      rmSync(nextDir, { recursive: true, force: true });
      updateLog('.next cache cleared');
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    updateLog(`WARN: could not clear .next cache: ${msg}`);
    // Non-fatal — continue with build anyway
  }

  try {
    execSync('npm run build', {
      cwd: APP_ROOT,
      timeout: NPM_INSTALL_TIMEOUT, // 5 minutes should be enough for build
      stdio: 'pipe',
    });
    updateLog('Build completed successfully');
  } catch (err) {
    // Build failed — attempt rollback
    const msg = err instanceof Error ? err.message : String(err);
    updateLog(`Build failed: ${msg}`);
    onProgress({ step: 5, status: 'rolling_back' });
    rollbackFromBackup(backupDir);
    throw new Error('Build failed after update — rolled back to previous version');
  }

  onProgress({ step: 5, status: 'verifying' });

  // Verify critical files
  try {
    const pkgPath = join(APP_ROOT, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    if (!pkg.dependencies) throw new Error('package.json missing dependencies');
    if (!pkg.version) throw new Error('package.json missing version');

    if (!existsSync(join(APP_ROOT, 'next.config.ts'))) {
      throw new Error('next.config.ts missing after update');
    }

    const srcEntries = readdirSync(join(APP_ROOT, 'src'));
    if (srcEntries.length === 0) throw new Error('src/ directory is empty after update');

    return pkg.version;
  } catch (err) {
    // Verification failed — rollback
    onProgress({ step: 5, status: 'rolling_back' });
    rollbackFromBackup(backupDir);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Verification failed: ${msg} — rolled back`);
  }
}

// Full-snapshot rollback: restores ALL backed-up files, not just package.json.
// Also removes .update-pending marker to prevent infinite build-retry loops.
function rollbackFromBackup(backupDir: string): void {
  const rollbackLogPath = join(STORAGE_DIR, 'update-rollback.log');
  const logLine = (msg: string) => {
    const timestamp = new Date().toISOString();
    try {
      appendFileSync(rollbackLogPath, `[${timestamp}] ${msg}\n`);
    } catch { /* can't even log — truly best effort */ }
  };

  logLine(`Full-snapshot rollback started from: ${backupDir}`);

  try {
    // Walk the backup directory and restore everything
    const restoreRecursive = (srcDir: string, relBase: string) => {
      const entries = readdirSync(srcDir);
      for (const entry of entries) {
        const srcPath = join(srcDir, entry);
        const relPath = relBase ? `${relBase}/${entry}` : entry;
        const destPath = join(APP_ROOT, relPath);
        const stat = statSync(srcPath);

        if (stat.isDirectory()) {
          // Replace the (possibly corrupted) new directory with backup
          if (existsSync(destPath)) {
            rmSync(destPath, { recursive: true, force: true });
          }
          cpSync(srcPath, destPath, { recursive: true });
          logLine(`Restored directory: ${relPath}`);
        } else {
          ensureDir(dirname(destPath));
          copyFileSync(srcPath, destPath);
        }
      }
    };

    restoreRecursive(backupDir, '');

    // Re-run npm install with restored package.json
    try {
      execSync('npm install', {
        cwd: APP_ROOT,
        timeout: NPM_INSTALL_TIMEOUT,
        stdio: 'pipe',
      });
      logLine('npm install succeeded after rollback');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logLine(`WARNING: npm install failed during rollback: ${msg}`);
    }

    // Remove .update-pending marker to prevent build-retry loop on restart
    try {
      const markerPath = join(APP_ROOT, '.update-pending');
      if (existsSync(markerPath)) {
        unlinkSync(markerPath);
        logLine('Removed .update-pending marker');
      }
    } catch { /* best effort */ }

    logLine('Full-snapshot rollback completed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(`CRITICAL: Rollback failed: ${msg}. Manual recovery may be needed.`);
    // Still try to remove marker even if rollback fails
    try {
      const markerPath = join(APP_ROOT, '.update-pending');
      if (existsSync(markerPath)) unlinkSync(markerPath);
    } catch { /* last resort */ }
  }
}

// Main entry point
export async function applyUpdate(
  downloadUrl: string,
  onProgress: ProgressCallback
): Promise<void> {
  if (isUpdating) throw new Error('Update already in progress');
  isUpdating = true;

  try {
    cleanupTemp();
    updateLog('=== Update started ===');

    // Step 1
    const zipPath = await downloadZip(downloadUrl, onProgress);

    // Step 2
    const extractedRoot = await validateAndExtract(zipPath, onProgress);

    // Step 2.5 — Read manifest
    const manifest = readManifest(extractedRoot);
    if (manifest) {
      updateLog(`Manifest found: type=${manifest.type}, version=${manifest.version}, previousVersion=${manifest.previousVersion}`);
      updateLog(`Files: ${manifest.files.length}, Deleted: ${manifest.deleted.length}`);
    } else {
      updateLog('No manifest.json found — treating as full update (legacy ZIP)');
    }

    // Step 3
    const backupDir = backupCriticalFiles(onProgress);

    // Step 4 (manifest-aware)
    replaceFiles(extractedRoot, manifest, onProgress);

    // Write update marker IMMEDIATELY after file copy, before build.
    // The NEW server.js (just copied by replaceFiles) will detect this marker
    // on next process start and run `npm run build` — solving the bootstrap
    // problem where the OLD update engine (pre-build-step) doesn't build.
    const markerVersion = manifest?.version || 'unknown';
    try {
      const markerPath = join(APP_ROOT, '.update-pending');
      writeFileSync(markerPath, JSON.stringify({
        version: markerVersion,
        timestamp: new Date().toISOString(),
      }));
      updateLog(`Update marker written for v${markerVersion}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      updateLog(`WARN: could not write update marker: ${msg}`);
    }

    // Step 5
    const newVersion = rebuildAndVerify(backupDir, onProgress);

    // Build succeeded — remove update marker (server.js won't re-build on restart)
    try {
      const markerPath = join(APP_ROOT, '.update-pending');
      if (existsSync(markerPath)) unlinkSync(markerPath);
    } catch { /* best effort */ }

    cleanupTemp();
    updateLog(`=== Update completed successfully: v${newVersion} ===`);

    // Always require restart — server-side code (API routes, update engine itself,
    // node registry, etc.) only picks up changes after a process restart.
    // Dev-mode HMR only hot-reloads client components, not server modules.
    onProgress({
      step: 5,
      status: 'done',
      done: true,
      success: true,
      newVersion,
      requiresRestart: true,
    });

    // Auto-restart: schedule process exit after SSE response is flushed.
    // The supervisor (server.js) will detect exit code 0 and re-fork the worker,
    // picking up all new server-side code from disk.
    updateLog('Scheduling automatic restart in 2 seconds...');
    setTimeout(() => {
      updateLog('Restarting process...');
      process.exit(0);
    }, 2000);
  } catch (err) {
    cleanupTemp();
    const msg = err instanceof Error ? err.message : String(err);
    const rolledBack = msg.includes('rolled back');
    onProgress({
      step: 0,
      status: 'error',
      done: true,
      success: false,
      error: msg,
      rolledBack,
    });
  } finally {
    isUpdating = false;
  }
}
