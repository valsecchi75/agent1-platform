'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NodePackCard } from './NodePackCard';
import type { NodePackEntryWithStatus } from '@/types/nodePacks';

interface NodePackManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Tab = 'available' | 'installed';

export function NodePackManager({ open, onOpenChange }: NodePackManagerProps) {
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
      const res = await fetch('/api/node-packs/registry');
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
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col bg-neutral-900 border-neutral-700">
        <DialogHeader>
          <DialogTitle className="text-neutral-200">Node Pack Manager</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-neutral-700 mb-3">
          <button
            onClick={() => setTab('available')}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'available'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Available ({available.length})
          </button>
          <button
            onClick={() => setTab('installed')}
            className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'installed'
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-300'
            }`}
          >
            Installed ({installed.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
          {loading && (
            <div className="text-sm text-neutral-400 text-center py-8">Loading...</div>
          )}
          {error && !loading && (
            <div className="text-sm text-red-400 text-center py-4">
              {error}
              <button onClick={fetchPacks} className="block mx-auto mt-2 text-xs text-orange-400 hover:underline">
                Retry
              </button>
            </div>
          )}
          {!loading && !error && tab === 'available' && available.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-8">No new packs available</div>
          )}
          {!loading && !error && tab === 'installed' && installed.length === 0 && (
            <div className="text-sm text-neutral-500 text-center py-8">No packs installed</div>
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
        </div>

        {/* Restart banner */}
        {restartRequired && (
          <div className="flex items-center justify-between px-3 py-2 mt-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
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
