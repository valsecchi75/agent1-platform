/**
 * generate-build-info.js
 *
 * Runs BEFORE `next build` to produce public/build-info.json
 * with commit hash, branch, build date. The data is also injected
 * as NEXT_PUBLIC_* env vars so client components can read it at
 * build time without an extra fetch.
 *
 * Usage:  node scripts/generate-build-info.js
 *         (called automatically by `npm run build`)
 */

const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { resolve } = require('path');

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

const commitHash = git('rev-parse --short HEAD') || 'unknown';
const commitFull = git('rev-parse HEAD') || 'unknown';
const branch = git('rev-parse --abbrev-ref HEAD') || 'unknown';
const commitDate = git('log -1 --format=%ci') || new Date().toISOString();
const buildDate = new Date().toISOString();

const info = {
  commitHash,
  commitFull,
  branch,
  commitDate,
  buildDate,
};

// Write JSON file (useful for server-side reads or debug)
const outPath = resolve(__dirname, '..', 'public', 'build-info.json');
writeFileSync(outPath, JSON.stringify(info, null, 2));

// Inject as env vars for Next.js client-side access
process.env.NEXT_PUBLIC_BUILD_COMMIT = commitHash;
process.env.NEXT_PUBLIC_BUILD_BRANCH = branch;
process.env.NEXT_PUBLIC_BUILD_DATE = buildDate;

console.log(`  [build-info] ${commitHash} (${branch}) built ${buildDate.slice(0, 10)}`);
