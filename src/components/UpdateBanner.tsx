'use client';

import { ArrowUpCircle, X, Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';

const STEP_LABELS: Record<number, string> = {
  1: 'Downloading update...',
  2: 'Extracting files...',
  3: 'Creating backup...',
  4: 'Replacing files...',
  5: 'Installing dependencies...',
};

export function UpdateBanner() {
  const {
    updateInfo,
    updateProgress,
    updateDismissed,
    applyUpdate,
    dismissUpdate,
    checkNow,
  } = useUpdateCheck();

  const [showNotes, setShowNotes] = useState(false);

  const { isUpdating, step, status, error: progressError } = updateProgress;

  // Apply-error state (visible even if no update is "available")
  if (progressError && !isUpdating) {
    if (updateDismissed) return null;
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
        <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
        <span className="text-sm flex-1">{progressError}</span>
        <button
          onClick={applyUpdate}
          className="text-xs px-3 py-1 rounded flex items-center gap-1"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <RotateCcw className="w-3 h-3" /> Riprova
        </button>
        <button onClick={dismissUpdate} className="p-1 opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Check-level error from update-check API (token invalid, network error, etc.)
  const checkError = updateInfo?.error;
  if (checkError && !updateInfo?.updateAvailable && !isUpdating) {
    if (updateDismissed) return null;
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
        <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
        <span className="text-sm flex-1">Controllo aggiornamenti: {checkError}</span>
        <button
          onClick={checkNow}
          className="text-xs px-3 py-1 rounded flex items-center gap-1"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <RotateCcw className="w-3 h-3" /> Riprova
        </button>
        <button onClick={dismissUpdate} className="p-1 opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Hidden states: no update available, no errors
  if (!updateInfo?.updateAvailable && !isUpdating) return null;
  if (updateDismissed && !isUpdating) return null;

  // Updating state
  if (isUpdating) {
    const label = step ? (status === 'verifying' ? 'Verifying...' : STEP_LABELS[step] || 'Working...') : 'Starting...';
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
        <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" style={{ color: 'var(--accent)' }} />
        <span className="text-sm flex-1">{label}</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(s => (
            <div
              key={s}
              className="w-2 h-2 rounded-full"
              style={{
                background: step && s <= step ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Restart required state
  if (status === 'restart_required') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-3 flex items-center gap-3"
        style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: '#22c55e' }} />
        <span className="text-sm flex-1">
          Aggiornamento completato. Chiudi e rilancia start.bat per completare.
        </span>
      </div>
    );
  }

  // Available state
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] px-4 py-3"
      style={{ background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <ArrowUpCircle className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
        <span className="text-sm flex-1">
          AGENT 1 <strong>v{updateInfo.latestVersion}</strong> disponibile
          {updateInfo.releaseNotes && (
            <button
              onClick={() => setShowNotes(!showNotes)}
              className="ml-2 text-xs underline opacity-70 hover:opacity-100"
            >
              {showNotes ? 'nascondi note' : 'vedi note'}
            </button>
          )}
        </span>
        <button
          onClick={applyUpdate}
          className="text-xs px-4 py-1.5 rounded font-medium"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          Aggiorna ora
        </button>
        <button onClick={dismissUpdate} className="p-1 opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
      {showNotes && updateInfo.releaseNotes && (
        <div className="mt-2 text-xs opacity-80 max-h-40 overflow-y-auto whitespace-pre-wrap pl-8">
          {updateInfo.releaseNotes}
        </div>
      )}
    </div>
  );
}
