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

// Step 1: Download
async function downloadZip(
  downloadUrl: string,
  onProgress: ProgressCallback
): Promise<string> {
  onProgress({ step: 1, status: 'downloading' });

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

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0) throw new Error('Downloaded file is empty');
  if (buffer.length > MAX_ZIP_SIZE) throw new Error('Downloaded file exceeds size limit');

  writeFileSync(zipPath, buffer);
  onProgress({ step: 1, status: 'downloading', progress: 100 });
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

        // Path traversal check
        if (entry.fileName.includes('..')) {
          throw new Error('Zip contains path traversal entries (..) — rejected');
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

// Step 3: Backup
function backupCriticalFiles(onProgress: ProgressCallback): string {
  onProgress({ step: 3, status: 'backing_up' });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(UPDATE_BACKUP_DIR, `backup-${timestamp}`);
  ensureDir(backupDir);

  // Backup package.json
  const pkgSrc = join(APP_ROOT, 'package.json');
  if (existsSync(pkgSrc)) {
    copyFileSync(pkgSrc, join(backupDir, 'package.json'));
  }

  // Backup token.ts
  const tokenSrc = join(APP_ROOT, 'src', 'lib', 'update', 'token.ts');
  if (existsSync(tokenSrc)) {
    ensureDir(join(backupDir, 'src', 'lib', 'update'));
    copyFileSync(tokenSrc, join(backupDir, 'src', 'lib', 'update', 'token.ts'));
  }

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

function rollbackFromBackup(backupDir: string): void {
  const rollbackLogPath = join(STORAGE_DIR, 'update-rollback.log');
  const logLine = (msg: string) => {
    const timestamp = new Date().toISOString();
    try {
      appendFileSync(rollbackLogPath, `[${timestamp}] ${msg}\n`);
    } catch { /* can't even log — truly best effort */ }
  };

  logLine(`Rollback started from: ${backupDir}`);

  try {
    const pkgBackup = join(backupDir, 'package.json');
    if (existsSync(pkgBackup)) {
      copyFileSync(pkgBackup, join(APP_ROOT, 'package.json'));
      logLine('Restored package.json');
    }

    const tokenBackup = join(backupDir, 'src', 'lib', 'update', 'token.ts');
    const tokenDest = join(APP_ROOT, 'src', 'lib', 'update', 'token.ts');
    if (existsSync(tokenBackup)) {
      copyFileSync(tokenBackup, tokenDest);
      logLine('Restored token.ts');
    }

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

    logLine('Rollback completed');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logLine(`CRITICAL: Rollback failed: ${msg}. System may be in an inconsistent state.`);
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

    // Step 5
    const newVersion = rebuildAndVerify(backupDir, onProgress);

    cleanupTemp();
    updateLog(`=== Update completed successfully: v${newVersion} ===`);

    // Detect if running in production mode
    const isDev = process.env.NODE_ENV === 'development';

    onProgress({
      step: 5,
      status: 'done',
      done: true,
      success: true,
      newVersion,
      requiresRestart: !isDev,
    });
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
