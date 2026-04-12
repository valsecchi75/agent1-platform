/**
 * Checks GitHub Releases API for newer versions.
 * Caches results in-memory with variable TTL based on response type.
 * Never exposes the decoded token in errors or logs.
 */

import semver from 'semver';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { decodeToken } from './token';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  downloadUrl: string | null;
  publishedAt: string | null;
  cachedAt: string | null;
  error: string | null;
}

interface CacheEntry {
  result: UpdateCheckResult;
  expiresAt: number;
}

let updateCheckCache: CacheEntry | null = null;

export function clearUpdateCache(): void {
  updateCheckCache = null;
}

function getLocalVersion(): string {
  try {
    const pkgPath = resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function makeErrorResult(currentVersion: string, error: string): UpdateCheckResult {
  return {
    updateAvailable: false,
    currentVersion,
    latestVersion: null,
    releaseNotes: null,
    downloadUrl: null,
    publishedAt: null,
    cachedAt: new Date().toISOString(),
    error,
  };
}

async function fetchFromGitHub(): Promise<UpdateCheckResult> {
  const GITHUB_REPO = process.env.GITHUB_REPO || 'valsecchi75/agent1-platform';
  const localVersion = getLocalVersion();
  const token = decodeToken();

  if (!token) {
    return makeErrorResult(localVersion, 'Update token not configured');
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`,
      {
        headers: {
          Authorization: `token ${token}`,
          'User-Agent': 'AGENT1-UpdateCheck',
          Accept: 'application/vnd.github+json',
        },
      }
    );

    if (response.status === 401) {
      return makeErrorResult(localVersion, 'Update check authentication failed');
    }
    if (response.status === 403) {
      return makeErrorResult(localVersion, 'GitHub rate limit reached, will retry later');
    }
    if (response.status === 404) {
      // No releases yet — return success with no update available
      return {
        updateAvailable: false,
        currentVersion: localVersion,
        latestVersion: null,
        releaseNotes: null,
        downloadUrl: null,
        publishedAt: null,
        cachedAt: new Date().toISOString(),
        error: null,
      };
    }
    if (!response.ok) {
      return makeErrorResult(localVersion, `Update check unavailable (${response.status})`);
    }

    const release = await response.json();
    const remoteVersion = (release.tag_name || '').replace(/^v/, '');
    const cleanLocal = semver.clean(localVersion) || '0.0.0';
    const cleanRemote = semver.clean(remoteVersion);

    if (!cleanRemote) {
      return makeErrorResult(localVersion, 'Invalid version in latest release');
    }

    // Find the zip asset
    const asset = release.assets?.find(
      (a: { name: string }) => a.name.endsWith('.zip')
    );

    return {
      updateAvailable: semver.gt(cleanRemote, cleanLocal),
      currentVersion: localVersion,
      latestVersion: remoteVersion,
      releaseNotes: release.body || null,
      downloadUrl: asset?.url || null,
      publishedAt: release.published_at || null,
      cachedAt: new Date().toISOString(),
      error: null,
    };
  } catch {
    return makeErrorResult(localVersion, 'Network error during update check');
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const now = Date.now();

  if (updateCheckCache && updateCheckCache.expiresAt > now) {
    return updateCheckCache.result;
  }

  const result = await fetchFromGitHub();

  // Variable cache TTL
  const cacheDuration = result.error?.includes('authentication')
    ? 24 * 60 * 60 * 1000   // Auth error: 24h
    : result.error
      ? 5 * 60 * 1000       // Other error: 5 min
      : 60 * 60 * 1000;     // Success: 1h

  updateCheckCache = { result, expiresAt: now + cacheDuration };
  return result;
}
