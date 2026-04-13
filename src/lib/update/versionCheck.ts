/**
 * Checks GitHub Releases API (public, no auth) for newer versions.
 * Caches results in-memory with variable TTL based on response type.
 */

import semver from 'semver';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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

// Cache TTLs (ms)
const CACHE_SUCCESS       = 6 * 60 * 60 * 1000;  // 6 hours
const CACHE_NETWORK_ERROR = 5 * 60 * 1000;        // 5 minutes
const CACHE_RATE_LIMIT    = 61 * 60 * 1000;        // 61 minutes (fallback)
const CACHE_OTHER_ERROR   = 15 * 60 * 1000;        // 15 minutes

const GITHUB_REPO = process.env.GITHUB_REPO || 'valsecchi75/agent1-platform';
const GITHUB_API = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;

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

/**
 * Parse X-RateLimit-Reset header to get cache duration.
 * Returns duration in ms, or fallback if header is missing/invalid.
 */
function getRateLimitCacheDuration(response: Response): number {
  const resetHeader = response.headers.get('X-RateLimit-Reset');
  if (resetHeader) {
    const resetTimestamp = parseInt(resetHeader, 10);
    if (!isNaN(resetTimestamp)) {
      const now = Math.floor(Date.now() / 1000);
      const waitMs = (resetTimestamp - now + 5) * 1000; // +5s buffer
      if (waitMs > 0 && waitMs < 2 * 60 * 60 * 1000) { // sanity: max 2h
        return waitMs;
      }
    }
  }
  return CACHE_RATE_LIMIT; // fallback: 61 minutes
}

async function fetchFromGitHub(): Promise<{ result: UpdateCheckResult; cacheDuration: number }> {
  const localVersion = getLocalVersion();

  try {
    const response = await fetch(GITHUB_API, {
      headers: {
        'User-Agent': 'AGENT1-UpdateCheck',
        'Accept': 'application/vnd.github+json',
      },
    });

    if (response.status === 403) {
      const cacheDuration = getRateLimitCacheDuration(response);
      return {
        result: makeErrorResult(localVersion, 'GitHub rate limit reached, will retry later'),
        cacheDuration,
      };
    }

    if (response.status === 404) {
      // No releases yet — not an error
      return {
        result: {
          updateAvailable: false,
          currentVersion: localVersion,
          latestVersion: null,
          releaseNotes: null,
          downloadUrl: null,
          publishedAt: null,
          cachedAt: new Date().toISOString(),
          error: null,
        },
        cacheDuration: CACHE_SUCCESS,
      };
    }

    if (!response.ok) {
      return {
        result: makeErrorResult(localVersion, `Update check unavailable (${response.status})`),
        cacheDuration: CACHE_OTHER_ERROR,
      };
    }

    const release = await response.json();
    const remoteVersion = (release.tag_name || '').replace(/^v/, '');
    const cleanLocal = semver.clean(localVersion) || '0.0.0';
    const cleanRemote = semver.clean(remoteVersion);

    if (!cleanRemote) {
      return {
        result: makeErrorResult(localVersion, 'Invalid version in latest release'),
        cacheDuration: CACHE_OTHER_ERROR,
      };
    }

    // Find the zip asset
    const asset = release.assets?.find(
      (a: { name: string }) => a.name.endsWith('.zip')
    );

    return {
      result: {
        updateAvailable: semver.gt(cleanRemote, cleanLocal),
        currentVersion: localVersion,
        latestVersion: remoteVersion,
        releaseNotes: release.body || null,
        downloadUrl: asset?.url || null,
        publishedAt: release.published_at || null,
        cachedAt: new Date().toISOString(),
        error: null,
      },
      cacheDuration: CACHE_SUCCESS,
    };
  } catch {
    return {
      result: makeErrorResult(localVersion, 'Network error during update check'),
      cacheDuration: CACHE_NETWORK_ERROR,
    };
  }
}

export async function checkForUpdates(): Promise<UpdateCheckResult> {
  const now = Date.now();

  if (updateCheckCache && updateCheckCache.expiresAt > now) {
    return updateCheckCache.result;
  }

  const { result, cacheDuration } = await fetchFromGitHub();

  updateCheckCache = { result, expiresAt: now + cacheDuration };
  return result;
}
