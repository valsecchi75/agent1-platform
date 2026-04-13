/**
 * App version helpers.
 *
 * Version is injected at build time from package.json via next.config.ts
 * (NEXT_PUBLIC_APP_VERSION). Components should use these helpers so the
 * badge always reflects the real semver — no more hardcoded strings.
 *
 * package.json format : "0.9.7-alpha"
 * formatVersion()     → "Alpha 0.9.7"
 * shortVersion()      → "0.9.7"
 */

const RAW = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.9';

/** "0.9.7-alpha" → "0.9.7" */
export function shortVersion(): string {
  return RAW.replace(/-(alpha|beta|rc).*$/i, '');
}

/** "0.9.7-alpha" → "Alpha 0.9.7" */
export function formatVersion(): string {
  return `Alpha ${shortVersion()}`;
}
