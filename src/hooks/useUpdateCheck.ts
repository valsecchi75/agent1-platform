'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

const POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const SSE_TIMEOUT = 180_000; // 180s without data = connection lost (backup step can take 60-90s)

/**
 * Legge il param ?dev-update=<mode> dall'URL corrente.
 * Possibili valori: available | available-real | error | uptodate
 * Ritorna null se non presente (comportamento normale).
 */
function getDevUpdateMode(): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get('dev-update');
}

/**
 * Trasforma ?dev-update=<mode> nell'URL da chiamare per il check.
 * - available        → mock: banner "update disponibile" (no download reale)
 * - available-real   → check reale GitHub (bypass cache), download URL vero
 * - error            → mock: banner errore token
 * - uptodate         → mock: nessun banner
 */
function buildCheckUrl(devMode: string | null): string {
  if (!devMode) return '/api/update-check';
  if (devMode === 'available')      return '/api/update-check?mock=available&version=99.0.0-preview';
  if (devMode === 'available-real') return '/api/update-check?force=true';
  if (devMode === 'error')          return '/api/update-check?mock=error';
  if (devMode === 'uptodate')       return '/api/update-check?mock=uptodate';
  // Fallback: passa il valore direttamente come mock mode
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

  const checkNow = useCallback(async () => {
    const devMode = getDevUpdateMode();
    const url = buildCheckUrl(devMode);
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Suppress banner if user previously skipped this specific version
        const skipped = useWorkflowStore.getState().updateSkippedVersion;
        if (data.updateAvailable && data.latestVersion === skipped) {
          data.updateAvailable = false;
        }
        setUpdateInfo(data);
      }
    } catch {
      // Network error — set error info so banner can show friendly message
      setUpdateInfo({
        updateAvailable: false,
        currentVersion: '',
        latestVersion: null,
        releaseNotes: null,
        downloadUrl: null,
        publishedAt: null,
        cachedAt: new Date().toISOString(),
        error: 'network_error',
      });
    }
  }, [setUpdateInfo]);

  const applyUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      setUpdateProgress({
        isUpdating: false,
        error: 'Download URL non disponibile. Riprova il controllo aggiornamenti.',
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
          error: 'Connessione con il server persa. Ricarica la pagina per verificare lo stato dell\'aggiornamento.',
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

  // Poll on mount and every POLL_INTERVAL
  useEffect(() => {
    checkNow();
    // Se siamo in modalità dev non fare re-poll: l'URL è già fisso
    if (!getDevUpdateMode()) {
      pollRef.current = setInterval(checkNow, POLL_INTERVAL);
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
