'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTabs, DialogBody } from '@/components/ui/dialog';
import { NodePackCard } from './NodePackCard';
import type { NodePackEntryWithStatus } from '@/types/nodePacks';

interface NodePackManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dev only: pass mock mode to registry API (?mock=with-packs|empty|error|new-packs) */
  mockMode?: string | null;
}

type Tab = 'available' | 'installed';

export function NodePackManager({ open, onOpenChange, mockMode }: NodePackManagerProps) {
  const [tab, setTab] = useState<Tab>('available');
  const [packs, setPacks] = useState<NodePackEntryWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [appVersion, setAppVersion] = useState('0.0.0');

  const fetchPacks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = mockMode
        ? `/api/node-packs/registry?mock=${encodeURIComponent(mockMode)}`
        : '/api/node-packs/registry';
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPacks(data.packs || []);
      } else {
        setError(data.error || 'Failed to fetch registry');
      }
    } catch {
      setError('Cannot reach registry. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchPacks();
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => setAppVersion(data.version || '0.0.0'))
      .catch(() => {});
  }, [open, fetchPacks]);

  const handleInstall = async (packId: string) => {
    const res = await fetch('/api/node-packs/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Install failed');
    setRestartRequired(true);
    await fetchPacks();
  };

  const handleUninstall = async (packId: string) => {
    const res = await fetch('/api/node-packs/uninstall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ packId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Uninstall failed');
    setRestartRequired(true);
    await fetchPacks();
  };

  const handleUpdate = async (packId: string) => {
    await handleInstall(packId);
  };

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await fetch('/api/restart', { method: 'POST' });
      const maxWait = 30000;
      const interval = 2000;
      const start = Date.now();
      const poll = () => {
        if (Date.now() - start > maxWait) {
          setRestarting(false);
          setError('Server did not restart. Please close and reopen the app manually.');
          return;
        }
        fetch('/api/health')
          .then((res) => {
            if (res.ok) {
              window.location.reload();
            } else {
              setTimeout(poll, interval);
            }
          })
          .catch(() => {
            setTimeout(poll, interval);
          });
      };
      setTimeout(poll, interval);
    } catch {
      setRestarting(false);
      setError('Failed to restart. Please close and reopen the app manually.');
    }
  };

  const available = packs.filter((p) => p.status === 'available');
  const installed = packs.filter((p) => p.status === 'installed' || p.status === 'update-available');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Node Pack Manager</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <DialogTabs
          tabs={[
            { id: 'available', label: `Available (${available.length})` },
            { id: 'installed', label: `Installed (${installed.length})` },
          ]}
          active={tab}
          onChange={(id) => setTab(id as Tab)}
        />

        {/* Content */}
        <DialogBody className="space-y-2">
          {loading && (
            <div className="text-sm text-[var(--text-secondary)] text-center py-8">Loading...</div>
          )}
          {error && !loading && (
            <div className="text-sm text-red-400 text-center py-4">
              {error}
              <button onClick={fetchPacks} className="block mx-auto mt-2 text-xs text-[var(--accent)] hover:underline">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && tab === 'available' && available.length === 0 && (
            <div className="text-sm text-[var(--text-muted)] text-center py-8">No new packs available</div>
          )}
          {!loading && !error && tab === 'installed' && installed.length === 0 && (
            <div className="text-sm text-[var(--text-muted)] text-center py-8">No packs installed</div>
          )}

          {!loading && (tab === 'available' ? available : installed).map((pack) => (
            <NodePackCard
              key={pack.id}
              pack={pack}
              appVersion={appVersion}
              onInstall={handleInstall}
              onUninstall={handleUninstall}
              onUpdate={handleUpdate}
            />
          ))}
        </DialogBody>

        {/* Restart banner */}
        {restartRequired && (
          <div className="shrink-0 flex items-center justify-between px-6 py-4 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30 -mx-6 -mb-6 px-6">
            <span className="text-xs text-amber-400">Restart required to activate changes</span>
            <button
              onClick={handleRestart}
              disabled={restarting}
              className="px-3 py-1 text-xs font-medium rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 disabled:opacity-50"
            >
              {restarting ? 'Restarting...' : 'Restart Now'}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
