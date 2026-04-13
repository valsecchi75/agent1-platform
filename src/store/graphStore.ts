/**
 * graphStore.ts — Graph Slice (Zona Congelata)
 *
 * Owns: nodes, edges, edgeStyle, clipboard, groups.
 * Provides: all node/edge/group/clipboard operations, getConnectedInputs, validateWorkflow.
 *
 * ZONA CONGELATA — Do NOT modify without contract test + PR review.
 * See CLAUDE.md § "Zona Congelata" for rules.
 */

import {
  Connection,
  EdgeChange,
  NodeChange,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  XYPosition,
} from "@xyflow/react";
import type { StateCreator } from "zustand";

import { getConnectedInputsPure, validateWorkflowPure } from "./utils/connectedInputs";
import {
  createDefaultNodeData,
  defaultNodeDimensions,
  GROUP_COLORS,
  GROUP_COLOR_ORDER,
} from "./utils/nodeDefaults";

import type {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  WorkflowNodeData,
  NodeGroup,
  GroupColor,
  ArrayNodeData,
} from "@/types";

export { GROUP_COLORS } from "./utils/nodeDefaults";

// ─── Module-level counters ───────────────────────────────────────────────────

/** Auto-incrementing counter for unique node IDs. */
export let nodeIdCounter = 0;
/** Allow persistence slice to sync counter after load. */
export function setNodeIdCounter(value: number): void {
  nodeIdCounter = value;
}

/** Auto-incrementing counter for unique group IDs. */
export let groupIdCounter = 0;
/** Allow persistence slice to sync counter after load. */
export function setGroupIdCounter(value: number): void {
  groupIdCounter = value;
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type EdgeStyle = "angular" | "curved";

interface ClipboardData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const IMAGE_SOURCE_NODE_TYPES = new Set<string>([
  "imageInput", "annotation", "nanoBanana", "glbViewer", "videoFrameGrab",
]);

function captureUndoState(state: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: Record<string, NodeGroup>;
  edgeStyle: EdgeStyle;
}) {
  return {
    nodes: [...state.nodes],
    edges: [...state.edges],
    groups: { ...state.groups },
    edgeStyle: state.edgeStyle,
  };
}

function buildConnectionEdgeData(
  connection: Connection,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): Record<string, unknown> {
  const baseData: Record<string, unknown> = { createdAt: Date.now() };
  const sourceNode = nodes.find((n) => n.id === connection.source);

  if (sourceNode?.type === "array" && (connection.sourceHandle || "text") === "text") {
    const sourceData = sourceNode.data as Record<string, unknown>;
    const selectedIndex = sourceData.selectedOutputIndex;
    const outputItems = Array.isArray(sourceData.outputItems) ? sourceData.outputItems : [];
    const outputCount = outputItems.length;

    if (
      typeof selectedIndex === "number" &&
      Number.isInteger(selectedIndex) &&
      selectedIndex >= 0 &&
      (outputCount === 0 || selectedIndex < outputCount)
    ) {
      baseData.arrayItemIndex = selectedIndex;
      return baseData;
    }

    if (outputCount > 0) {
      const existingArrayEdges = edges.filter(
        (e) => e.source === connection.source && (e.sourceHandle || "text") === "text"
      );

      const lastEdge = existingArrayEdges.reduce<WorkflowEdge | null>((latest, edge) => {
        if (!latest) return edge;
        const latestTime = (latest.data as Record<string, unknown> | undefined)?.createdAt;
        const edgeTime = (edge.data as Record<string, unknown> | undefined)?.createdAt;
        return (typeof edgeTime === "number" && typeof latestTime === "number" && edgeTime > latestTime) ? edge : latest;
      }, null);

      const lastIndex = (lastEdge?.data as Record<string, unknown> | undefined)?.arrayItemIndex;
      const startIndex = typeof lastIndex === "number" && Number.isInteger(lastIndex) && lastIndex >= 0
        ? lastIndex + 1
        : existingArrayEdges.length;

      baseData.arrayItemIndex = startIndex % outputCount;
    } else {
      baseData.arrayItemIndex = 0;
    }
  }

  return baseData;
}

function clearStaleInputImages(
  removedEdges: WorkflowEdge[],
  get: () => GraphSliceDeps & GraphSlice
): void {
  if (removedEdges.length === 0) return;
  const { edges, nodes, updateNodeData } = get();
  const targetIds = new Set(removedEdges.map((e) => e.target));
  for (const targetId of targetIds) {
    const node = nodes.find((n) => n.id === targetId);
    if (!node || !("inputImages" in (node.data as Record<string, unknown>))) continue;
    const hasRemainingImageSource = edges.some((e) => {
      if (e.target !== targetId) return false;
      const src = nodes.find((n) => n.id === e.source);
      return src ? IMAGE_SOURCE_NODE_TYPES.has(src.type ?? "") : false;
    });
    if (!hasRemainingImageSource) {
      updateNodeData(targetId, { inputImages: [] });
    }
  }
}

// ─── Deps (cross-slice access) ────────────────────────────────────────────────

/** Declares which other slice properties graphStore needs at runtime. */
export interface GraphSliceDeps {
  // SnapshotSlice
  pushUndoEntry: (entry: { nodes: WorkflowNode[]; edges: WorkflowEdge[]; groups: Record<string, NodeGroup>; edgeStyle: EdgeStyle }) => void;
  incrementManualChangeCount: () => void;
  // DimmingSlice
  recomputeDimmedNodes: () => void;
  dimmedNodeIds: Set<string>;
  // PersistenceSlice state that graphStore sets via Zustand cross-slice set()
  hasUnsavedChanges: boolean;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface GraphSlice {
  // State
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  clipboard: ClipboardData | null;
  groups: Record<string, NodeGroup>;

  // Settings
  setEdgeStyle: (style: EdgeStyle) => void;

  // Node operations
  addNode: (type: NodeType, position: XYPosition, initialData?: Partial<WorkflowNodeData>) => string;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  removeNode: (nodeId: string) => void;
  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => void;

  // Edge operations
  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => void;
  onConnect: (connection: Connection, edgeDataOverrides?: Record<string, unknown>) => void;
  addEdgeWithType: (connection: Connection, edgeType: string, edgeDataOverrides?: Record<string, unknown>) => void;
  removeEdge: (edgeId: string) => void;
  toggleEdgePause: (edgeId: string) => void;

  // Clipboard
  copySelectedNodes: () => void;
  pasteNodes: (offset?: XYPosition) => void;
  clearClipboard: () => void;

  // Group operations
  createGroup: (nodeIds: string[]) => string;
  deleteGroup: (groupId: string) => void;
  addNodesToGroup: (nodeIds: string[], groupId: string) => void;
  removeNodesFromGroup: (nodeIds: string[]) => void;
  updateGroup: (groupId: string, updates: Partial<NodeGroup>) => void;
  toggleGroupLock: (groupId: string) => void;
  moveGroupNodes: (groupId: string, delta: { x: number; y: number }) => void;
  setNodeGroupId: (nodeId: string, groupId: string | undefined) => void;
  toggleBypassNodes: (nodeIds: string[]) => void;

  // Helpers
  getNodeById: (id: string) => WorkflowNode | undefined;
  getConnectedInputs: (nodeId: string) => { images: string[]; videos: string[]; audio: string[]; model3d: string | null; text: string | null; dynamicInputs: Record<string, string | string[]>; easeCurve: { bezierHandles: [number, number, number, number]; easingPreset: string | null; outputDuration: number } | null };
  validateWorkflow: () => { valid: boolean; errors: string[] };
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export const createGraphSlice: StateCreator<
  GraphSlice & GraphSliceDeps,
  [],
  [],
  GraphSlice
> = (set, get) => ({

  // ── State ──────────────────────────────────────────────────────────────────
  nodes: [],
  edges: [],
  edgeStyle: "curved" as EdgeStyle,
  clipboard: null,
  groups: {},

  // ── Settings ────────────────────────────────────────────────────────────────

  setEdgeStyle: (style: EdgeStyle) => {
    set({ edgeStyle: style });
  },

  // ── Node operations ──────────────────────────────────────────────────────────

  addNode: (type: NodeType, position: XYPosition, initialData?: Partial<WorkflowNodeData>) => {
    const state = get();
    get().pushUndoEntry(captureUndoState(state));

    const id = `${type}-${++nodeIdCounter}`;
    const { width, height } = defaultNodeDimensions[type];
    const defaultData = createDefaultNodeData(type);
    const nodeData = initialData
      ? ({ ...defaultData, ...initialData } as WorkflowNodeData)
      : defaultData;

    const newNode: WorkflowNode = {
      id,
      type,
      position,
      data: nodeData,
      style: { width, height },
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      hasUnsavedChanges: true,
    }));

    get().incrementManualChangeCount();
    return id;
  },

  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => {
    const node = get().nodes.find((n) => n.id === nodeId);
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
          : node
      ) as WorkflowNode[],
      hasUnsavedChanges: true,
    }));
    if (node?.type === "switch" && "switches" in data) {
      get().recomputeDimmedNodes();
    }
    if (node?.type === "conditionalSwitch" && ("rules" in data || "evaluationPaused" in data)) {
      get().recomputeDimmedNodes();
    }
  },

  removeNode: (nodeId: string) => {
    const state = get();
    get().pushUndoEntry(captureUndoState(state));

    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== nodeId),
      edges: state.edges.filter(
        (edge) => edge.source !== nodeId && edge.target !== nodeId
      ),
      hasUnsavedChanges: true,
    }));
    get().incrementManualChangeCount();
  },

  onNodesChange: (changes: NodeChange<WorkflowNode>[]) => {
    const hasMeaningfulChange = changes.some(
      (c) => c.type !== "select" && c.type !== "dimensions"
    );
    const hasRemoveChange = changes.some((c) => c.type === "remove");
    const hasPositionChange = changes.some((c) => c.type === "position");

    if (hasMeaningfulChange || hasPositionChange) {
      const state = get();
      get().pushUndoEntry(captureUndoState(state));
    }

    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      ...(hasMeaningfulChange ? { hasUnsavedChanges: true } : {}),
    }));

    if (hasRemoveChange) {
      get().incrementManualChangeCount();
    }
  },

  // ── Edge operations ──────────────────────────────────────────────────────────

  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => {
    const hasMeaningfulChange = changes.some((c) => c.type !== "select");
    const hasRemoveChange = changes.some((c) => c.type === "remove");
    const hasAddOrRemove = changes.some((c) => c.type === "add" || c.type === "remove");

    if (hasAddOrRemove) {
      const state = get();
      get().pushUndoEntry(captureUndoState(state));
    }

    let removedEdges: WorkflowEdge[] = [];
    if (hasRemoveChange) {
      const removeIds = new Set(
        changes.filter((c) => c.type === "remove").map((c) => c.id)
      );
      removedEdges = get().edges.filter((e) => removeIds.has(e.id));
    }

    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
      ...(hasMeaningfulChange ? { hasUnsavedChanges: true } : {}),
    }));

    if (hasRemoveChange) {
      clearStaleInputImages(removedEdges, get);
      get().incrementManualChangeCount();
    }

    if (hasAddOrRemove) {
      get().recomputeDimmedNodes();
    }
  },

  onConnect: (connection: Connection, edgeDataOverrides?: Record<string, unknown>) => {
    const state = get();
    get().pushUndoEntry(captureUndoState(state));

    set((state) => {
      const baseData = buildConnectionEdgeData(connection, state.nodes, state.edges);
      const newEdge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${connection.targetHandle || "default"}`,
        data: edgeDataOverrides ? { ...baseData, ...edgeDataOverrides } : baseData,
      };
      return {
        edges: addEdge(newEdge, state.edges as never) as WorkflowEdge[],
        hasUnsavedChanges: true,
      };
    });
    get().incrementManualChangeCount();
    get().recomputeDimmedNodes();
  },

  addEdgeWithType: (connection: Connection, edgeType: string, edgeDataOverrides?: Record<string, unknown>) => {
    set((state) => {
      const baseData = buildConnectionEdgeData(connection, state.nodes, state.edges);
      const newEdge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}-${connection.sourceHandle || "default"}-${connection.targetHandle || "default"}`,
        type: edgeType,
        data: edgeDataOverrides ? { ...baseData, ...edgeDataOverrides } : baseData,
      };
      return {
        edges: addEdge(newEdge, state.edges as never) as WorkflowEdge[],
        hasUnsavedChanges: true,
      };
    });
  },

  removeEdge: (edgeId: string) => {
    const state = get();
    get().pushUndoEntry(captureUndoState(state));

    const removedEdge = get().edges.find((e) => e.id === edgeId);
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== edgeId),
      hasUnsavedChanges: true,
    }));
    if (removedEdge) clearStaleInputImages([removedEdge], get);
    get().incrementManualChangeCount();
  },

  toggleEdgePause: (edgeId: string) => {
    set((state) => ({
      edges: state.edges.map((edge) =>
        edge.id === edgeId
          ? { ...edge, data: { ...edge.data, hasPause: !edge.data?.hasPause } }
          : edge
      ),
      hasUnsavedChanges: true,
    }));
  },

  // ── Clipboard ────────────────────────────────────────────────────────────────

  copySelectedNodes: () => {
    const { nodes, edges } = get();
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length === 0) return;

    const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
    const connectedEdges = edges.filter(
      (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
    );

    const clonedNodes = JSON.parse(JSON.stringify(selectedNodes)) as WorkflowNode[];
    const clonedEdges = JSON.parse(JSON.stringify(connectedEdges)) as WorkflowEdge[];

    set({ clipboard: { nodes: clonedNodes, edges: clonedEdges } });
  },

  pasteNodes: (offset: XYPosition = { x: 50, y: 50 }) => {
    const { clipboard, nodes, edges } = get();
    if (!clipboard || clipboard.nodes.length === 0) return;

    const idMapping = new Map<string, string>();
    clipboard.nodes.forEach((node) => {
      const newId = `${node.type}-${++nodeIdCounter}`;
      idMapping.set(node.id, newId);
    });

    const newNodes: WorkflowNode[] = clipboard.nodes.map((node) => {
      const defaults = defaultNodeDimensions[node.type as NodeType] || { width: 300, height: 280 };
      return {
        ...node,
        id: idMapping.get(node.id)!,
        position: {
          x: node.position.x + offset.x,
          y: node.position.y + offset.y,
        },
        selected: true,
        style: { width: node.style?.width ?? defaults.width, height: defaults.height },
        width: undefined,
        height: undefined,
        measured: undefined,
        data: JSON.parse(JSON.stringify(node.data)),
      };
    });

    const newEdges: WorkflowEdge[] = clipboard.edges.map((edge) => ({
      ...edge,
      id: `edge-${idMapping.get(edge.source)}-${idMapping.get(edge.target)}-${edge.sourceHandle || "default"}-${edge.targetHandle || "default"}`,
      source: idMapping.get(edge.source)!,
      target: idMapping.get(edge.target)!,
    }));

    const updatedNodes = nodes.map((node) => ({ ...node, selected: false }));

    set({
      nodes: [...updatedNodes, ...newNodes] as WorkflowNode[],
      edges: [...edges, ...newEdges],
      hasUnsavedChanges: true,
    });

    const newNodeIdSet = new Set(newNodes.map(n => n.id));
    requestAnimationFrame(() => {
      const currentNodes = get().nodes;
      const selectionChanges: NodeChange<WorkflowNode>[] = currentNodes.map(n => ({
        type: 'select' as const,
        id: n.id,
        selected: newNodeIdSet.has(n.id),
      }));
      get().onNodesChange(selectionChanges);
    });
  },

  clearClipboard: () => {
    set({ clipboard: null });
  },

  // ── Group operations ──────────────────────────────────────────────────────────

  createGroup: (nodeIds: string[]) => {
    const state = get();
    get().pushUndoEntry(captureUndoState(state));

    const { nodes, groups } = get();
    if (nodeIds.length === 0) return "";

    const nodesToGroup = nodes.filter((n) => nodeIds.includes(n.id));
    if (nodesToGroup.length === 0) return "";

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodesToGroup.forEach((node) => {
      const defaults = defaultNodeDimensions[node.type as NodeType] || { width: 300, height: 280 };
      const width = node.measured?.width || (node.style?.width as number) || defaults.width;
      const height = node.measured?.height || (node.style?.height as number) || defaults.height;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + width);
      maxY = Math.max(maxY, node.position.y + height);
    });

    const padding = 20;

    const usedColors = new Set(Object.values(groups).map((g) => g.color));
    let color: GroupColor = "neutral";
    for (const c of GROUP_COLOR_ORDER) {
      if (!usedColors.has(c)) {
        color = c;
        break;
      }
    }

    const id = `group-${++groupIdCounter}`;
    const groupNumber = Object.keys(groups).length + 1;
    const name = `Group ${groupNumber}`;

    const newGroup: NodeGroup = {
      id,
      name,
      color,
      position: { x: minX - padding, y: minY - padding },
      size: { width: maxX - minX + padding * 2, height: maxY - minY + padding * 2 },
    };

    set((state) => ({
      nodes: state.nodes.map((node) =>
        nodeIds.includes(node.id) ? { ...node, groupId: id } : node
      ) as WorkflowNode[],
      groups: { ...state.groups, [id]: newGroup },
      hasUnsavedChanges: true,
    }));

    return id;
  },

  deleteGroup: (groupId: string) => {
    const state = get();
    get().pushUndoEntry(captureUndoState(state));

    set((state) => {
      const { [groupId]: _, ...remainingGroups } = state.groups;
      return {
        nodes: state.nodes.map((node) =>
          node.groupId === groupId ? { ...node, groupId: undefined } : node
        ) as WorkflowNode[],
        groups: remainingGroups,
        hasUnsavedChanges: true,
      };
    });
  },

  addNodesToGroup: (nodeIds: string[], groupId: string) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        nodeIds.includes(node.id) ? { ...node, groupId } : node
      ) as WorkflowNode[],
      hasUnsavedChanges: true,
    }));
  },

  removeNodesFromGroup: (nodeIds: string[]) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        nodeIds.includes(node.id) ? { ...node, groupId: undefined } : node
      ) as WorkflowNode[],
      hasUnsavedChanges: true,
    }));
  },

  updateGroup: (groupId: string, updates: Partial<NodeGroup>) => {
    set((state) => ({
      groups: {
        ...state.groups,
        [groupId]: { ...state.groups[groupId], ...updates },
      },
      hasUnsavedChanges: true,
    }));
  },

  toggleGroupLock: (groupId: string) => {
    set((state) => ({
      groups: {
        ...state.groups,
        [groupId]: {
          ...state.groups[groupId],
          locked: !state.groups[groupId].locked,
        },
      },
      hasUnsavedChanges: true,
    }));
  },

  moveGroupNodes: (groupId: string, delta: { x: number; y: number }) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.groupId === groupId
          ? {
              ...node,
              position: {
                x: node.position.x + delta.x,
                y: node.position.y + delta.y,
              },
            }
          : node
      ) as WorkflowNode[],
      hasUnsavedChanges: true,
    }));
  },

  setNodeGroupId: (nodeId: string, groupId: string | undefined) => {
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === nodeId ? { ...node, groupId } : node
      ) as WorkflowNode[],
      hasUnsavedChanges: true,
    }));
  },

  toggleBypassNodes: (nodeIds: string[]) => {
    const { nodes } = get();
    const selectedSet = new Set(nodeIds);
    const anyNotBypassed = nodes.some(n => selectedSet.has(n.id) && !n.data?.bypassed);
    set({
      nodes: nodes.map(n => {
        if (!selectedSet.has(n.id)) return n;
        return { ...n, data: { ...n.data, bypassed: anyNotBypassed } };
      }),
    });
  },

  // ── Helpers ───────────────────────────────────────────────────────────────────

  getNodeById: (id: string) => {
    return get().nodes.find((node) => node.id === id);
  },

  getConnectedInputs: (nodeId: string) => {
    const { edges, nodes, dimmedNodeIds } = get();
    return getConnectedInputsPure(nodeId, nodes, edges, undefined, dimmedNodeIds);
  },

  validateWorkflow: () => {
    const { nodes, edges } = get();
    return validateWorkflowPure(nodes, edges);
  },
});
