'use client';

/**
 * /dev/update-test — Pagina di test per il sistema di aggiornamento
 *
 * Consente di:
 * 1. Simulare i vari stati del banner (disponibile, errore, aggiornamento in corso)
 * 2. Forzare un controllo reale su GitHub (bypass cache)
 * 3. Avviare un aggiornamento reale (con la vera release su GitHub)
 * 4. Vedere il log live del processo
 */

import { useState, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { RefreshCw, CheckCircle2, AlertCircle, Play, Square, ExternalLink } from 'lucide-react';

type MockMode = 'available' | 'error' | 'uptodate';

const MOCK_NOTES: Record<MockMode, string> = {
  available: '?mock=available&version=99.0.0-test',
  error:     '?mock=error',
  uptodate:  '?mock=uptodate',
};

export default function UpdateTestPage() {
  const setUpdateInfo = useWorkflowStore((s) => s.setUpdateInfo);
  const setUpdateProgress = useWorkflowStore((s) => s.setUpdateProgress);
  const updateInfo = useWorkflowStore((s) => s.updateInfo);
  const updateProgress = useWorkflowStore((s) => s.updateProgress);
  const { applyUpdate, checkNow } = useUpdateCheck();

  const [log, setLog] = useState<{ ts: string; type: 'info' | 'ok' | 'err' | 'data'; msg: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((msg: string, type: 'info' | 'ok' | 'err' | 'data' = 'info') => {
    const ts = new Date().toLocaleTimeString('it-IT', { hour12: false });
    setLog(prev => {
      const next = [...prev, { ts, type, msg }];
      setTimeout(() => {
        logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' });
      }, 30);
      return next;
    });
  }, []);

  // Load a mock state from the API and inject into Zustand
  const loadMock = useCallback(async (mode: MockMode) => {
    setLoading(true);
    addLog(`Carico mock: ${mode}`, 'info');
    try {
      const res = await fetch(`/api/update-check${MOCK_NOTES[mode]}`);
      const data = await res.json();
      addLog(`API risponde: ${JSON.stringify(data)}`, 'data');
      setUpdateInfo(data);
      setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
      addLog(`Stato banner aggiornato → ${mode}`, 'ok');
    } catch (e) {
      addLog(`Errore fetch: ${String(e)}`, 'err');
    } finally {
      setLoading(false);
    }
  }, [addLog, setUpdateInfo, setUpdateProgress]);

  // Force real check on GitHub (bypass cache)
  const realCheck = useCallback(async () => {
    setLoading(true);
    addLog('Controllo reale su GitHub (bypass cache)…', 'info');
    try {
      const res = await fetch('/api/update-check?force=true');
      const data = await res.json();
      addLog(`GitHub risponde: ${JSON.stringify(data)}`, 'data');
      setUpdateInfo(data);
      setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
      addLog(
        data.updateAvailable
          ? `✓ Aggiornamento disponibile: v${data.latestVersion}`
          : `✓ App aggiornata (${data.currentVersion})`,
        'ok',
      );
    } catch (e) {
      addLog(`Errore fetch: ${String(e)}`, 'err');
    } finally {
      setLoading(false);
    }
  }, [addLog, setUpdateInfo, setUpdateProgress]);

  // Simulate updating progress step by step
  const simulateProgress = useCallback(async () => {
    addLog('Simulazione progress (5 step)…', 'info');
    const steps = [
      { step: 1, status: 'downloading' },
      { step: 2, status: 'extracting' },
      { step: 3, status: 'backup' },
      { step: 4, status: 'replacing' },
      { step: 5, status: 'npm_install' },
    ];
    setUpdateProgress({ isUpdating: true, step: null, status: 'starting', error: null });
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 900));
      setUpdateProgress({ isUpdating: true, step: s.step, status: s.status, error: null });
      addLog(`Step ${s.step}/5: ${s.status}`, 'info');
    }
    await new Promise(r => setTimeout(r, 600));
    setUpdateProgress({ isUpdating: false, step: null, status: 'restart_required', error: null });
    addLog('✓ Simulazione completata → restart_required', 'ok');
  }, [addLog, setUpdateProgress]);

  // Inject error state
  const simulateError = useCallback(() => {
    setUpdateProgress({ isUpdating: false, step: null, status: null, error: 'Simulazione errore: Download failed (403)' });
    addLog('Stato errore iniettato nel banner', 'err');
  }, [addLog, setUpdateProgress]);

  // Reset everything
  const resetState = useCallback(() => {
    setUpdateInfo(null);
    setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
    setLog([]);
    addLog('Stato resettato', 'info');
  }, [addLog, setUpdateInfo, setUpdateProgress]);

  // Real update (requires real downloadUrl in updateInfo)
  const triggerRealUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) {
      addLog('⚠ downloadUrl è null — prima fai "Check reale GitHub"', 'err');
      return;
    }
    addLog(`Avvio aggiornamento reale → ${updateInfo.downloadUrl}`, 'info');
    await applyUpdate();
    addLog('applyUpdate() completato', 'ok');
  }, [addLog, applyUpdate, updateInfo]);

  const logColors: Record<string, string> = {
    info: '#9ca3af',
    ok:   '#86efac',
    err:  '#fca5a5',
    data: '#93c5fd',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c0f14',
      color: '#e8e6e3',
      fontFamily: 'system-ui, sans-serif',
      padding: '2rem',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
              color: '#c5a44e', opacity: 0.7, textTransform: 'uppercase',
            }}>AGENT 1</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Update Test Lab</span>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: 'rgba(197,164,78,0.12)',
              border: '1px solid rgba(197,164,78,0.2)',
              color: '#c5a44e',
            }}>DEV ONLY</span>
          </div>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: 0 }}>
            Il banner di aggiornamento è visibile in cima a questa pagina.
            Usa i controlli sotto per testare ogni stato.
          </p>
        </div>

        {/* Current state readout */}
        <div style={{
          background: '#181c25',
          border: '1px solid #2a3040',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#c5a44e', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Stato corrente
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <StateRow label="updateAvailable" value={String(updateInfo?.updateAvailable ?? '—')} />
            <StateRow label="currentVersion" value={updateInfo?.currentVersion ?? '—'} />
            <StateRow label="latestVersion" value={updateInfo?.latestVersion ?? '—'} />
            <StateRow label="downloadUrl" value={updateInfo?.downloadUrl ? '✓ presente' : 'null'} warn={!updateInfo?.downloadUrl} />
            <StateRow label="isUpdating" value={String(updateProgress.isUpdating)} />
            <StateRow label="step" value={String(updateProgress.step ?? '—')} />
            <StateRow label="status" value={updateProgress.status ?? '—'} />
            <StateRow label="error" value={updateProgress.error ?? '—'} warn={!!updateProgress.error} />
          </div>
        </div>

        {/* Control groups */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>

          {/* Mock states */}
          <Section title="Stato banner (mock)">
            <BtnGroup>
              <Btn onClick={() => loadMock('available')} disabled={loading} accent>
                <Play className="w-3 h-3" /> Update disponibile
              </Btn>
              <Btn onClick={() => loadMock('error')} disabled={loading}>
                <AlertCircle className="w-3 h-3" /> Errore check
              </Btn>
              <Btn onClick={() => loadMock('uptodate')} disabled={loading}>
                <CheckCircle2 className="w-3 h-3" /> Aggiornato
              </Btn>
            </BtnGroup>
          </Section>

          {/* Progress simulation */}
          <Section title="Simulazione progress">
            <BtnGroup>
              <Btn onClick={simulateProgress} disabled={loading || updateProgress.isUpdating} accent>
                <RefreshCw className="w-3 h-3" /> Simula 5 step
              </Btn>
              <Btn onClick={simulateError} disabled={loading}>
                <AlertCircle className="w-3 h-3" /> Simula errore
              </Btn>
            </BtnGroup>
          </Section>

          {/* Real GitHub */}
          <Section title="Check reale GitHub">
            <BtnGroup>
              <Btn onClick={realCheck} disabled={loading} accent>
                <ExternalLink className="w-3 h-3" /> Check GitHub (bypass cache)
              </Btn>
              <Btn
                onClick={triggerRealUpdate}
                disabled={loading || !updateInfo?.downloadUrl}
                title={!updateInfo?.downloadUrl ? 'Prima esegui Check GitHub per ottenere il downloadUrl' : ''}
              >
                <Play className="w-3 h-3" /> Aggiornamento reale
              </Btn>
            </BtnGroup>
          </Section>

          {/* Reset */}
          <Section title="Reset">
            <BtnGroup>
              <Btn onClick={resetState} disabled={loading}>
                <Square className="w-3 h-3" /> Reset stato
              </Btn>
            </BtnGroup>
          </Section>
        </div>

        {/* URL shortcuts */}
        <div style={{
          background: '#181c25',
          border: '1px solid #2a3040',
          borderRadius: 8,
          padding: '1rem',
          marginBottom: '1.5rem',
          fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#c5a44e', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            URL diretti (testabili anche dal browser)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[
              ['Mock update disponibile', '/api/update-check?mock=available&version=99.0.0-test'],
              ['Mock errore token', '/api/update-check?mock=error'],
              ['Mock già aggiornato', '/api/update-check?mock=uptodate'],
              ['Check reale (bypass cache)', '/api/update-check?force=true'],
              ['Check reale (normale)', '/api/update-check'],
            ].map(([label, url]) => (
              <div key={url} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ color: '#9ca3af', minWidth: 200 }}>{label}</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#c5a44e', fontSize: 11, fontFamily: 'monospace', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {url}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* Log output */}
        <div style={{
          background: '#0a0d12',
          border: '1px solid #1e2435',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '0.6rem 1rem',
            borderBottom: '1px solid #1e2435',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Log
            </span>
            <button
              onClick={() => setLog([])}
              style={{ fontSize: 10, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              pulisci
            </button>
          </div>
          <div
            ref={logRef}
            style={{
              height: 260,
              overflowY: 'auto',
              padding: '0.75rem 1rem',
              fontFamily: 'monospace',
              fontSize: 11,
              lineHeight: 1.7,
            }}
          >
            {log.length === 0 && (
              <span style={{ color: '#374151' }}>Nessuna attività ancora…</span>
            )}
            {log.map((entry, i) => (
              <div key={i}>
                <span style={{ color: '#374151' }}>{entry.ts} </span>
                <span style={{ color: logColors[entry.type] ?? '#9ca3af' }}>{entry.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Small sub-components ──────────────────────────────────────────────────────

function StateRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
      <span style={{ color: '#4b5563', minWidth: 130, fontFamily: 'monospace' }}>{label}</span>
      <span style={{
        fontFamily: 'monospace',
        color: warn ? '#f87171' : value === 'true' ? '#86efac' : value === 'false' || value === '—' ? '#6b7280' : '#e8e6e3',
      }}>
        {value}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#181c25',
      border: '1px solid #2a3040',
      borderRadius: 8,
      padding: '1rem',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#c5a44e', opacity: 0.7,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem',
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{children}</div>;
}

function Btn({
  children, onClick, disabled, accent, title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderRadius: 6,
        border: accent
          ? '1px solid rgba(197,164,78,0.3)'
          : '1px solid rgba(255,255,255,0.08)',
        background: accent
          ? 'rgba(197,164,78,0.1)'
          : 'rgba(255,255,255,0.03)',
        color: accent ? '#c5a44e' : '#9ca3af',
        fontSize: 12,
        fontWeight: 500,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
      onMouseEnter={e => {
        if (!disabled) {
          e.currentTarget.style.opacity = '1';
          e.currentTarget.style.borderColor = accent ? 'rgba(197,164,78,0.6)' : 'rgba(255,255,255,0.2)';
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.opacity = disabled ? '0.4' : '1';
        e.currentTarget.style.borderColor = accent ? 'rgba(197,164,78,0.3)' : 'rgba(255,255,255,0.08)';
      }}
    >
      {children}
    </button>
  );
}
