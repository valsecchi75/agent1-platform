'use client';

import { ArrowUp, X, CheckCircle2, AlertCircle, RotateCcw, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';

const STEPS = ['Download', 'Estrazione', 'Backup', 'Sostituzione', 'npm install'];

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
  const [isStarting, setIsStarting] = useState(false);

  const { isUpdating, step, status, error: progressError } = updateProgress;
  const isLoading = isUpdating || isStarting;

  const handleApplyUpdate = async () => {
    setIsStarting(true);
    try {
      await applyUpdate();
    } finally {
      setIsStarting(false);
    }
  };

  // Nothing to show
  const hasContent =
    updateInfo?.updateAvailable ||
    isLoading ||
    !!progressError ||
    status === 'restart_required' ||
    !!updateInfo?.error;

  if (!hasContent) return null;
  if (updateDismissed && !isLoading && status !== 'restart_required') return null;

  return (
    <>
      <style>{`
        @keyframes ub-slide-down {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes ub-pulse-ring {
          0%, 100% { transform: scale(1);   opacity: 0.6; }
          50%       { transform: scale(1.8); opacity: 0;   }
        }
        @keyframes ub-spin {
          to { transform: rotate(360deg); }
        }
        .ub-root {
          animation: ub-slide-down 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        .ub-ring {
          animation: ub-pulse-ring 2s ease-out infinite;
        }
        .ub-spin {
          animation: ub-spin 1s linear infinite;
        }
        .ub-btn {
          transition: transform 0.1s ease, box-shadow 0.15s ease, opacity 0.15s ease;
        }
        .ub-btn:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .ub-btn:active:not(:disabled) {
          transform: translateY(0) scale(0.97);
        }
        .ub-step {
          transition: background 0.35s ease, box-shadow 0.35s ease;
        }
      `}</style>

      <div
        className="ub-root fixed top-0 left-0 right-0 z-[9999]"
        style={{
          background: 'linear-gradient(180deg, #1a1e2c 0%, #161a27 100%)',
          borderBottom: progressError
            ? '1px solid rgba(239,68,68,0.25)'
            : status === 'restart_required'
            ? '1px solid rgba(34,197,94,0.25)'
            : '1px solid rgba(197,164,78,0.18)',
        }}
      >
        {/* Top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: progressError
            ? 'linear-gradient(90deg, transparent 5%, #ef4444 40%, #ef4444 60%, transparent 95%)'
            : status === 'restart_required'
            ? 'linear-gradient(90deg, transparent 5%, #22c55e 40%, #22c55e 60%, transparent 95%)'
            : 'linear-gradient(90deg, transparent 5%, var(--accent) 40%, var(--accent-vivid, #e0c060) 60%, transparent 95%)',
        }} />

        {/* ── RESTART REQUIRED ── */}
        {status === 'restart_required' && (
          <div className="flex items-center gap-3 px-4" style={{ height: 40 }}>
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#22c55e' }} />
            <span className="text-xs flex-1" style={{ color: '#d1fae5' }}>
              <strong>Aggiornamento completato.</strong>{' '}
              <span style={{ opacity: 0.7 }}>Chiudi e rilancia</span>{' '}
              <code style={{
                background: 'rgba(255,255,255,0.07)',
                padding: '1px 6px',
                borderRadius: 3,
                fontSize: 10,
                color: '#86efac',
              }}>start.bat</code>{' '}
              <span style={{ opacity: 0.7 }}>per completare.</span>
            </span>
          </div>
        )}

        {/* ── APPLY ERROR ── */}
        {progressError && !isLoading && status !== 'restart_required' && (
          <div className="flex items-center gap-2.5 px-4" style={{ height: 40 }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f87171' }} />
            <span className="text-xs flex-1 truncate" style={{ color: '#fca5a5' }}>
              <strong>Errore:</strong>{' '}
              <span style={{ opacity: 0.85 }}>{progressError}</span>
            </span>
            <button
              onClick={handleApplyUpdate}
              className="ub-btn flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.28)',
                color: '#fca5a5',
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Riprova
            </button>
            {!isUpdating && (
              <button
                onClick={dismissUpdate}
                className="ub-btn p-1 rounded"
                style={{ color: 'var(--foreground)', opacity: 0.3 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* ── CHECK ERROR (token / network) ── */}
        {updateInfo?.error && !updateInfo.updateAvailable && !isLoading && !progressError && (
          <div className="flex items-center gap-2.5 px-4" style={{ height: 40 }}>
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f87171' }} />
            <span className="text-xs flex-1 truncate" style={{ color: '#fca5a5', opacity: 0.8 }}>
              Controllo aggiornamenti: {updateInfo.error}
            </span>
            <button
              onClick={checkNow}
              className="ub-btn flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.28)',
                color: '#fca5a5',
              }}
            >
              <RotateCcw className="w-3 h-3" />
              Riprova
            </button>
            <button
              onClick={dismissUpdate}
              className="ub-btn p-1 rounded"
              style={{ color: 'var(--foreground)', opacity: 0.3 }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0.3')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ── LOADING / UPDATING ── */}
        {isLoading && (
          <div className="px-4 py-2">
            <div className="flex items-center gap-3" style={{ height: 24 }}>
              {/* Spinner */}
              <RefreshCw
                className="ub-spin w-3.5 h-3.5 flex-shrink-0"
                style={{ color: 'var(--accent)' }}
              />
              <span className="text-xs font-medium flex-1" style={{ color: 'var(--foreground)' }}>
                {isStarting && !isUpdating
                  ? 'Preparazione…'
                  : step
                  ? status === 'verifying'
                    ? 'Verifica integrità…'
                    : `${STEPS[(step ?? 1) - 1] ?? 'Elaborazione'}…`
                  : 'Avvio…'}
              </span>
              <span
                className="text-xs tabular-nums font-medium"
                style={{ color: 'var(--accent)', opacity: 0.9 }}
              >
                {step ? `${step} / 5` : ''}
              </span>
            </div>

            {/* Step track */}
            <div className="flex items-center gap-1 mt-1.5 ml-6">
              {STEPS.map((label, i) => {
                const s = i + 1;
                const isDone = step !== null && step !== undefined && s < step;
                const isCurrent = step === s;
                return (
                  <div
                    key={s}
                    title={label}
                    className="ub-step flex-1 rounded-full"
                    style={{
                      height: 2,
                      background: isDone
                        ? 'var(--accent)'
                        : isCurrent
                        ? 'var(--accent-vivid, #e0c060)'
                        : 'rgba(255,255,255,0.08)',
                      boxShadow: isCurrent
                        ? '0 0 6px rgba(197,164,78,0.55)'
                        : undefined,
                    }}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ── UPDATE AVAILABLE ── */}
        {!isLoading && updateInfo?.updateAvailable && !progressError && status !== 'restart_required' && (
          <div>
            <div className="flex items-center gap-3 px-4" style={{ height: 40 }}>
              {/* Pulsing dot */}
              <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 14, height: 14 }}>
                <span
                  className="absolute rounded-full"
                  style={{ width: 6, height: 6, background: 'var(--accent)' }}
                />
                <span
                  className="ub-ring absolute rounded-full"
                  style={{ width: 12, height: 12, border: '1px solid var(--accent)' }}
                />
              </div>

              {/* Label */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: 'var(--foreground)',
                    opacity: 0.4,
                    textTransform: 'uppercase',
                  }}
                >
                  AGENT 1
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--accent)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  v{updateInfo.latestVersion}
                </span>
                <span style={{ fontSize: 11, color: 'var(--foreground)', opacity: 0.4 }}>
                  disponibile
                </span>
                {updateInfo.releaseNotes && (
                  <button
                    onClick={() => setShowNotes(!showNotes)}
                    style={{
                      fontSize: 10,
                      color: 'var(--accent)',
                      opacity: 0.65,
                      textDecoration: 'underline',
                      textDecorationStyle: 'dotted',
                      transition: 'opacity 0.15s',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.65')}
                  >
                    {showNotes ? 'nascondi' : 'note'}
                  </button>
                )}
              </div>

              {/* CTA */}
              <button
                onClick={handleApplyUpdate}
                disabled={isLoading}
                className="ub-btn flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold"
                style={{
                  background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-vivid, #e0c060) 100%)',
                  color: '#0c0f14',
                  border: '1px solid rgba(255,255,255,0.08)',
                  letterSpacing: '0.015em',
                  boxShadow: '0 2px 10px rgba(197,164,78,0.25)',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.6 : 1,
                  flexShrink: 0,
                }}
              >
                <ArrowUp className="w-3 h-3" />
                Aggiorna ora
              </button>

              {/* Dismiss */}
              <button
                onClick={dismissUpdate}
                className="ub-btn p-1 rounded flex-shrink-0"
                style={{ color: 'var(--foreground)', opacity: 0.25 }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '0.75')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.25')}
                title="Ignora"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Release notes */}
            {showNotes && updateInfo.releaseNotes && (
              <div
                className="px-4 pb-2.5"
                style={{
                  borderTop: '1px solid rgba(197,164,78,0.08)',
                  paddingLeft: '2.5rem',
                }}
              >
                <pre
                  className="text-xs leading-relaxed overflow-y-auto max-h-28 mt-2"
                  style={{
                    color: 'var(--foreground)',
                    opacity: 0.5,
                    fontFamily: 'inherit',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {updateInfo.releaseNotes}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
