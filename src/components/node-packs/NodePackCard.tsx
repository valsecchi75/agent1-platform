'use client';

import { useState } from 'react';
import type { NodePackEntryWithStatus } from '@/types/nodePacks';

interface NodePackCardProps {
  pack: NodePackEntryWithStatus;
  isNew?: boolean;
  appVersion: string;
  onInstall: (packId: string) => Promise<void>;
  onUninstall: (packId: string) => Promise<void>;
  onUpdate: (packId: string) => Promise<void>;
}

export function NodePackCard({
  pack,
  isNew,
  appVersion,
  onInstall,
  onUninstall,
  onUpdate,
}: NodePackCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const versionCompatible = !pack.minAppVersion || appVersion >= pack.minAppVersion;

  const handleAction = async (action: (id: string) => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action(pack.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg bg-neutral-800/50 border border-neutral-700/50 hover:border-neutral-600/50 transition-colors">
      {/* Preview image */}
      <div className="w-16 h-16 flex-shrink-0 rounded-md bg-neutral-700/50 overflow-hidden flex items-center justify-center">
        {pack.previewPath ? (
          <img
            src={`/api/node-packs/preview?path=${encodeURIComponent(pack.previewPath)}`}
            alt={pack.name}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <span className="text-neutral-500 text-xs">No preview</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-neutral-200 truncate">{pack.name}</span>
          {isNew && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-orange-500/20 text-orange-400 rounded">NEW</span>
          )}
          {pack.status === 'installed' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-green-500/20 text-green-400 rounded">Installed</span>
          )}
          {pack.status === 'update-available' && (
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/20 text-blue-400 rounded">Update</span>
          )}
        </div>
        <div className="text-xs text-neutral-400 mt-0.5">
          {pack.nodeCount} node{pack.nodeCount !== 1 ? 's' : ''} · v{pack.version} · by {pack.author}
        </div>
        <div className="text-xs text-neutral-500 mt-1 line-clamp-2">{pack.description}</div>
        {error && <div className="text-xs text-red-400 mt-1">{error}</div>}
        {!versionCompatible && (
          <div className="text-xs text-amber-400 mt-1">Requires app v{pack.minAppVersion}+</div>
        )}
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex items-start">
        {pack.status === 'available' && (
          <button
            onClick={() => handleAction(onInstall)}
            disabled={loading || !versionCompatible}
            className="px-3 py-1.5 text-xs font-medium rounded bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Installing...' : 'Install'}
          </button>
        )}
        {pack.status === 'update-available' && (
          <button
            onClick={() => handleAction(onUpdate)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Updating...' : 'Update'}
          </button>
        )}
        {pack.status === 'installed' && !pack.installedVersion?.startsWith('core') && (
          <button
            onClick={() => handleAction(onUninstall)}
            disabled={loading}
            className="px-3 py-1.5 text-xs font-medium rounded bg-neutral-700/50 text-neutral-400 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Removing...' : 'Uninstall'}
          </button>
        )}
      </div>
    </div>
  );
}
