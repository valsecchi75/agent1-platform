import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { useWorkflowStore, WorkflowFile } from "./workflowStore";
import type { EdgeStyle } from "./workflowStore";
import type { WorkflowNode, WorkflowEdge, NodeGroup } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface WorkflowTab {
  id: string;
  /** Display name shown in the tab */
  label: string;
  /** True when the tab has nodes/edges that haven't been saved to disk */
  hasUnsavedChanges: boolean;
  /** Snapshot of the workflow state when the tab was deactivated */
  snapshot: WorkflowSnapshot | null;
}

export interface WorkflowSnapshot {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  groups: Record<string, NodeGroup>;
  workflowId: string | null;
  workflowName: string | null;
  saveDirectoryPath: string | null;
  generationsPath: string | null;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
  incurredCost: number;
  useExternalImageStorage: boolean;
  imageRefBasePath: string | null;
}

interface TabStore {
  tabs: WorkflowTab[];
  activeTabId: string;

  // Actions
  addTab: () => string;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;
  updateTabLabel: (tabId: string, label: string) => void;
  syncActiveTabState: () => void;
  duplicateTab: (tabId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

let tabIdCounter = 0;

function generateTabId(): string {
  tabIdCounter += 1;
  return `tab-${Date.now()}-${tabIdCounter}`;
}

function buildTabLabel(tabs: WorkflowTab[], name: string | null): string {
  const base = name || "Unsaved Workflow";
  // Check if label already exists and add suffix
  const existingLabels = new Set(tabs.map((t) => t.label));
  if (!existingLabels.has(base)) return base;

  let counter = 2;
  while (existingLabels.has(`${base} (${counter})`)) {
    counter++;
  }
  return `${base} (${counter})`;
}

/** Capture the current workflowStore state into a snapshot */
function captureWorkflowSnapshot(): WorkflowSnapshot {
  const state = useWorkflowStore.getState();
  return {
    nodes: state.nodes,
    edges: state.edges,
    edgeStyle: state.edgeStyle,
    groups: state.groups,
    workflowId: state.workflowId,
    workflowName: state.workflowName,
    saveDirectoryPath: state.saveDirectoryPath,
    generationsPath: state.generationsPath,
    lastSavedAt: state.lastSavedAt,
    hasUnsavedChanges: state.hasUnsavedChanges,
    incurredCost: state.incurredCost,
    useExternalImageStorage: state.useExternalImageStorage,
    imageRefBasePath: state.imageRefBasePath,
  };
}

/** Restore a snapshot into the workflowStore */
function restoreWorkflowSnapshot(snapshot: WorkflowSnapshot): void {
  const store = useWorkflowStore.getState();

  // Stop any running execution first
  if (store.isRunning) {
    store.stopWorkflow();
  }

  // We use the store's internal set via a loadWorkflow-like approach
  // but directly setting state to avoid async hydration issues
  useWorkflowStore.setState({
    nodes: snapshot.nodes.map((node) => ({ ...node, selected: false })),
    edges: snapshot.edges,
    edgeStyle: snapshot.edgeStyle,
    groups: snapshot.groups,
    workflowId: snapshot.workflowId,
    workflowName: snapshot.workflowName,
    saveDirectoryPath: snapshot.saveDirectoryPath,
    generationsPath: snapshot.generationsPath,
    lastSavedAt: snapshot.lastSavedAt,
    hasUnsavedChanges: snapshot.hasUnsavedChanges,
    incurredCost: snapshot.incurredCost,
    useExternalImageStorage: snapshot.useExternalImageStorage,
    imageRefBasePath: snapshot.imageRefBasePath,
    isRunning: false,
    currentNodeIds: [],
    pausedAtNodeId: null,
    viewedCommentNodeIds: new Set<string>(),
    dimmedNodeIds: new Set<string>(),
    showQuickstart: false,
  });

  // Recompute dimming after restoring
  useWorkflowStore.getState().recomputeDimmedNodes();
}

// ─── Initial tab ─────────────────────────────────────────────────────────────

const initialTabId = generateTabId();

// ─── Store ───────────────────────────────────────────────────────────────────

export const useTabStore = create<TabStore>((set, get) => ({
  tabs: [
    {
      id: initialTabId,
      label: "Unsaved Workflow",
      hasUnsavedChanges: false,
      snapshot: null,
    },
  ],
  activeTabId: initialTabId,

  addTab: () => {
    const { tabs, activeTabId } = get();

    // Snapshot the current active tab before switching
    const currentSnapshot = captureWorkflowSnapshot();
    const updatedTabs = tabs.map((tab) =>
      tab.id === activeTabId
        ? { ...tab, snapshot: currentSnapshot, hasUnsavedChanges: currentSnapshot.hasUnsavedChanges, label: getTabLabel(tab, currentSnapshot) }
        : tab
    );

    // Create new tab
    const newTabId = generateTabId();
    const newTab: WorkflowTab = {
      id: newTabId,
      label: buildTabLabel(updatedTabs, null),
      hasUnsavedChanges: false,
      snapshot: null, // Active tab = live state, no snapshot needed
    };

    set({
      tabs: [...updatedTabs, newTab],
      activeTabId: newTabId,
    });

    // Clear the workflowStore for a fresh canvas
    useWorkflowStore.getState().clearWorkflow();

    return newTabId;
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();

    // Can't close the last tab
    if (tabs.length <= 1) return;

    const tabIndex = tabs.findIndex((t) => t.id === tabId);
    if (tabIndex === -1) return;

    const closingTab = tabs[tabIndex];

    // If closing a tab with unsaved changes, confirm
    if (closingTab.hasUnsavedChanges || (tabId === activeTabId && useWorkflowStore.getState().hasUnsavedChanges)) {
      const confirmed = window.confirm("This workflow has unsaved changes. Close anyway?");
      if (!confirmed) return;
    }

    const remainingTabs = tabs.filter((t) => t.id !== tabId);

    // If closing the active tab, switch to adjacent tab
    if (tabId === activeTabId) {
      const newActiveIndex = Math.min(tabIndex, remainingTabs.length - 1);
      const newActiveTab = remainingTabs[newActiveIndex];

      set({ tabs: remainingTabs, activeTabId: newActiveTab.id });

      // Restore the new active tab's snapshot
      if (newActiveTab.snapshot) {
        restoreWorkflowSnapshot(newActiveTab.snapshot);
        // Clear the snapshot since it's now the live state
        set({
          tabs: remainingTabs.map((t) =>
            t.id === newActiveTab.id ? { ...t, snapshot: null } : t
          ),
        });
      } else {
        // Fresh tab with no snapshot — clear canvas
        useWorkflowStore.getState().clearWorkflow();
      }
    } else {
      set({ tabs: remainingTabs });
    }
  },

  switchTab: (tabId: string) => {
    const { tabs, activeTabId } = get();

    if (tabId === activeTabId) return;

    const targetTab = tabs.find((t) => t.id === tabId);
    if (!targetTab) return;

    // 1. Snapshot the current active tab
    const currentSnapshot = captureWorkflowSnapshot();

    // 2. Update tabs: save snapshot on current, clear snapshot on target
    const updatedTabs = tabs.map((tab) => {
      if (tab.id === activeTabId) {
        return {
          ...tab,
          snapshot: currentSnapshot,
          hasUnsavedChanges: currentSnapshot.hasUnsavedChanges,
          label: getTabLabel(tab, currentSnapshot),
        };
      }
      if (tab.id === tabId) {
        return { ...tab, snapshot: null }; // Will become live state
      }
      return tab;
    });

    set({ tabs: updatedTabs, activeTabId: tabId });

    // 3. Restore target tab's snapshot (or clear if it's a fresh tab)
    if (targetTab.snapshot) {
      restoreWorkflowSnapshot(targetTab.snapshot);
    } else {
      useWorkflowStore.getState().clearWorkflow();
    }
  },

  updateTabLabel: (tabId: string, label: string) => {
    set({
      tabs: get().tabs.map((tab) =>
        tab.id === tabId ? { ...tab, label } : tab
      ),
    });
  },

  /** Sync the active tab's metadata from workflowStore (called on name change, save, etc.) */
  syncActiveTabState: () => {
    const { tabs, activeTabId } = get();
    const wfState = useWorkflowStore.getState();

    set({
      tabs: tabs.map((tab) => {
        if (tab.id !== activeTabId) return tab;
        return {
          ...tab,
          label: wfState.workflowName || "Unsaved Workflow",
          hasUnsavedChanges: wfState.hasUnsavedChanges,
        };
      }),
    });
  },

  duplicateTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const sourceTab = tabs.find((t) => t.id === tabId);
    if (!sourceTab) return;

    // Get the snapshot to duplicate
    let snapshotToDuplicate: WorkflowSnapshot;
    if (tabId === activeTabId) {
      // Active tab — capture live state
      snapshotToDuplicate = captureWorkflowSnapshot();
    } else if (sourceTab.snapshot) {
      snapshotToDuplicate = sourceTab.snapshot;
    } else {
      return; // No data to duplicate
    }

    // Snapshot the current active tab before switching
    const currentSnapshot = captureWorkflowSnapshot();
    const updatedTabs = tabs.map((tab) =>
      tab.id === activeTabId
        ? { ...tab, snapshot: currentSnapshot, hasUnsavedChanges: currentSnapshot.hasUnsavedChanges, label: getTabLabel(tab, currentSnapshot) }
        : tab
    );

    // Create the duplicate tab
    const newTabId = generateTabId();
    const newTab: WorkflowTab = {
      id: newTabId,
      label: buildTabLabel(updatedTabs, `${sourceTab.label} copy`),
      hasUnsavedChanges: true,
      snapshot: null, // Will be the active tab
    };

    set({
      tabs: [...updatedTabs, newTab],
      activeTabId: newTabId,
    });

    // Restore the duplicate but reset identity so it saves as a new workflow
    restoreWorkflowSnapshot({
      ...snapshotToDuplicate,
      workflowId: null,
      workflowName: newTab.label,
      saveDirectoryPath: null,
      generationsPath: null,
      lastSavedAt: null,
      hasUnsavedChanges: true,
    });
  },
}));

/** Helper: determine the label for a tab based on its snapshot */
function getTabLabel(tab: WorkflowTab, snapshot: WorkflowSnapshot): string {
  if (snapshot.workflowName) return snapshot.workflowName;
  return tab.label; // Keep existing label if no name set
}

// ─── Session Persistence (file-based) ────────────────────────────────────────

/**
 * Save the current tab state to session files on disk + lightweight DB metadata.
 * Base64 images are extracted to separate files server-side to avoid bloating the DB.
 * Debounced to avoid excessive writes on rapid tab switches.
 */
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let isSaving = false;

function persistSessionToFiles(): void {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    if (isSaving) return; // skip if a previous save is still in progress
    isSaving = true;

    try {
      const { tabs, activeTabId } = useTabStore.getState();

      // Before saving, snapshot the active tab so all tabs have their state
      const activeSnapshot = captureWorkflowSnapshot();
      const tabsToSave = tabs.map((tab) => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            snapshot: activeSnapshot,
            label: getTabLabel(tab, activeSnapshot),
          };
        }
        return tab;
      });

      // POST to the new file-based session persist endpoint
      // Server extracts base64 images to disk and stores clean JSON
      await fetch("/api/session/persist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tabs: tabsToSave, activeTabId }),
      });
    } catch (err) {
      console.warn("[tabStore] Failed to persist session:", err);
    } finally {
      isSaving = false;
    }
  }, 3000); // 3-second debounce (slightly longer to batch saves)
}

/**
 * Explicitly persist the current workflow state for the "Last Workflow" feature.
 * Called by executors after a generation completes.
 */
export function persistLastGenerationWorkflow(): void {
  try {
    const snapshot = captureWorkflowSnapshot();
    // Build a WorkflowFile-like object from the snapshot
    const workflowData = {
      version: 1,
      id: snapshot.workflowId,
      name: snapshot.workflowName || "Unsaved Workflow",
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      edgeStyle: snapshot.edgeStyle,
      groups: snapshot.groups,
      saveDirectoryPath: snapshot.saveDirectoryPath,
    };

    fetch("/api/session/save-last-generation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow: workflowData }),
    }).catch((err) => {
      console.warn("[tabStore] Failed to save last generation workflow:", err);
    });
  } catch (err) {
    console.warn("[tabStore] Failed to capture snapshot for last generation:", err);
  }
}

// Subscribe to store changes and auto-persist
useTabStore.subscribe((state, prevState) => {
  // Only persist when tabs or activeTabId actually change
  if (state.tabs !== prevState.tabs || state.activeTabId !== prevState.activeTabId) {
    persistSessionToFiles();
  }
});

// ─── Convenience hook ────────────────────────────────────────────────────────

export function useActiveTab(): WorkflowTab | undefined {
  return useTabStore((state) => state.tabs.find((t) => t.id === state.activeTabId));
}
