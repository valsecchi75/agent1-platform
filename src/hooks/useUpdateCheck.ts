'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

const POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const SSE_TIMEOUT = 180_000; // 180s without data = connection lost (backup step can take 60-90s)

/**
 * Reads the ?dev-update=<mode> param from the current URL.
 * Possible values: available | available-real | error | uptodate
 * Returns null if not present (normal behavior).
 */
function getDevUpdateMode(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('dev-update');
}

/**
 * Transforms ?dev-update=<mode> into the URL to call for the check.
 * - available        → mock: "update available" banner (no real download)
 * - available-real   → real GitHub check (bypass cache), real download URL
 * - error            → mock: token error banner
 * - uptodate         → mock: no banner
 */
function buildCheckUrl(devMode: string | null): string {
  if (!devMode) return '/api/update-check';
  if (devMode === 'available')      return '/api/update-check?mock=available&version=99.0.0-preview';
  if (devMode === 'available-real') return '/api/update-check?force=true';
  if (devMode === 'error')          return '/api/update-check?mock=error';
  if (devMode === 'uptodate')       return '/api/update-check?mock=uptodate';
  // Fallback: pass the value directly as mock mode
  return `/api/update-check?mock=${encodeURIComponent(devMode)}`;
}

export function useUpdateCheck() {
  const updateInfo = useWorkflowStore((s) => s.updateInfo);
  const updateProgress = useWorkflowStore((s) => s.updateProgress);
  const updateDismissed = useWorkflowStore((s) => s.updateDismissed);
  const updateSkippedVersion = useWorkflowStore((s) => s.updateSkippedVersion);
  const setUpdateInfo = useWorkflowStore((s) => s.setUpdateInfo);
  const setUpdateProgress = useWorkflowStore((s) => s.setUpdateProgress);
  const dismissUpdate = useWorkflowStore((s) => s.dismissUpdate);
  const skipUpdateVersion = useWorkflowStore((s) => s.skipUpdateVersion);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Check for updates. `silent` = true for automatic background checks:
   * errors do not show banner (only console log). Error banner appears
   * only when the user clicks "Retry" (silent = false).
   */
  const checkNow = useCallback(async (silent = false) => {
    const devMode = getDevUpdateMode();
    const url = buildCheckUrl(devMode);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        // API route returned non-200 (e.g., 429 rate limit, 500 server error)
        if (!silent) {
          setUpdateInfo({
            updateAvailable: false,
            currentVersion: '',
            latestVersion: null,
            releaseNotes: null,
            downloadUrl: null,
            publishedAt: null,
            error: `server_error_${res.status}`,
          });
        } else {
          console.warn(`[update-check] Background check returned ${res.status}, will retry`);
        }
        return;
      }
      const data = await res.json();
      // Suppress banner if user previously skipped this specific version
      const skipped = useWorkflowStore.getState().updateSkippedVersion;
      if (data.updateAvailable && data.latestVersion === skipped) {
        data.updateAvailable = false;
      }
      // For silent background checks, don't show server-side errors (e.g., GitHub unreachable)
      if (silent && data.error) {
        console.warn('[update-check] Background check error (suppressed):', data.error);
        return;
      }
      setUpdateInfo(data);
    } catch {
      if (!silent) {
        // Manual check failed — show error banner
        setUpdateInfo({
          updateAvailable: false,
          currentVersion: '',
          latestVersion: null,
          releaseNotes: null,
          downloadUrl: null,
          publishedAt: null,
          error: 'network_error',
        });
      } else {
        console.warn('[update-check] Background check failed (network), will retry');
      }
    }
  }, [setUpdateInfo]);

  const applyUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      setUpdateProgress({
        isUpdating: false,
        error: 'Download URL not available. Retry the update check.',
      });
      return;
    }

    setUpdateProgress({ isUpdating: true, step: 1, status: 'starting', error: null, progress: null });

    // SSE inactivity timeout — if no data for 90s, assume connection lost
    let lastDataTime = Date.now();
    const timeoutChecker = setInterval(() => {
      if (Date.now() - lastDataTime > SSE_TIMEOUT) {
        clearInterval(timeoutChecker);
        setUpdateProgress({
          isUpdating: false,
          error: 'Connection to server lost. Reload the page to verify update status.',
        });
      }
    }, 5000);

    try {
      const response = await fetch('/api/update-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadUrl: updateInfo.downloadUrl }),
      });

      if (!response.body) {
        clearInterval(timeoutChecker);
        setUpdateProgress({ isUpdating: false, error: 'No response stream' });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        lastDataTime = Date.now(); // Reset timeout on any data received

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          // Skip SSE comments (heartbeat lines start with :)
          if (line.startsWith(':')) {
            lastDataTime = Date.now();
            continue;
          }
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            setUpdateProgress({
              step: data.step ?? null,
              status: data.status ?? null,
              isUpdating: !data.done,
              error: data.error ?? null,
              progress: data.progress ?? null,
            });

            if (data.done && data.success) {
              if (data.requiresRestart) {
                setUpdateProgress({
                  isUpdating: false,
                  status: 'restart_required',
                  step: null,
                  progress: null,
                });
              } else {
                setTimeout(() => window.location.reload(), 2000);
              }
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setUpdateProgress({ isUpdating: false, error: msg });
    } finally {
      clearInterval(timeoutChecker);
    }
  }, [updateInfo, setUpdateProgress]);

  // Poll on mount and every POLL_INTERVAL — background checks are silent (no error banner)
  // Dev mode checks are always non-silent (for testing error states)
  useEffect(() => {
    const devMode = getDevUpdateMode();
    checkNow(devMode ? false : true);
    // If we're in dev mode don't re-poll: the URL is already fixed
    if (!devMode) {
      pollRef.current = setInterval(() => checkNow(true), POLL_INTERVAL);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkNow]);

  return {
    updateInfo,
    updateProgress,
    updateDismissed,
    updateSkippedVersion,
    checkNow,
    applyUpdate,
    dismissUpdate,
    skipUpdateVersion,
  };
}
