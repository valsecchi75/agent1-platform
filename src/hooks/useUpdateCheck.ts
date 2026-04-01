'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';

const POLL_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

export function useUpdateCheck() {
  const updateInfo = useWorkflowStore((s) => s.updateInfo);
  const updateProgress = useWorkflowStore((s) => s.updateProgress);
  const updateDismissed = useWorkflowStore((s) => s.updateDismissed);
  const setUpdateInfo = useWorkflowStore((s) => s.setUpdateInfo);
  const setUpdateProgress = useWorkflowStore((s) => s.setUpdateProgress);
  const dismissUpdate = useWorkflowStore((s) => s.dismissUpdate);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkNow = useCallback(async () => {
    try {
      const res = await fetch('/api/update-check');
      if (res.ok) {
        const data = await res.json();
        setUpdateInfo(data);
      }
    } catch {
      // Silent fail — update check is best-effort
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

    setUpdateProgress({ isUpdating: true, step: 1, status: 'starting', error: null });

    try {
      const response = await fetch('/api/update-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downloadUrl: updateInfo.downloadUrl }),
      });

      if (!response.body) {
        setUpdateProgress({ isUpdating: false, error: 'No response stream' });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            setUpdateProgress({
              step: data.step ?? null,
              status: data.status ?? null,
              isUpdating: !data.done,
              error: data.error ?? null,
            });

            if (data.done && data.success) {
              // Update completed
              if (data.requiresRestart) {
                setUpdateProgress({
                  isUpdating: false,
                  status: 'restart_required',
                  step: null,
                });
              } else {
                // Dev mode — reload after short delay
                setTimeout(() => window.location.reload(), 2000);
              }
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setUpdateProgress({ isUpdating: false, error: msg });
    }
  }, [updateInfo, setUpdateProgress]);

  // Poll on mount and every POLL_INTERVAL
  useEffect(() => {
    checkNow();
    pollRef.current = setInterval(checkNow, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [checkNow]);

  return {
    updateInfo,
    updateProgress,
    updateDismissed,
    checkNow,
    applyUpdate,
    dismissUpdate,
  };
}
