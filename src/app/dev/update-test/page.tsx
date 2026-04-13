'use client';

/**
 * /dev/update-test — Test page for the update system
 *
 * Two modes:
 * A) "See in app" → opens localhost:3000?dev-update=<mode> to see the banner
 *    exactly as the end user will see it, with the real app layout.
 * B) "Inject here" → injects state into this page's Zustand to inspect
 *    technical details and simulate progress.
 */

import { useState, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/store/workflowStore';
import { useUpdateCheck } from '@/hooks/useUpdateCheck';
import { RefreshCw, CheckCircle2, AlertCircle, Play, Square, ExternalLink, ArrowUpRight, Eye, Puzzle, Download, Trash2, RotateCcw, Package } from 'lucide-react';
import type { NodePackEntryWithStatus } from '@/types/nodePacks';

// ── URL helpers ───────────────────────────────────────────────────────────────
const APP_URL = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : 'http://localhost:3000';

const DEV_URLS: { label: string; param: string; desc: string }[] = [
  { param: 'available',      label: 'Update available (mock)',    desc: 'Gold banner with version 99.0.0-preview — "Update now" button → URL error (no download)' },
  { param: 'available-real', label: 'Real update from GitHub',    desc: 'Real GitHub check: if a newer release exists, the "Update now" button performs the real download' },
  { param: 'error',          label: 'Token error',                desc: 'Banner with GitHub authentication error' },
  { param: 'uptodate',       label: 'App up to date',             desc: 'No banner (normal situation)' },
];

const NODEPACK_DEV_URLS: { label: string; param: string; desc: string }[] = [
  { param: 'with-packs',  label: 'Dialog with 4 mock packs',  desc: 'Opens the Node Pack Manager with 4 packs: 1 installed, 1 update-available, 2 available' },
  { param: 'empty',        label: 'Empty dialog',              desc: 'Empty registry — no packs available' },
  { param: 'error',        label: 'Registry error',            desc: 'Simulates 502 error — "Cannot reach registry" message' },
  { param: 'new-packs',    label: 'New packs (trigger badge)', desc: 'All packs with very recent updatedAt — useful for testing the orange badge' },
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
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLog(prev => {
      const next = [...prev, { ts, type, msg }];
      setTimeout(() => { logRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, 30);
      return next;
    });
  }, []);

  // Inject mock state into Zustand (this page only)
  const loadMock = useCallback(async (mode: MockMode) => {
    setLoading(true);
    addLog(`Loading mock: ${mode}`, 'info');
    try {
      const res = await fetch(`/api/update-check${MOCK_API[mode]}`);
      const data = await res.json();
      addLog(`API: ${JSON.stringify(data)}`, 'data');
      setUpdateInfo(data);
      setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
      addLog(`Banner state → ${mode}`, 'ok');
    } catch (e) { addLog(`Error: ${String(e)}`, 'err'); }
    finally { setLoading(false); }
  }, [addLog, setUpdateInfo, setUpdateProgress]);

  // Real GitHub check
  const realCheck = useCallback(async () => {
    setLoading(true);
    addLog('Real GitHub check (bypass cache)…', 'info');
    try {
      const res = await fetch('/api/update-check?force=true');
      const data = await res.json();
      addLog(`Response: ${JSON.stringify(data)}`, 'data');
      setUpdateInfo(data);
      setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
      addLog(data.updateAvailable ? `✓ v${data.latestVersion} available` : `✓ Up to date (${data.currentVersion})`, 'ok');
    } catch (e) { addLog(`Error: ${String(e)}`, 'err'); }
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
    addLog('Simulating progress…', 'info');
    for (const s of steps) {
      await new Promise(r => setTimeout(r, 900));
      setUpdateProgress({ isUpdating: true, step: s.step, status: s.status, error: null });
      addLog(`Step ${s.step}/5: ${s.status}`, 'info');
    }
    await new Promise(r => setTimeout(r, 600));
    setUpdateProgress({ isUpdating: false, step: null, status: 'restart_required', error: null });
    addLog('✓ restart required', 'ok');
  }, [addLog, setUpdateProgress]);

  const simulateError = useCallback(() => {
    setUpdateProgress({ isUpdating: false, step: null, status: null, error: 'Download failed (403) — simulation' });
    addLog('Error injected into banner', 'err');
  }, [addLog, setUpdateProgress]);

  const resetState = useCallback(() => {
    setUpdateInfo(null);
    setUpdateProgress({ isUpdating: false, step: null, status: null, error: null });
    setLog([]);
  }, [setUpdateInfo, setUpdateProgress]);

  const triggerRealUpdate = useCallback(async () => {
    if (!updateInfo?.downloadUrl) { addLog('⚠ downloadUrl null — do "Real GitHub check" first', 'err'); return; }
    addLog(`Starting update → ${updateInfo.downloadUrl}`, 'info');
    await applyUpdate();
    addLog('applyUpdate() completed', 'ok');
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
            <strong style={{ color: '#9ca3af' }}>Update</strong>: Section A (real app) + B (debug)
            — <strong style={{ color: '#9ca3af' }}>Node Pack Manager</strong>: Section A (real app with
            <code style={{ background: '#1a1e2c', padding: '1px 6px', borderRadius: 3, color: '#c5a44e', fontSize: 11, margin: '0 4px' }}>
              ?dev-nodepacks=
            </code>) + B (technical debug)
          </p>
        </div>

        {/* ── SECTION A: View in real app ──────────────────────────────────── */}
        <SectionHeader label="A" title="See in real app" subtitle="Opens localhost:3000 with the ?dev-update= param — see exactly what the user sees" />
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
                  Open
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
                  title="Open in new tab"
                >
                  <ArrowUpRight className="w-3 h-3" />
                  New tab
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
        <SectionHeader label="B" title="Technical debug (this page)" subtitle="The banner above reflects this page's Zustand state" />

        {/* State readout */}
        <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#c5a44e', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Current state (Zustand)</div>
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
          <Section title="Banner state (mock)">
            <BtnGroup>
              <Btn onClick={() => loadMock('available')} disabled={loading} accent><Play className="w-3 h-3" />Update available</Btn>
              <Btn onClick={() => loadMock('error')} disabled={loading}><AlertCircle className="w-3 h-3" />Check error</Btn>
              <Btn onClick={() => loadMock('uptodate')} disabled={loading}><CheckCircle2 className="w-3 h-3" />Already up to date</Btn>
            </BtnGroup>
          </Section>

          <Section title="Progress simulation">
            <BtnGroup>
              <Btn onClick={simulateProgress} disabled={loading || updateProgress.isUpdating} accent><RefreshCw className="w-3 h-3" />Simulate 5 steps</Btn>
              <Btn onClick={simulateError} disabled={loading}><AlertCircle className="w-3 h-3" />Simulate error</Btn>
            </BtnGroup>
          </Section>

          <Section title="Real GitHub check">
            <BtnGroup>
              <Btn onClick={realCheck} disabled={loading} accent><ExternalLink className="w-3 h-3" />GitHub check (bypass cache)</Btn>
              <Btn onClick={triggerRealUpdate} disabled={loading || !updateInfo?.downloadUrl}
                title={!updateInfo?.downloadUrl ? 'Run GitHub check first' : ''}>
                <Play className="w-3 h-3" />Real update
              </Btn>
            </BtnGroup>
          </Section>

          <Section title="Reset">
            <BtnGroup>
              <Btn onClick={resetState} disabled={loading}><Square className="w-3 h-3" />Reset all</Btn>
            </BtnGroup>
          </Section>
        </div>

        {/* Log */}
        <div style={{ background: '#0a0d12', border: '1px solid #1e2435', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #1e2435', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Log</span>
            <button onClick={() => setLog([])} style={{ fontSize: 10, color: '#4b5563', background: 'none', border: 'none', cursor: 'pointer' }}>clear</button>
          </div>
          <div ref={logRef} style={{ height: 220, overflowY: 'auto', padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7 }}>
            {log.length === 0 && <span style={{ color: '#374151' }}>No activity…</span>}
            {log.map((e, i) => (
              <div key={i}>
                <span style={{ color: '#374151' }}>{e.ts} </span>
                <span style={{ color: logColors[e.type] ?? '#9ca3af' }}>{e.msg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ── NODE PACK MANAGER — SECTION A: View in real app ─────── */}
        <div style={{ marginTop: '3rem', borderTop: '1px solid #2a3040', paddingTop: '2rem' }}>
          <SectionHeader label="A" title="Node Pack Manager — See in real app" subtitle="Opens localhost:3000 with ?dev-nodepacks= — the dialog opens automatically with mock data" />
          <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '2rem' }}>
            {NODEPACK_DEV_URLS.map(({ param, label, desc }) => (
              <div key={param} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                background: '#181c25', border: '1px solid #2a3040',
                borderRadius: 8, padding: '0.75rem 1rem',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e6e3', marginBottom: '2px' }}>
                    <Puzzle className="w-3 h-3" style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                    {label}
                  </div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>{desc}</div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  <a
                    href={`/?dev-nodepacks=${param}`}
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
                    Open
                  </a>
                  <a
                    href={`/?dev-nodepacks=${param}`}
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
                    title="Open in new tab"
                  >
                    <ArrowUpRight className="w-3 h-3" />
                    New tab
                  </a>
                </div>
              </div>
            ))}
          </div>

          {/* URL quick reference */}
          <div style={{ background: '#0e1118', border: '1px solid #1e2435', borderRadius: 6, padding: '0.75rem 1rem', marginBottom: '2rem', fontSize: 11 }}>
            <span style={{ color: '#4b5563', marginRight: '0.5rem' }}>URLs:</span>
            {NODEPACK_DEV_URLS.map(({ param }, i) => (
              <span key={param}>
                <code style={{ color: '#c5a44e' }}>{`/?dev-nodepacks=${param}`}</code>
                {i < NODEPACK_DEV_URLS.length - 1 && <span style={{ color: '#374151' }}> · </span>}
              </span>
            ))}
          </div>
        </div>

        {/* ── NODE PACK MANAGER — SECTION B: Debug controls ──────── */}
        <div style={{ marginTop: '1rem' }}>
          <NodePackTestSection addLog={addLog} />
        </div>

      </div>
    </div>
  );
}

// ── Node Pack Manager Test Section ────────────────────────────────────────────

function NodePackTestSection({ addLog }: { addLog: (msg: string, type?: 'info' | 'ok' | 'err' | 'data') => void }) {
  const [packs, setPacks] = useState<NodePackEntryWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [restartRequired, setRestartRequired] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string>('—');
  const [activeTypes, setActiveTypes] = useState<string[]>([]);

  const nodePackBadge = useWorkflowStore((s) => s.nodePackBadgeActive);
  const setNodePackBadge = useWorkflowStore((s) => s.setNodePackBadge);
  const storeActiveTypes = useWorkflowStore((s) => s.activeNodeTypes);

  // Fetch registry
  const fetchRegistry = useCallback(async () => {
    setLoading(true);
    addLog('Fetch registry /api/node-packs/registry…', 'info');
    try {
      const res = await fetch('/api/node-packs/registry');
      const data = await res.json();
      addLog(`Registry response: success=${data.success}, source=${data.source}, packs=${data.packs?.length ?? 0}`, 'data');
      if (data.success && data.packs) {
        setPacks(data.packs);
        addLog(`✓ ${data.packs.length} pack(s) found — source: ${data.source}`, 'ok');
      } else {
        addLog(`✗ ${data.error || 'Unknown error'}`, 'err');
      }
    } catch (e) { addLog(`✗ Fetch failed: ${String(e)}`, 'err'); }
    finally { setLoading(false); }
  }, [addLog]);

  // Fetch active types
  const fetchActiveTypes = useCallback(async () => {
    addLog('Fetch /api/node-registry/active-types…', 'info');
    try {
      const res = await fetch('/api/node-registry/active-types');
      const data = await res.json();
      setActiveTypes(data.nodeTypes || []);
      addLog(`✓ ${data.nodeTypes?.length ?? 0} active types, ${data.packCount ?? 0} pack(s)`, 'ok');
    } catch (e) { addLog(`✗ ${String(e)}`, 'err'); }
  }, [addLog]);

  // Health check
  const checkHealth = useCallback(async () => {
    addLog('Health check /api/health…', 'info');
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthStatus(`${data.status} — v${data.version}`);
      addLog(`✓ status=${data.status}, version=${data.version}`, 'ok');
    } catch (e) {
      setHealthStatus('offline');
      addLog(`✗ Server offline: ${String(e)}`, 'err');
    }
  }, [addLog]);

  // Install pack
  const installPack = useCallback(async (packId: string) => {
    addLog(`Installing pack: ${packId}…`, 'info');
    try {
      const res = await fetch('/api/node-packs/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`✓ Pack ${packId} installed (v${data.version}) — restart required`, 'ok');
        setRestartRequired(true);
        await fetchRegistry();
      } else {
        addLog(`✗ Install failed: ${data.error}`, 'err');
      }
    } catch (e) { addLog(`✗ ${String(e)}`, 'err'); }
  }, [addLog, fetchRegistry]);

  // Uninstall pack
  const uninstallPack = useCallback(async (packId: string) => {
    addLog(`Uninstalling pack: ${packId}…`, 'info');
    try {
      const res = await fetch('/api/node-packs/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (data.success) {
        addLog(`✓ Pack ${packId} removed — restart required`, 'ok');
        setRestartRequired(true);
        await fetchRegistry();
      } else {
        addLog(`✗ Uninstall failed: ${data.error}`, 'err');
      }
    } catch (e) { addLog(`✗ ${String(e)}`, 'err'); }
  }, [addLog, fetchRegistry]);

  // Try uninstall core (should fail)
  const tryUninstallCore = useCallback(async () => {
    addLog('Test core protection: uninstall agent1-foundation…', 'info');
    try {
      const res = await fetch('/api/node-packs/uninstall', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: 'agent1-foundation' }),
      });
      const data = await res.json();
      if (!data.success) {
        addLog(`✓ Correctly rejected: "${data.error}" (HTTP ${res.status})`, 'ok');
      } else {
        addLog('✗ ERROR: core pack deleted! This should not happen!', 'err');
      }
    } catch (e) { addLog(`✗ ${String(e)}`, 'err'); }
  }, [addLog]);

  // Restart server
  const triggerRestart = useCallback(async () => {
    addLog('Sending POST /api/restart…', 'info');
    setRestarting(true);
    try {
      await fetch('/api/restart', { method: 'POST' });
      addLog('✓ Restart requested — polling health every 2s…', 'ok');
      const maxWait = 30000;
      const interval = 2000;
      const start = Date.now();
      const poll = () => {
        if (Date.now() - start > maxWait) {
          setRestarting(false);
          setHealthStatus('timeout');
          addLog('✗ Server did not respond within 30s', 'err');
          return;
        }
        fetch('/api/health')
          .then((res) => {
            if (res.ok) {
              setRestarting(false);
              setRestartRequired(false);
              setHealthStatus('online (restarted)');
              addLog('✓ Server restarted successfully!', 'ok');
            } else {
              setTimeout(poll, interval);
            }
          })
          .catch(() => {
            addLog(`… server offline, retry (${Math.round((Date.now() - start) / 1000)}s)…`, 'info');
            setTimeout(poll, interval);
          });
      };
      setTimeout(poll, interval);
    } catch (e) {
      setRestarting(false);
      addLog(`✗ Restart failed: ${String(e)}`, 'err');
    }
  }, [addLog]);

  // Toggle badge
  const toggleBadge = useCallback(() => {
    const next = !nodePackBadge;
    setNodePackBadge(next);
    addLog(`Badge → ${next ? 'ACTIVE (orange)' : 'off'}`, next ? 'ok' : 'info');
  }, [addLog, nodePackBadge, setNodePackBadge]);

  const available = packs.filter(p => p.status === 'available');
  const installed = packs.filter(p => p.status === 'installed' || p.status === 'update-available');
  const updatable = packs.filter(p => p.status === 'update-available');

  return (
    <>
      <SectionHeader label="B" title="Node Pack Manager — Technical debug" subtitle="Full test: registry, install, uninstall, restart, badge" />

      {/* State readout */}
      <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 8, padding: '1rem', marginBottom: '1rem', fontSize: 12 }}>
        <div style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#c5a44e', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Node Pack Manager state</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
          <StateRow label="packs (registry)" value={packs.length > 0 ? `${packs.length} (${available.length} available, ${installed.length} installed, ${updatable.length} updates)` : '—'} />
          <StateRow label="health" value={healthStatus} warn={healthStatus === 'offline' || healthStatus === 'timeout'} />
          <StateRow label="restartRequired" value={String(restartRequired)} warn={restartRequired} />
          <StateRow label="restarting" value={String(restarting)} />
          <StateRow label="badge (Zustand)" value={String(nodePackBadge)} />
          <StateRow label="activeNodeTypes" value={storeActiveTypes.length > 0 ? `${storeActiveTypes.length} types` : '—'} />
          <StateRow label="activeTypes (API)" value={activeTypes.length > 0 ? `${activeTypes.length} types` : '—'} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Registry & Health */}
        <Section title="Registry & Health">
          <BtnGroup>
            <Btn onClick={fetchRegistry} disabled={loading} accent><Package className="w-3 h-3" />Fetch Registry</Btn>
            <Btn onClick={fetchActiveTypes} disabled={loading}><Puzzle className="w-3 h-3" />Fetch Active Types</Btn>
            <Btn onClick={checkHealth} disabled={loading}><CheckCircle2 className="w-3 h-3" />Health Check</Btn>
          </BtnGroup>
        </Section>

        {/* Badge & UI */}
        <Section title="Badge & UI">
          <BtnGroup>
            <Btn onClick={toggleBadge} accent><Eye className="w-3 h-3" />{nodePackBadge ? 'Turn off badge' : 'Turn on badge'}</Btn>
            <Btn onClick={() => {
              addLog('Note: the Node Pack Manager dialog is accessible from the Puzzle button in the header (near Settings)', 'info');
            }}><Puzzle className="w-3 h-3" />Info: open from Header</Btn>
          </BtnGroup>
        </Section>

        {/* Install/Uninstall */}
        <Section title="Install / Uninstall">
          <BtnGroup>
            {available.length > 0 ? (
              available.map(p => (
                <Btn key={p.id} onClick={() => installPack(p.id)} disabled={loading} accent>
                  <Download className="w-3 h-3" />Install: {p.name} (v{p.version})
                </Btn>
              ))
            ) : (
              <Btn onClick={() => addLog('No packs available for install — do "Fetch Registry" first', 'info')} disabled={loading}>
                <Download className="w-3 h-3" />No packs available
              </Btn>
            )}
            {installed.filter(p => p.id !== 'agent1-foundation').length > 0 ? (
              installed.filter(p => p.id !== 'agent1-foundation').map(p => (
                <Btn key={`un-${p.id}`} onClick={() => uninstallPack(p.id)} disabled={loading}>
                  <Trash2 className="w-3 h-3" />Uninstall: {p.name}
                </Btn>
              ))
            ) : null}
          </BtnGroup>
        </Section>

        {/* Safety & Restart */}
        <Section title="Safety & Restart">
          <BtnGroup>
            <Btn onClick={tryUninstallCore}><AlertCircle className="w-3 h-3" />Test: uninstall core (deve fallire)</Btn>
            <Btn onClick={triggerRestart} disabled={restarting} accent>
              <RotateCcw className="w-3 h-3" />{restarting ? 'Restarting…' : 'Restart Server'}
            </Btn>
          </BtnGroup>
        </Section>
      </div>

      {/* Pack list detail */}
      {packs.length > 0 && (
        <div style={{ background: '#181c25', border: '1px solid #2a3040', borderRadius: 8, padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#c5a44e', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Packs in registry ({packs.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {packs.map(p => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '0.6rem 0.75rem', borderRadius: 6,
                background: p.status === 'installed' ? 'rgba(134,239,172,0.05)' : p.status === 'update-available' ? 'rgba(147,197,253,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${p.status === 'installed' ? 'rgba(134,239,172,0.15)' : p.status === 'update-available' ? 'rgba(147,197,253,0.15)' : 'rgba(255,255,255,0.06)'}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#e8e6e3' }}>
                    {p.name}
                    <span style={{
                      marginLeft: 8, fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 700,
                      background: p.status === 'installed' ? 'rgba(134,239,172,0.15)' : p.status === 'update-available' ? 'rgba(147,197,253,0.15)' : 'rgba(197,164,78,0.15)',
                      color: p.status === 'installed' ? '#86efac' : p.status === 'update-available' ? '#93c5fd' : '#c5a44e',
                    }}>{p.status.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                    {p.id} · v{p.version} · {p.nodeCount} node(s) · by {p.author}
                    {p.installedVersion && <span> · installed: v{p.installedVersion}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active types detail */}
      {activeTypes.length > 0 && (
        <div style={{ background: '#0e1118', border: '1px solid #1e2435', borderRadius: 6, padding: '0.75rem 1rem', fontSize: 11, marginBottom: '1.5rem' }}>
          <span style={{ color: '#4b5563', marginRight: '0.5rem' }}>Active types ({activeTypes.length}):</span>
          <span style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{activeTypes.join(', ')}</span>
        </div>
      )}
    </>
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
