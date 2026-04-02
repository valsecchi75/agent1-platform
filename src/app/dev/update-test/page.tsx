'use client';

/**
 * /dev/update-test — Pagina di test per il sistema di aggiornamento
 *
 * Due modalità:
 * A) "Vedi nell'app" → apre localhost:3000?dev-update=<mode> per vedere il banner
 *    esattamente come lo vedrà l'utente finale, con il vero layout dell'app.
 * B) "Inietta qui" → inietta lo stato nel Zustand di questa pagina per ispezionare
 *    i dettagli tecnici e simulare il progress.
 */

import { useState, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { RefreshCw, CheckCircle2, AlertCircle, Play, Square, ExternalLink, ArrowUpRight, Eye } from 'lucide-react';

// ── URL helpers ───────────────────────────────────────────────────────────────
const APP_URL = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:3000';

const DEV_URLS: { label: string; param: string; desc: string }[] = [
  { param: 'available',      label: 'Update disponibile (mock)',  desc: 'Banner oro con versione 99.0.0-preview — bottone "Aggiorna ora" → errore URL (nessun download)' },
  { param: 'available-real', label: 'Update reale da GitHub',     desc: 'Check reale GitHub: se esiste una release più nuova, il bottone "Aggiorna ora" fa il vero download' },
  { param: 'error',          label: 'Errore token',               desc: 'Banner con errore di autenticazione GitHub' },
  { param: 'uptodate',       label: 'App aggiornata',             desc: 'Nessun banner (situazione normale)' },
];

type MockMode = 'available' | 'error' | 'uptodate';

const MOCK_API: Record<MockMode, string> = {
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
      setTimeout(() => { logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, 30);
      return next;
    });
  }, []);

  // Inject mock state into Zustand (this page only)
  const loadMock = useCallback(async (mode: MockMode) => {
    setLoading(true);
    addLog(`Carico mock: ${mode}`, 'info');
    try {
      const res = await fetch(`/api/update-check${MOCK_API[mode]}`);
      const data = await res.json();
      addLog(`API: ${JSON.stringify(data)}`, 'data');
      setUpdateInfo(data);
      setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
      addLog(`Stato banner → ${mode}`, 'ok');
    } catch (e) { addLog(`Errore: ${String(e)}`, 'err'); }
    finally { setLoading(false); }
  }, [addLog, setUpdateInfo, setUpdateProgress]);

  // Real GitHub check
  const realCheck = useCallback(async () => {
    setLoading(true);
    addLog('Check reale GitHub (bypass cache)…', 'info');
    try {
      const res = await fetch('/api/update-check?force=true');
      const data = await res.json();
      addLog(`Risposta: ${JSON.stringify(data)}`, 'data');
      setUpdateInfo(data);
      setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
      addLog(data.updateAvailable ? `✓ v${data.latestVersion} disponibile` : `✓ Aggiornata (${data.currentVersion})`, 'ok');
    } catch (e) { addLog(`Errore: ${String(e)}`, 'err'); }
    finally { setLoading(false); }
  }, [addLog, setUpdateInfo, setUpdateProgress]);

  // Simulate 5-step progress animation
  const simulateProgress = useCallback(async () => {
    const steps = [
      { step: 1, status: 'downloading' }, { step: 2, status: 'extracting' },
      { step: 3, status: 'backup' },      { step: 4, status: 'replacing' },
      { step: 5, status: 'npm_install' },
    ];
    setUpdateProgress({ isUpdating: true, step: null, status: 'starting', error: null });
    addLog('Simulazione progress…', 'info');
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 900));
      setUpdateProgress({ isUpdating: true, step: s.step, status: s.status, error: null });
      addLog(`Step ${s.step}/5: ${s.status}`, 'info');
    }
    await new Promise(r => setTimeout(r, 600));
    setUpdateProgress({ isUpdating: false, step: null, status: 'restart_required', error: null });
    addLog('✓ restart_required', 'ok');
  }, [addLog, setUpdateProgress]);

  const simulateError = useCallback(() => {
    setUpdateProgress({ isUpdating: false, step: null, status: null, error: 'Download failed (403) — simulazione' });
    addLog('Errore iniettato nel banner', 'err');
  }, [addLog, setUpdateProgress]);

  const resetState = useCallback(() => {
    setUpdateInfo(null);
    setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
    setLog([]);
  }, [setUpdateInfo, setUpdateProgress]);

  const triggerRealUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) { addLog('⚠ downloadUrl null — fai "Check reale GitHub" prima', 'err'); return; }
    addLog(`Avvio aggiornamento → ${updateInfo.downloadUrl}`, 'info');
    await applyUpdate();
    addLog('applyUpdate() completato', 'ok');
  }, [addLog, applyUpdate, updateInfo]);

  const logColors: Record<string, string> = { info: '#9ca3af', ok: '#86efac', err: '#fca5a5', data: '#93c5fd' };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f14', color: '#e8e6e3', fontFamily: 'system-ui,sans-serif', padding: '2rem' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#c5a44e', opacity: 0.7, textTransform: 'uppercase' }}>AGENT 1</span>
            <span style={{ fontSize: 18, fontWeight: 700 }}>Update Test Lab</span>
            <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: 'rgba(197,164,78,0.12)', border: '1px solid rgba(197,164,78,0.2)', color: '#c5a44e' }}>DEV ONLY</span>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
            Sezione <strong style={{ color: '#9ca3af' }}>A</strong>: vedi il banner nell&apos;app reale aprendo
            <code style={{ background: '#1a1e2c', padding: '1px 6px', borderRadius: 3, color: '#c5a44e', fontSize: 11, margin: '0 4px' }}>
              /?dev-update=&lt;mode&gt;
            </code>
            — Sezione <strong style={{ color: '#9ca3af' }}>B</strong>: inietta lo stato in questa pagina per debug tecnico.
          </p>
        </div>

        {/* ── SECTION A: View in real app ──────────────────────────────────── */}
        <SectionHeader label="A" title="Vedi nell'app reale" subtitle="Apre localhost:3000 con il param ?dev-update= — vedi esattamente cosa vede l'utente" />
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '2rem' }}>
          {DEV_URLS.map(({ param, label, desc }) => (
            <div key={param} style={{
              display: 'flex', alignItems: 'center', gap: '1rem',
              background: '#181c25', border: '1px solid #2a3040',
              borderRadius: 8, padding: '0.75rem 1rem',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e6e3', marginBottom: '2px' }}>{label}</div>
                <div style={{ fontSize: 11, color: '#6b7280' }}>{desc}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                {/* Open in same tab */}
                <a
                  href={`/?dev-update=${param}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    background: 'rgba(197,164,78,0.1)', border: '1px solid rgba(197,164,78,0.25)',
                    color: '#c5a44e', textDecoration: 'none', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(197,164,78,0.2)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(197,164,78,0.1)'; }}
                >
                  <Eye className="w-3 h-3" />
                  Apri
                </a>
                {/* Open in new tab */}
                <a
                  href={`/?dev-update=${param}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.75rem', borderRadius: 6, fontSize: 11, fontWeight: 500,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#9ca3af', textDecoration: 'none', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#e8e6e3'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; }}
                  title="Apri in nuova scheda"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  Nuova scheda
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* URL quick reference */}
        <div style={{ background: '#0e1118', border: '1px solid #1e2435', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '2rem', fontSize: 11 }}>
          <span style={{ color: '#4b5563', marginRight: '0.5rem' }}>URLs:</span>
          {DEV_URLS.map(({ param }, i) => (
            <span key={param}>
              <code style={{ color: '#c5a44e' }}>{`/?dev-update=${param}`}</code>
              {i < DEV_URLS.length - 1 && <span style={{ color: '#374151' }}> · </span>}
            </span>
          ))}
        </div>

        {/* ── SECTION B: Inject state into this page ───────────────────────── */}
        <SectionHeader label="B" title="Debug tecnico (questa pagina)" subtitle="Il banner sopra riflette lo stato Zustand di questa pagina" />

        {/* State readout */}
        <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#c5a44e', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Stato corrente (Zustand)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
            <StateRow label="updateAvailable" value={String(updateInfo?.updateAvailable ?? '—')} />
            <StateRow label="currentVersion"  value={updateInfo?.currentVersion ?? '—'} />
            <StateRow label="latestVersion"   value={updateInfo?.latestVersion ?? '—'} />
            <StateRow label="downloadUrl"     value={updateInfo?.downloadUrl ? '✓ presente' : 'null'} warn={!updateInfo?.downloadUrl} />
            <StateRow label="isUpdating"      value={String(updateProgress.isUpdating)} />
            <StateRow label="step"            value={String(updateProgress.step ?? '—')} />
            <StateRow label="status"          value={updateProgress.status ?? '—'} />
            <StateRow label="error"           value={updateProgress.error ?? '—'} warn={!!updateProgress.error} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <Section title="Stato banner (mock)">
            <BtnGroup>
              <Btn onClick={() => loadMock('available')} disabled={loading} accent><Play className="w-3 h-3" />Update disponibile</Btn>
              <Btn onClick={() => loadMock('error')} disabled={loading}><AlertCircle className="w-3 h-3" />Errore check</Btn>
              <Btn onClick={() => loadMock('uptodate')} disabled={loading}><CheckCircle2 className="w-3 h-3" />Già aggiornato</Btn>
            </BtnGroup>
          </Section>

          <Section title="Simulazione progress">
            <BtnGroup>
              <Btn onClick={simulateProgress} disabled={loading || updateProgress.isUpdating} accent><RefreshCw className="w-3 h-3" />Simula 5 step</Btn>
              <Btn onClick={simulateError} disabled={loading}><AlertCircle className="w-3 h-3" />Simula errore</Btn>
            </BtnGroup>
          </Section>

          <Section title="Check reale GitHub">
            <BtnGroup>
              <Btn onClick={realCheck} disabled={loading} accent><ExternalLink className="w-3 h-3" />Check GitHub (bypass cache)</Btn>
              <Btn onClick={triggerRealUpdate} disabled={loading || !updateInfo?.downloadUrl}
                title={!updateInfo?.downloadUrl ? 'Prima esegui Check GitHub' : ''}>
                <Play className="w-3 h-3" />Aggiornamento reale
              </Btn>
            </BtnGroup>
          </Section>

          <Section title="Reset">
            <BtnGroup>
              <Btn onClick={resetState} disabled={loading}><Square className="w-3 h-3" />Reset tutto</Btn>
            </BtnGroup>
          </Section>
        </div>

        {/* Log */}
        <div style={{ background: '#0a0d12', border: '1px solid #1e2435', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #1e2435', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Log</span>
            <button onClick={() => setLog([])} style={{ fontSize: 10, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>pulisci</button>
          </div>
          <div ref={logRef} style={{ height: 220, overflowY: 'auto', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
            {log.length === 0 && <span style={{ color: '#374151' }}>Nessuna attività…</span>}
            {log.map((e, i) => (
              <div key={i}>
                <span style={{ color: '#374151' }}>{e.ts} </span>
                <span style={{ color: logColors[e.type] ?? '#9ca3af' }}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ label, title, subtitle }: { label: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '0.75rem' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 20, height: 20, borderRadius: '50%',
        background: 'rgba(197,164,78,0.15)', border: '1px solid rgba(197,164,78,0.3)',
        color: '#c5a44e', fontSize: 10, fontWeight: 700, flexShrink: 0,
      }}>{label}</span>
      <div>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#e8e6e3' }}>{title}</span>
        <span style={{ fontSize: 11, color: '#4b5563', marginLeft: '0.5rem' }}>{subtitle}</span>
      </div>
    </div>
  );
}

function StateRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline' }}>
      <span style={{ color: '#4b5563', minWidth: 130, fontFamily: 'monospace' }}>{label}</span>
      <span style={{ fontFamily: 'monospace', color: warn ? '#f87171' : value === 'true' ? '#86efac' : value === 'false' || value === '—' ? '#6b7280' : '#e8e6e3' }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 8, padding: '1rem' }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#c5a44e', opacity: 0.7, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>{title}</div>
      {children}
    </div>
  );
}

function BtnGroup({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>{children}</div>;
}

function Btn({ children, onClick, disabled, accent, title }: {
  children: React.ReactNode; onClick: () => void; disabled?: boolean; accent?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      display: 'flex', alignItems: 'center', gap: '0.5rem',
      padding: '0.5rem 0.75rem', borderRadius: 6, fontSize: 12, fontWeight: 500,
      border: accent ? '1px solid rgba(197,164,78,0.3)' : '1px solid rgba(255,255,255,0.08)',
      background: accent ? 'rgba(197,164,78,0.1)' : 'rgba(255,255,255,0.03)',
      color: accent ? '#c5a44e' : '#9ca3af',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
      transition: 'all 0.15s', textAlign: 'left',
    }}
    onMouseEnter={e => { if (!disabled) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = accent ? 'rgba(197,164,78,0.6)' : 'rgba(255,255,255,0.2)'; } }}
    onMouseLeave={e => { e.currentTarget.style.opacity = disabled ? '0.4' : '1'; e.currentTarget.style.borderColor = accent ? 'rgba(197,164,78,0.3)' : 'rgba(255,255,255,0.08)'; }}
    >
      {children}
    </button>
  );
}
