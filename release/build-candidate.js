#!/usr/bin/env node
/**
 * build-candidate.js — Creates a clean candidate release ZIP staging
 *
 * Usage:
 *   node release/build-candidate.js <NEW_VERSION> <PREVIOUS_VERSION>
 *
 * Excludes: storage/, .db files, .env*, Token.txt, node_modules, .next
 * Includes: everything from .releaseinclude whitelist + manifest.json
 *
 * Output:
 *   Creates .candidate-staging/ directory ready for zipping
 *   Writes file count to stdout
 */

const fs = require('fs');
const path = require('path');

const NEW_VERSION = process.argv[2] || 'unknown';
const PREVIOUS_VERSION = process.argv[3] || 'none';
const STAGING_DIR = '.candidate-staging';

/** Files/dirs that must NEVER be in a candidate release */
function shouldExclude(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const basename = path.basename(normalized).toLowerCase();

  // Storage and generated data (root-level only, NOT src/lib/storage/)
  if (/^storage\//i.test(normalized)) return true;

  // Database files
  if (/\.(db|sqlite|sqlite3)$/i.test(basename)) return true;

  // Environment secrets
  if (/^\.env/i.test(basename)) return true;

  // Token files
  if (basename === 'token.txt') return true;

  // Large binary files
  if (basename === 'logo.psb') return true;

  // Build artifacts
  if (normalized.startsWith('.next/') || normalized.startsWith('node_modules/')) return true;

  // Release internal files
  if (normalized.startsWith('release/logs/')) return true;
  if (normalized.startsWith('release/.tmp/')) return true;

  return false;
}

/** Recursively copy, returning count of files copied */
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;

  const stat = fs.statSync(src);
  if (stat.isFile()) {
    if (shouldExclude(src)) return 0;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    return 1;
  }

  let count = 0;
  try {
    for (const entry of fs.readdirSync(src)) {
      count += copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } catch (e) {
    // Permission errors on some dirs — skip
  }
  return count;
}

// --- Main ---

try {
  // Clean staging dir
  if (fs.existsSync(STAGING_DIR)) {
    fs.rmSync(STAGING_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(STAGING_DIR, { recursive: true });

  // Read whitelist
  const whitelist = fs.readFileSync('release/.releaseinclude', 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'));

  let totalFiles = 0;

  for (const item of whitelist) {
    const clean = item.endsWith('/') ? item.slice(0, -1) : item;
    if (shouldExclude(clean)) continue;
    totalFiles += copyRecursive(clean, path.join(STAGING_DIR, clean));
  }

  // Generate manifest for candidate
  const manifest = {
    version: NEW_VERSION,
    previousVersion: PREVIOUS_VERSION,
    type: 'candidate',
    files: [],
    deleted: [],
    timestamp: new Date().toISOString()
  };
  fs.writeFileSync(
    path.join(STAGING_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  totalFiles++;

  console.log(`  [OK] Candidate staging: ${totalFiles} file copiati`);
  process.exit(0);

} catch (err) {
  console.error(`  [ERRORE] Candidate staging: ${err.message}`);
  process.exit(1);
}
