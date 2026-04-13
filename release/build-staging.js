#!/usr/bin/env node
/**
 * build-staging.js — Creates the .release-staging directory for publish.bat
 *
 * Usage:
 *   node release/build-staging.js <RELEASE_TYPE> <NEW_VERSION> <PREVIOUS_VERSION> [LAST_TAG]
 *
 * Arguments:
 *   RELEASE_TYPE   "full" or "delta"
 *   NEW_VERSION    e.g. "0.9.8-alpha"
 *   PREVIOUS_VERSION  e.g. "0.9.7-alpha" or "none"
 *   LAST_TAG       e.g. "v0.9.7-alpha" (required when RELEASE_TYPE=delta)
 *
 * Output:
 *   Writes JSON result to release/.tmp/a1_build_result.txt
 *   Exit code 0 = success, 1 = error (check result.error)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- Arguments ---
const RELEASE_TYPE = process.argv[2] || 'full';
const NEW_VERSION = process.argv[3] || 'unknown';
const PREVIOUS_VERSION = process.argv[4] || 'none';
const LAST_TAG = process.argv[5] || '';

const STAGING_DIR = '.release-staging';
const RESULT_FILE = 'release/.tmp/a1_build_result.txt';

const result = {
  type: RELEASE_TYPE,
  files: 0,
  deleted: 0,
  error: null,
  fileList: '',
  deletedList: ''
};

// --- Helpers ---

/** Files that must NEVER be included in any release ZIP */
function shouldNeverInclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized).toLowerCase();

  if (basename === 'token.txt') return true;
  if (basename === '.env' || basename === '.env.local') return true;
  if (/\.(db|sqlite|sqlite3)$/i.test(basename)) return true;
  if (basename === 'logo.psb') return true;
  if (/^\.next/i.test(normalized)) return true;
  if (normalized.startsWith('node_modules/')) return true;
  if (normalized.startsWith('storage/')) return true;
  if (normalized.startsWith('release/logs/')) return true;
  if (normalized.startsWith('release/.tmp/')) return true;

  return false;
}

/** Read and parse .releaseinclude whitelist */
function readWhitelist() {
  const content = fs.readFileSync('release/.releaseinclude', 'utf8');
  return content
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));
}

/** Check if a file path matches the whitelist */
function matchesWhitelist(filePath, whitelist) {
  return whitelist.some(w => {
    const pattern = w.endsWith('/') ? w.slice(0, -1) : w;
    return w.endsWith('/')
      ? filePath.startsWith(pattern + '/')
      : filePath === pattern;
  });
}

/** Recursively copy a file or directory */
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;

  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    let count = 0;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      count += copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return count;
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return 1;
  }
}

/** Count all files recursively */
function countFiles(dir) {
  let count = 0;
  for (const entry of fs.readdirSync(dir)) {
    const fp = path.join(dir, entry);
    if (fs.statSync(fp).isDirectory()) {
      count += countFiles(fp);
    } else {
      count++;
    }
  }
  return count;
}

// --- Main ---

try {
  const whitelist = readWhitelist();
  console.log(`  [build-staging] Whitelist: ${whitelist.length} entries`);
  console.log(`  [build-staging] Type: ${RELEASE_TYPE}`);

  // Clean staging dir
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  if (RELEASE_TYPE === 'full') {
    // ============================
    //  FULL RELEASE
    // ============================
    console.log('  [build-staging] Creating FULL staging...');

    for (const item of whitelist) {
      const clean = item.endsWith('/') ? item.slice(0, -1) : item;

      if (shouldNeverInclude(clean)) {
        console.log(`    SKIP (never-include): ${clean}`);
        continue;
      }
      if (!fs.existsSync(clean)) {
        console.log(`    SKIP (not found): ${clean}`);
        continue;
      }

      const dest = path.join(STAGING_DIR, clean);
      const copied = copyRecursive(clean, dest);
      console.log(`    OK: ${clean} (${copied} files)`);
    }

    // Generate manifest
    const manifest = {
      version: NEW_VERSION,
      previousVersion: PREVIOUS_VERSION,
      type: 'full',
      files: [],
      deleted: [],
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(STAGING_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    );

    result.files = countFiles(STAGING_DIR);
    result.type = 'full';
    console.log(`  [build-staging] FULL staging ready: ${result.files} files`);

  } else {
    // ============================
    //  DELTA RELEASE
    // ============================
    if (!LAST_TAG) {
      result.error = 'LAST_TAG required for delta release';
      fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
      fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
      console.error('  [build-staging] ERROR: LAST_TAG required for delta');
      process.exit(1);
    }

    console.log(`  [build-staging] Creating DELTA staging (from ${LAST_TAG})...`);

    // Get changed and deleted files from git
    const changedRaw = execSync(`git diff --name-only ${LAST_TAG} HEAD`, { encoding: 'utf8' });
    const deletedRaw = execSync(`git diff --diff-filter=D --name-only ${LAST_TAG} HEAD`, { encoding: 'utf8' });

    const changed = changedRaw.split('\n').filter(Boolean);
    const deleted = deletedRaw.split('\n').filter(Boolean);

    console.log(`  [build-staging] Git diff: ${changed.length} changed, ${deleted.length} deleted`);

    // Filter: must be in whitelist AND not in never-include
    const included = changed
      .filter(f => matchesWhitelist(f, whitelist))
      .filter(f => !shouldNeverInclude(f));

    const deletedIncluded = deleted
      .filter(f => matchesWhitelist(f, whitelist));

    if (included.length === 0) {
      result.error = 'NO_CHANGES';
      fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
      fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
      console.log('  [build-staging] No whitelisted changes found.');
      process.exit(0);
    }

    console.log(`  [build-staging] Included: ${included.length} files, Deleted: ${deletedIncluded.length}`);

    // Copy changed files to staging
    let copied = 0;
    for (const f of included) {
      if (!fs.existsSync(f)) continue;
      const dest = path.join(STAGING_DIR, f);
      copied += copyRecursive(f, dest);
    }

    // Always include package.json in delta (for version verification)
    if (!fs.existsSync(path.join(STAGING_DIR, 'package.json')) && fs.existsSync('package.json')) {
      fs.copyFileSync('package.json', path.join(STAGING_DIR, 'package.json'));
      copied++;
    }

    // Generate manifest
    const manifest = {
      version: NEW_VERSION,
      previousVersion: PREVIOUS_VERSION,
      type: 'delta',
      files: included,
      deleted: deletedIncluded,
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(
      path.join(STAGING_DIR, 'manifest.json'),
      JSON.stringify(manifest, null, 2) + '\n'
    );

    result.files = copied;
    result.deleted = deletedIncluded.length;
    result.type = 'delta';
    result.fileList = included.join('\n');
    result.deletedList = deletedIncluded.join('\n');
    console.log(`  [build-staging] DELTA staging ready: ${copied} files, ${deletedIncluded.length} deleted`);
  }

  // Write result
  fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
  fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
  console.log('  [build-staging] Result written OK');

} catch (err) {
  result.error = err.message;
  console.error(`  [build-staging] ERROR: ${err.message}`);
  try {
    fs.mkdirSync(path.dirname(RESULT_FILE), { recursive: true });
    fs.writeFileSync(RESULT_FILE, JSON.stringify(result));
  } catch (writeErr) {
    console.error(`  [build-staging] FATAL: Cannot write result file: ${writeErr.message}`);
  }
  process.exit(1);
}
