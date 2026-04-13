"use client";

import { useState } from "react";
import type { NodePackEntryWithStatus } from "@/types/nodePacks";

interface NodePackRowProps {
  index: number;
  pack: NodePackEntryWithStatus;
  isCore: boolean;
  isUsedInWorkflow: boolean;
  appVersion: string;
  onInstall: (packId: string) => Promise<void>;
  onUninstall: (packId: string) => Promise<void>;
  onUpdate: (packId: string) => Promise<void>;
  onDisable: (packId: string) => Promise<void>;
  onEnable: (packId: string) => Promise<void>;
  checked: boolean;
  onCheckChange: (packId: string, checked: boolean) => void;
}

export function NodePackRow({
  index, pack, isCore, isUsedInWorkflow, appVersion,
  onInstall, onUninstall, onUpdate, onDisable, onEnable,
  checked, onCheckChange,
}: NodePackRowProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  const rowClass = isCore
    ? "npm-row-core"
    : pack.status === "disabled"
    ? "opacity-50"
    : isUsedInWorkflow
    ? "npm-row-used-highlight"
    : "";

  const highlightStyle = isUsedInWorkflow && !isCore
    ? {
        borderLeft: "3px solid var(--accent)",
        background: "rgba(var(--accent-rgb, 128,128,128), 0.08)",
      }
    : isCore
    ? { borderLeft: "3px solid var(--accent)", background: "rgba(var(--accent-rgb, 128,128,128), 0.06)" }
    : undefined;

  return (
    <tr
      className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors ${rowClass}`}
      style={highlightStyle}
    >
      {/* Checkbox */}
      <td className="px-2 py-2 w-10 text-center">
        {!isCore && (
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckChange(pack.id, e.target.checked)}
            className="accent-[var(--accent)]"
          />
        )}
      </td>

      {/* # */}
      <td className="px-2 py-2 w-12 text-[var(--text-muted)] text-xs">{index + 1}</td>

      {/* Title */}
      <td className="px-2 py-2 min-w-[160px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">{pack.name}</span>
          {isCore && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)] text-white font-medium">Core</span>
          )}
          {isUsedInWorkflow && !isCore && (
            <span className="w-2 h-2 rounded-full bg-[var(--accent)]" title="Used in workflow" />
          )}
          {pack.status === "disabled" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-3)] text-[var(--text-muted)]">Disabled</span>
          )}
        </div>
      </td>

      {/* Version */}
      <td className="px-2 py-2 w-20 text-xs text-[var(--text-muted)]">
        {pack.installedVersion || pack.version}
      </td>

      {/* Actions */}
      <td className="px-2 py-2 w-36">
        {loading ? (
          <span className="text-xs text-[var(--text-muted)]">...</span>
        ) : isCore ? null : (
          <div className="flex gap-1 flex-wrap">
            {pack.status === "available" && (
              <button
                onClick={() => handleAction(() => onInstall(pack.id))}
                className="text-[10px] px-2 py-1 rounded font-medium"
                style={{ background: "var(--npm-btn-install)", color: "var(--npm-btn-install-text)" }}
              >
                Install
              </button>
            )}
            {pack.status === "update-available" && (
              <button
                onClick={() => handleAction(() => onUpdate(pack.id))}
                className="text-[10px] px-2 py-1 rounded font-medium"
                style={{ background: "var(--npm-btn-update)", color: "var(--npm-btn-update-text)" }}
              >
                Update
              </button>
            )}
            {(pack.status === "installed" || pack.status === "update-available") && (
              <>
                <button
                  onClick={() => handleAction(() => onDisable(pack.id))}
                  className="text-[10px] px-2 py-1 rounded font-medium"
                  style={{ background: "var(--npm-btn-disable)", color: "var(--npm-btn-disable-text)" }}
                >
                  Disable
                </button>
                <button
                  onClick={() => handleAction(() => onUninstall(pack.id))}
                  className="text-[10px] px-2 py-1 rounded font-medium"
                  style={{ background: "var(--npm-btn-uninstall)", color: "var(--npm-btn-uninstall-text)" }}
                >
                  Uninstall
                </button>
              </>
            )}
            {pack.status === "disabled" && (
              <>
                <button
                  onClick={() => handleAction(() => onEnable(pack.id))}
                  className="text-[10px] px-2 py-1 rounded font-medium"
                  style={{ background: "var(--npm-btn-install)", color: "var(--npm-btn-install-text)" }}
                >
                  Enable
                </button>
                <button
                  onClick={() => handleAction(() => onUninstall(pack.id))}
                  className="text-[10px] px-2 py-1 rounded font-medium"
                  style={{ background: "var(--npm-btn-uninstall)", color: "var(--npm-btn-uninstall-text)" }}
                >
                  Uninstall
                </button>
              </>
            )}
          </div>
        )}
        {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
      </td>

      {/* Nodes */}
      <td className="px-2 py-2 w-16 text-xs text-[var(--text-muted)] text-center">
        {pack.nodeCount}
      </td>

      {/* Description */}
      <td className="px-2 py-2 text-xs text-[var(--text-muted)] max-w-xs truncate">
        {pack.description}
      </td>

      {/* Author */}
      <td className="px-2 py-2 w-24 text-xs text-[var(--text-muted)]">
        {pack.author}
      </td>

      {/* Last Update */}
      <td className="px-2 py-2 w-24 text-xs text-[var(--text-muted)]">
        {pack.updatedAt ? new Date(pack.updatedAt).toISOString().split("T")[0] : "—"}
      </td>
    </tr>
  );
}
