import type { StateCreator } from "zustand";
import type { WorkflowNode, WorkflowEdge, NodeGroup } from "@/types";
import { EditOperation, applyEditOperations as executeEditOps } from "@/lib/chat/editOperations";

/** Edge style — duplicated here to avoid circular import from workflowStore */
type EdgeStyle = "angular" | "curved";

/**
 * SnapshotSlice needs access to core workflow state.
 */
export interface SnapshotSliceDeps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: Record<string, NodeGroup>;
  edgeStyle: EdgeStyle;
}

/**
 * UndoEntry — represents a single undo/redo state snapshot.
 * Uses string-preserving clone to avoid deep-copying base64 image data.
 */
export interface UndoEntry {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: Record<string, NodeGroup>;
  edgeStyle: EdgeStyle;
}

export interface SnapshotSlice {
  previousWorkflowSnapshot: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    groups: Record<string, NodeGroup>;
    edgeStyle: EdgeStyle;
  } | null;
  manualChangeCount: number;

  // Undo/Redo stacks
  undoStack: UndoEntry[];
  redoStack: UndoEntry[];

  // Legacy snapshot methods (kept for backward compatibility)
  captureSnapshot: () => void;
  revertToSnapshot: () => void;
  clearSnapshot: () => void;
  incrementManualChangeCount: () => void;
  applyEditOperations: (operations: EditOperation[]) => { applied: number; skipped: string[] };

  // Undo/Redo operations
  pushUndoEntry: (entry: UndoEntry) => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Memory-efficient clone that preserves string references (e.g., base64 data URLs)
 * instead of deep-copying them.
 */
function clonePreservingStrings(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val === "string") return val; // Preserve string reference
  if (typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(clonePreservingStrings);
  const result: Record<string, unknown> = {};
  for (const key of Object.keys(val as object)) {
    result[key] = clonePreservingStrings((val as Record<string, unknown>)[key]);
  }
  return result;
}

/**
 * Capture current state as an UndoEntry using memory-efficient cloning.
 */
function captureState(state: SnapshotSliceDeps): UndoEntry {
  return clonePreservingStrings({
    nodes: state.nodes,
    edges: state.edges,
    groups: state.groups,
    edgeStyle: state.edgeStyle,
  }) as UndoEntry;
}

export const createSnapshotSlice: StateCreator<
  SnapshotSlice & SnapshotSliceDeps,
  [],
  [],
  SnapshotSlice
> = (set, get) => ({
  previousWorkflowSnapshot: null,
  manualChangeCount: 0,
  undoStack: [],
  redoStack: [],

  captureSnapshot: () => {
    const state = get();
    const snapshot = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
      groups: JSON.parse(JSON.stringify(state.groups)),
      edgeStyle: state.edgeStyle,
    };
    set({
      previousWorkflowSnapshot: snapshot,
      manualChangeCount: 0,
    });
  },

  revertToSnapshot: () => {
    const state = get();
    if (state.previousWorkflowSnapshot) {
      set({
        nodes: state.previousWorkflowSnapshot.nodes,
        edges: state.previousWorkflowSnapshot.edges,
        groups: state.previousWorkflowSnapshot.groups,
        edgeStyle: state.previousWorkflowSnapshot.edgeStyle,
        previousWorkflowSnapshot: null,
        manualChangeCount: 0,
        hasUnsavedChanges: true,
      } as Partial<SnapshotSlice & SnapshotSliceDeps & { hasUnsavedChanges: boolean }>);
    }
  },

  clearSnapshot: () => {
    set({
      previousWorkflowSnapshot: null,
      manualChangeCount: 0,
    });
  },

  incrementManualChangeCount: () => {
    const state = get();
    const newCount = state.manualChangeCount + 1;
    if (newCount >= 3) {
      set({
        previousWorkflowSnapshot: null,
        manualChangeCount: 0,
      });
    } else {
      set({ manualChangeCount: newCount });
    }
  },

  applyEditOperations: (operations) => {
    const state = get();
    const result = executeEditOps(operations, {
      nodes: state.nodes,
      edges: state.edges,
    });

    set({
      nodes: result.nodes,
      edges: result.edges,
      hasUnsavedChanges: true,
    } as Partial<SnapshotSlice & SnapshotSliceDeps & { hasUnsavedChanges: boolean }>);

    return { applied: result.applied, skipped: result.skipped };
  },

  // ─── Undo/Redo Implementation ───────────────────────────────────────────
  pushUndoEntry: (entry) => {
    set((state) => {
      const newStack = [...state.undoStack, entry].slice(-50); // Keep last 50
      return { undoStack: newStack, redoStack: [] }; // Clear redo on new action
    });
  },

  undo: () => {
    const state = get();
    if (state.undoStack.length === 0) return;

    // Capture current state before reverting
    const current = captureState(state);
    const previous = state.undoStack[state.undoStack.length - 1];

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      groups: previous.groups,
      edgeStyle: previous.edgeStyle,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, current].slice(-50),
      hasUnsavedChanges: true,
    } as Partial<SnapshotSlice & SnapshotSliceDeps & { hasUnsavedChanges: boolean }>);
  },

  redo: () => {
    const state = get();
    if (state.redoStack.length === 0) return;

    // Capture current state before moving forward
    const current = captureState(state);
    const next = state.redoStack[state.redoStack.length - 1];

    set({
      nodes: next.nodes,
      edges: next.edges,
      groups: next.groups,
      edgeStyle: next.edgeStyle,
      undoStack: [...state.undoStack, current].slice(-50),
      redoStack: state.redoStack.slice(0, -1),
      hasUnsavedChanges: true,
    } as Partial<SnapshotSlice & SnapshotSliceDeps & { hasUnsavedChanges: boolean }>);
  },
});
