"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogButton,
} from "@/components/ui/dialog";
import { Toast, useToast } from "@/components/Toast";
import { NodePackRow } from "./NodePackRow";
import { useWorkflowStore } from "@/store/workflowStore";
import type { NodePackEntryWithStatus } from "@/types/nodePacks";

type FilterMode = "all" | "installed" | "available" | "update-available" | "core";
type SortColumn = "title" | "version" | "nodes" | "author" | "updatedAt";
type SortDir = "asc" | "desc";

const CORE_PACK_ID = "agent1-foundation";

/**
 * Extract all unique node types used in the current workflow
 */
function getWorkflowNodeTypes(): Set<string> {
  const nodes = useWorkflowStore.getState().nodes;
  return new Set(nodes.map((n) => n.type).filter(Boolean));
}

/**
 * Find all pack IDs that provide at least one node type used in the workflow.
 * Uses heuristics based on naming patterns in the codebase:
 * - agent1-foundation (core): all core nodes
 * - agent1_neural_atelier: node types start with "na" (naSketchToPhoto, naStylingDetail, naRecolor)
 * - morpheus-model-management: node type is "morpheusModelManagement"
 * - Other custom packs: derive prefix from pack ID (e.g. agent1_xyz → "xyz" or first letters)
 */
function getPacksUsedInWorkflow(packs: NodePackEntryWithStatus[]): Set<string> {
  const workflowTypes = getWorkflowNodeTypes();
  if (workflowTypes.size === 0) return new Set();

  const usedPackIds = new Set<string>();

  // agent1-foundation is always considered used (core pack with base nodes)
  if (packs.some((p) => p.id === CORE_PACK_ID)) {
    usedPackIds.add(CORE_PACK_ID);
  }

  // For each pack, check if it provides any node type used in the workflow
  for (const pack of packs) {
    if (pack.id === CORE_PACK_ID) continue; // already added

    const packIdLower = pack.id.toLowerCase();

    for (const nodeType of workflowTypes) {
      const nodeTypeLower = nodeType.toLowerCase();

      // Strategy 1: Exact pack ID match (morpheusModelManagement pack → morpheusModelManagement node)
      if (nodeTypeLower === packIdLower.replace(/-/g, "").replace(/_/g, "")) {
        usedPackIds.add(pack.id);
        break;
      }

      // Strategy 2: Pack ID words are in node type (agent1_neural_atelier → naSketchToPhoto)
      // Extract meaningful words from pack ID (skip "agent1")
      const packWords = pack.id
        .replace(/agent1[-_]/i, "") // remove agent1 prefix
        .replace(/-/g, "_") // normalize hyphens to underscores
        .split("_")
        .map((w) => w.toLowerCase());

      for (const word of packWords) {
        if (word.length > 0 && nodeTypeLower.includes(word)) {
          usedPackIds.add(pack.id);
          break;
        }
      }
      if (usedPackIds.has(pack.id)) break;

      // Strategy 3: Common pack node type patterns
      // Neural Atelier nodes: naSketchToPhoto, naStylingDetail, naRecolor (specific patterns)
      if (
        (packIdLower === "agent1_neural_atelier" || packIdLower === "agent1-neural-atelier") &&
        (nodeTypeLower.startsWith("nask") || nodeTypeLower.startsWith("nast") || nodeTypeLower.startsWith("nare"))
      ) {
        usedPackIds.add(pack.id);
        break;
      }
    }
  }

  return usedPackIds;
}

function getMissingNodeTypes(): string[] {
  const nodes = useWorkflowStore.getState().nodes;
  const activeTypes = useWorkflowStore.getState().activeNodeTypes;
  // If activeNodeTypes is empty, the scan hasn't completed — don't show false positives
  if (!activeTypes || activeTypes.length === 0) return [];
  return [...new Set(nodes.map((n) => n.type).filter(Boolean))].filter(
    (t) => t && !activeTypes.includes(t)
  );
}

/**
 * Find which pack (from registry) provides a given missing node type.
 * Returns the pack ID if found, null otherwise.
 */
function findPackForNodeType(nodeType: string, packs: NodePackEntryWithStatus[]): string | null {
  for (const pack of packs) {
    const packIdLower = pack.id.toLowerCase().replace(/-/g, "_");
    const nodeTypeLower = nodeType.toLowerCase();

    // Try various matching strategies
    if (nodeTypeLower.includes(packIdLower.split("_").slice(1).join("").substring(0, 4))) {
      return pack.id;
    }
  }
  return null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Dev only: pass mock mode to registry API (?mock=with-packs|empty|error|new-packs) */
  mockMode?: string | null;
}

export function NodePackManager({ open, onOpenChange, mockMode }: Props) {
  const toast = useToast();
  const [packs, setPacks] = useState<NodePackEntryWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ col: SortColumn; dir: SortDir }>({
    col: "title",
    dir: "asc",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [usedPackIds, setUsedPackIds] = useState<Set<string>>(new Set());
  const [highlightingUsed, setHighlightingUsed] = useState(false);
  const [missingTypes, setMissingTypes] = useState<string[]>([]);
  const [missingWithPackSuggestions, setMissingWithPackSuggestions] = useState<
    Array<{ type: string; providedBy: string | null }>
  >([]);
  const [appVersion, setAppVersion] = useState("0.0.0");

  const fetchRegistry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = mockMode
        ? `/api/node-packs/registry?mock=${encodeURIComponent(mockMode)}`
        : "/api/node-packs/registry";
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setPacks(data.packs || []);
      } else {
        setError(data.error || "Failed to fetch registry");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Cannot reach registry"
      );
    } finally {
      setLoading(false);
    }
  }, [mockMode]);

  useEffect(() => {
    if (open) {
      fetchRegistry();
      setMissingTypes([]);
      setMissingWithPackSuggestions([]);
      setHighlightingUsed(false);
      setUsedPackIds(new Set());
      fetch("/api/health")
        .then((res) => res.json())
        .then((data) => setAppVersion(data.version || "0.0.0"))
        .catch(() => {});
    }
  }, [open, fetchRegistry]);

  const refreshActiveTypes = async () => {
    try {
      const res = await fetch("/api/node-registry/active-types");
      if (res.ok) {
        const { nodeTypes } = await res.json();
        useWorkflowStore.getState().setActiveNodeTypes(nodeTypes);
      }
    } catch {
      /* will activate on page reload */
    }
  };

  const handleInstall = async (packId: string) => {
    try {
      const res = await fetch("/api/node-packs/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Install failed");
      await refreshActiveTypes();
      await fetchRegistry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Install failed");
    }
  };

  const handleUninstall = async (packId: string) => {
    try {
      const res = await fetch("/api/node-packs/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Uninstall failed");
      await refreshActiveTypes();
      await fetchRegistry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Uninstall failed");
    }
  };

  const handleDisable = async (packId: string) => {
    try {
      const res = await fetch("/api/node-packs/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Disable failed");
      await refreshActiveTypes();
      await fetchRegistry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disable failed");
    }
  };

  const handleEnable = async (packId: string) => {
    try {
      const res = await fetch("/api/node-packs/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Enable failed");
      await refreshActiveTypes();
      await fetchRegistry();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enable failed");
    }
  };

  const handleUpdate = handleInstall;

  const filtered = useMemo(() => {
    let result = packs.filter((p) => {
      if (filter === "core") return p.id === CORE_PACK_ID || p.isCore;
      if (filter === "installed")
        return p.status === "installed" || p.status === "update-available";
      if (filter === "available") return p.status === "available";
      if (filter === "update-available") return p.status === "update-available";
      return true;
    });
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.author?.toLowerCase().includes(q)
      );
    }
    result.sort((a, b) => {
      const aCore = a.id === CORE_PACK_ID || a.isCore ? 1 : 0;
      const bCore = b.id === CORE_PACK_ID || b.isCore ? 1 : 0;
      if (aCore !== bCore) return bCore - aCore;
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.col === "title") return dir * a.name.localeCompare(b.name);
      if (sort.col === "nodes")
        return dir * ((a.nodeCount || 0) - (b.nodeCount || 0));
      if (sort.col === "author")
        return dir * (a.author || "").localeCompare(b.author || "");
      if (sort.col === "updatedAt")
        return dir * (a.updatedAt || "").localeCompare(b.updatedAt || "");
      return 0;
    });
    return result;
  }, [packs, filter, search, sort]);

  const toggleSort = (col: SortColumn) => {
    setSort((prev) => ({
      col,
      dir: prev.col === col && prev.dir === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader>
          <div className="flex items-center justify-between w-full">
            <DialogTitle>Node Pack Manager</DialogTitle>
            <span className="text-xs text-[var(--text-muted)]">
              {filtered.length} packs
            </span>
          </div>
          <div className="flex gap-2 mt-4">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterMode)}
              className="text-xs px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)]"
            >
              <option value="all">All</option>
              <option value="installed">Installed</option>
              <option value="available">Available</option>
              <option value="update-available">Update Available</option>
              <option value="core">Core</option>
            </select>
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[var(--text-muted)]" />
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-7 pr-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-primary)] border border-[var(--border)]"
              />
            </div>
          </div>
        </DialogHeader>

        <DialogBody>
          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
              {error}
              <button
                onClick={fetchRegistry}
                className="block text-xs text-red-300 hover:underline mt-1"
              >
                Retry
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                  <th className="px-2 py-2 w-10"></th>
                  <th className="px-2 py-2 w-12">#</th>
                  <th
                    className="px-2 py-2 cursor-pointer hover:text-[var(--text-primary)]"
                    onClick={() => toggleSort("title")}
                  >
                    Title {sort.col === "title" && (sort.dir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-2 py-2 w-20">Version</th>
                  <th className="px-2 py-2 w-36">Action</th>
                  <th
                    className="px-2 py-2 w-16 cursor-pointer hover:text-[var(--text-primary)] text-center"
                    onClick={() => toggleSort("nodes")}
                  >
                    Nodes {sort.col === "nodes" && (sort.dir === "asc" ? "↑" : "↓")}
                  </th>
                  <th className="px-2 py-2">Description</th>
                  <th
                    className="px-2 py-2 w-24 cursor-pointer hover:text-[var(--text-primary)]"
                    onClick={() => toggleSort("author")}
                  >
                    Author {sort.col === "author" && (sort.dir === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    className="px-2 py-2 w-24 cursor-pointer hover:text-[var(--text-primary)]"
                    onClick={() => toggleSort("updatedAt")}
                  >
                    Updated {sort.col === "updatedAt" && (sort.dir === "asc" ? "↑" : "↓")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[var(--text-muted)] text-sm">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-[var(--text-muted)] text-sm">
                      No packs found
                    </td>
                  </tr>
                )}
                {!loading &&
                  filtered.map((pack, i) => (
                    <NodePackRow
                      key={pack.id}
                      index={i}
                      pack={pack}
                      isCore={pack.id === CORE_PACK_ID || !!pack.isCore}
                      isUsedInWorkflow={usedPackIds.has(pack.id)}
                      appVersion={appVersion}
                      onInstall={handleInstall}
                      onUninstall={handleUninstall}
                      onUpdate={handleUpdate}
                      onDisable={handleDisable}
                      onEnable={handleEnable}
                      checked={selected.has(pack.id)}
                      onCheckChange={(id, c) => {
                        setSelected((prev) => {
                          const n = new Set(prev);
                          c ? n.add(id) : n.delete(id);
                          return n;
                        });
                      }}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        </DialogBody>

        <DialogFooter>
          <DialogButton
            variant="ghost"
            onClick={() => {
              const workflowUsed = getPacksUsedInWorkflow(packs);
              if (highlightingUsed && usedPackIds.size > 0) {
                // Toggle off
                setHighlightingUsed(false);
                setUsedPackIds(new Set());
                toast.hide();
              } else {
                // Toggle on
                setHighlightingUsed(true);
                setUsedPackIds(workflowUsed);
                if (workflowUsed.size > 0) {
                  toast.show(
                    `Highlighting ${workflowUsed.size} pack(s) used in current workflow`,
                    "success"
                  );
                } else {
                  toast.show(
                    "No packs are used in the current workflow",
                    "info"
                  );
                }
              }
            }}
          >
            {highlightingUsed ? "Hide Used" : "Show Used in Workflow"}
            {usedPackIds.size > 0 && ` (${usedPackIds.size})`}
          </DialogButton>
          <DialogButton variant="ghost" onClick={fetchRegistry}>
            Check Update
          </DialogButton>
          <DialogButton
            variant="ghost"
            onClick={() => {
              const missing = getMissingNodeTypes();
              setMissingTypes(missing);
              // Analyze which packs can provide the missing types
              const analyzed = missing.map((type) => ({
                type,
                providedBy: findPackForNodeType(type, packs),
              }));
              setMissingWithPackSuggestions(analyzed);
            }}
          >
            Check Missing {missingTypes.length > 0 && `(${missingTypes.length})`}
          </DialogButton>
        </DialogFooter>

        {missingTypes.length > 0 && (
          <div className="px-6 pb-4 text-xs">
            <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded p-3">
              <div className="font-medium text-[var(--text-primary)] mb-3">
                Missing node types in current workflow ({missingTypes.length}):
              </div>
              <div className="space-y-2">
                {missingWithPackSuggestions.map(({ type, providedBy }) => {
                  const suggestedPack = providedBy ? packs.find((p) => p.id === providedBy) : null;
                  return (
                    <div
                      key={type}
                      className="flex items-center justify-between bg-[var(--surface-1)] rounded p-2 border border-[var(--border)]/40"
                    >
                      <div className="flex-1">
                        <div className="text-[var(--text-primary)] font-medium">• {type}</div>
                        {suggestedPack ? (
                          <div className="text-[10px] text-[var(--accent)] mt-0.5">
                            Available in: <strong>{suggestedPack.name}</strong> v{suggestedPack.version}
                          </div>
                        ) : (
                          <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                            Not found in registry
                          </div>
                        )}
                      </div>
                      {suggestedPack && suggestedPack.status === "available" && (
                        <button
                          onClick={() => handleInstall(suggestedPack.id)}
                          className="ml-2 text-[10px] px-2 py-1 rounded font-medium whitespace-nowrap"
                          style={{ background: "var(--npm-btn-install)", color: "var(--npm-btn-install-text)" }}
                        >
                          Install
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                className="text-[var(--accent)] mt-3 hover:opacity-80 text-xs"
                onClick={() => {
                  setMissingTypes([]);
                  setMissingWithPackSuggestions([]);
                }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
    <Toast />
    </>
  );
}
