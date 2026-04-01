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

export interface SnapshotSlice {
  previousWorkflowSnapshot: {
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    groups: Record<string, NodeGroup>;
    edgeStyle: EdgeStyle;
  } | null;
  manualChangeCount: number;

  captureSnapshot: () => void;
  revertToSnapshot: () => void;
  clearSnapshot: () => void;
  incrementManualChangeCount: () => void;
  applyEditOperations: (operations: EditOperation[]) => { applied: number; skipped: string[] };
}

export const createSnapshotSlice: StateCreator<
  SnapshotSlice & SnapshotSliceDeps,
  [],
  [],
  SnapshotSlice
> = (set, get) => ({
  previousWorkflowSnapshot: null,
  manualChangeCount: 0,

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
});
