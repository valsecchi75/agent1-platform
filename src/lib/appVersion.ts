/**
 * App version helpers.
 *
 * Version is injected at build time from package.json via next.config.ts
 * (NEXT_PUBLIC_APP_VERSION). Build info (commit, branch, date) is injected
 * by scripts/generate-build-info.js via NEXT_PUBLIC_BUILD_* env vars.
 *
 * Components should use these helpers so the badge always reflects the
 * real semver — no more hardcoded strings.
 *
 * package.json format : "0.9.16-alpha"
 * formatVersion()     → "Alpha 0.9.16"
 * shortVersion()      → "0.9.16"
 * buildInfo()         → { commit: "4a3d2d5", branch: "main", date: "2026-04-10" }
 */

const RAW = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.9';

/** "0.9.16-alpha" → "0.9.16" */
export function shortVersion(): string {
  return RAW.replace(/-(alpha|beta|rc).*$/i, '');
}

/** "0.9.16-alpha" → "Alpha 0.9.16" */
export function formatVersion(): string {
  return `Alpha ${shortVersion()}`;
}

/** Full semver string as-is from package.json, e.g. "0.9.16-alpha" */
export function rawVersion(): string {
  return RAW;
}

export interface BuildInfo {
  commit: string;
  branch: string;
  date: string;
}

/** Build metadata injected at build time */
export function buildInfo(): BuildInfo {
  return {
    commit: process.env.NEXT_PUBLIC_BUILD_COMMIT || 'dev',
    branch: process.env.NEXT_PUBLIC_BUILD_BRANCH || 'local',
    date: (process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString()).slice(0, 10),
  };
}

/** Compact label for UI: "v0.9.16-alpha · 4a3d2d5" */
export function versionLabel(): string {
  const bi = buildInfo();
  return bi.commit !== 'dev'
    ? `v${RAW} · ${bi.commit}`
    : `v${RAW} · dev`;
}
