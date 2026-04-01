import type { StateCreator } from "zustand";
import type { WorkflowNode } from "@/types";

/**
 * CommentSlice needs access to nodes from the main store.
 */
export interface CommentSliceDeps {
  nodes: WorkflowNode[];
}

export interface CommentSlice {
  viewedCommentNodeIds: Set<string>;
  navigationTarget: { nodeId: string; timestamp: number } | null;
  focusedCommentNodeId: string | null;

  getNodesWithComments: () => WorkflowNode[];
  getUnviewedCommentCount: () => number;
  markCommentViewed: (nodeId: string) => void;
  setNavigationTarget: (nodeId: string | null) => void;
  setFocusedCommentNodeId: (nodeId: string | null) => void;
  resetViewedComments: () => void;
}

export const createCommentSlice: StateCreator<
  CommentSlice & CommentSliceDeps,
  [],
  [],
  CommentSlice
> = (set, get) => ({
  viewedCommentNodeIds: new Set<string>(),
  navigationTarget: null,
  focusedCommentNodeId: null,

  getNodesWithComments: () => {
    const { nodes } = get();
    const nodesWithComments = nodes.filter((node) => {
      const data = node.data as { comment?: string };
      return data.comment && data.comment.trim().length > 0;
    });

    const ROW_THRESHOLD = 50;
    return nodesWithComments.sort((a, b) => {
      const yDiff = a.position.y - b.position.y;
      if (Math.abs(yDiff) <= ROW_THRESHOLD) {
        return a.position.x - b.position.x;
      }
      return yDiff;
    });
  },

  getUnviewedCommentCount: () => {
    const { viewedCommentNodeIds } = get();
    const nodesWithComments = get().getNodesWithComments();
    return nodesWithComments.filter((node) => !viewedCommentNodeIds.has(node.id)).length;
  },

  markCommentViewed: (nodeId: string) => {
    set((state) => {
      const newViewedSet = new Set(state.viewedCommentNodeIds);
      newViewedSet.add(nodeId);
      return { viewedCommentNodeIds: newViewedSet };
    });
  },

  setNavigationTarget: (nodeId: string | null) => {
    if (nodeId === null) {
      set({ navigationTarget: null });
    } else {
      set({ navigationTarget: { nodeId, timestamp: Date.now() } });
      set({ focusedCommentNodeId: nodeId });
    }
  },

  setFocusedCommentNodeId: (nodeId: string | null) => {
    set({ focusedCommentNodeId: nodeId });
  },

  resetViewedComments: () => {
    set({ viewedCommentNodeIds: new Set<string>() });
  },
});
