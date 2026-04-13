import type { StateCreator } from "zustand";
import type { WorkflowNode, WorkflowEdge } from "@/types";
import { computeDimmedNodes } from "../utils/dimmingUtils";

/**
 * DimmingSlice needs access to nodes and edges from the main store.
 */
export interface DimmingSliceDeps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface DimmingSlice {
  dimmedNodeIds: Set<string>;
  recomputeDimmedNodes: () => void;
}

export const createDimmingSlice: StateCreator<
  DimmingSlice & DimmingSliceDeps,
  [],
  [],
  DimmingSlice
> = (set, get) => ({
  dimmedNodeIds: new Set<string>(),

  recomputeDimmedNodes: () => {
    const { nodes, edges } = get();
    const newDimmed = computeDimmedNodes(nodes, edges);
    const currentDimmed = get().dimmedNodeIds;
    if (newDimmed.size !== currentDimmed.size ||
        [...newDimmed].some(id => !currentDimmed.has(id))) {
      set({ dimmedNodeIds: newDimmed });
    }
  },
});
