import * as fs from 'fs';
import * as path from 'path';
import semver from 'semver';

let cachedVersion: string | null = null;

/** Read the current app version from package.json (server-side only) */
export function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    cachedVersion = pkg.version || '0.0.0';
  } catch {
    cachedVersion = '0.0.0';
  }
  return cachedVersion!;
}

/**
 * Check if current app version satisfies the pack's minAppVersion requirement.
 * Uses semver.gte() with includePrerelease option.
 */
export function isAppVersionCompatible(
  appVersion: string,
  minAppVersion: string | undefined
): boolean {
  if (!minAppVersion) return true;
  const coercedApp = semver.coerce(appVersion);
  const coercedMin = semver.coerce(minAppVersion);
  if (!coercedApp || !coercedMin) return true;
  const parsedApp = semver.parse(appVersion) || coercedApp;
  const parsedMin = semver.parse(minAppVersion) || coercedMin;
  return semver.gte(parsedApp, parsedMin);
}
