/**
 * workflowStore.ts — Zustand store for the workflow editor.
 *
 * ARCHITECTURE (R1 refactor):
 * - Isolated slices in ./slices/ handle: UI, Provider, Cost, CanvasNav,
 *   Comments, Snapshot, Dimming.
 * - Node execution is dispatched via ./execution/executeNode.ts (single
 *   switch statement), eliminating 4 prior duplicates.
 * - Core state (nodes, edges, groups, clipboard) and tightly-coupled
 *   operations (save/load, auto-save, execution orchestration) remain here.
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
import { create, StateCreator } from "zustand";
import { useShallow } from "zustand/shallow";

// Execution
import { executeNode as dispatchExecuteNode } from "./execution/executeNode";
import type { NodeExecutionContext } from "./execution";
import { executeOutput, executeOutputGallery, executeImageCompare, executeGlbViewer } from "./execution";

// Utilities
import { getConnectedInputsPure, validateWorkflowPure } from "./utils/connectedInputs";
import {
  CONCURRENCY_SETTINGS_KEY,
  loadConcurrencySetting,
  saveConcurrencySetting,
  groupNodesByLevel,
  chunk,
  clearNodeImageRefs,
} from "./utils/executionUtils";
import {
  loadSaveConfigs,
  saveSaveConfig,
  generateWorkflowId,
} from "./utils/localStorage";
import {
  createDefaultNodeData,
  defaultNodeDimensions,
  GROUP_COLORS,
  GROUP_COLOR_ORDER,
} from "./utils/nodeDefaults";
import { evaluateRule } from "./utils/ruleEvaluation";

// Slices
import {
  createUISlice,
  createProviderSlice,
  createCostSlice,
  createCanvasNavSlice,
  createCommentSlice,
  createSnapshotSlice,
  createDimmingSlice,
} from "./slices";
import type {
  UISlice,
  ProviderSlice,
  CostSlice,
  CanvasNavSlice,
  CommentSlice,
  SnapshotSlice,
  DimmingSlice,
} from "./slices";

// Components / Utils
import { useToast } from "@/components/Toast";
import {
  WorkflowNode,
  WorkflowEdge,
  NodeType,
  NanoBananaNodeData,
  OutputGalleryNodeData,
  WorkflowNodeData,
  ImageHistoryItem,
  NodeGroup,
  GroupColor,
  ProviderType,
  ProviderSettings,
  RecentModel,
  CanvasNavigationSettings,
  MatchMode,
  MODEL_DISPLAY_NAMES,
} from "@/types";
import { externalizeWorkflowImages, hydrateWorkflowImages } from "@/utils/imageStorage";
import { logger } from "@/utils/logger";
import { EditOperation, applyEditOperations as executeEditOps } from "@/lib/chat/editOperations";

export type { LevelGroup } from "./utils/executionUtils";
export { CONCURRENCY_SETTINGS_KEY } from "./utils/executionUtils";

// ─── Conditional switch helper ──────────────────────────────────────────────

async function evaluateAndExecuteConditionalSwitch(
  node: WorkflowNode,
  executionCtx: NodeExecutionContext,
  getConnectedInputs: (nodeId: string) => ReturnType<WorkflowStore["getConnectedInputs"]>,
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void,
): Promise<void> {
  const condInputs = getConnectedInputs(node.id);
  const incomingText = condInputs.text;
  const nodeData = node.data as { rules: Array<{ id: string; value: string; mode: string; label: string; isMatched: boolean }> };

  const updatedRules = nodeData.rules.map(rule => {
    const isMatched = evaluateRule(incomingText, rule.value, rule.mode as MatchMode);
    return { ...rule, isMatched };
  });

  updateNodeData(node.id, {
    incomingText,
    rules: updatedRules,
    evaluationPaused: false,
  });

  await dispatchExecuteNode(executionCtx);
}

// ─── Log session helper ─────────────────────────────────────────────────────

function saveLogSession(): void {
  const session = logger.getCurrentSession();
  if (session) {
    session.endTime = new Date().toISOString();
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session }),
    }).catch((err) => {
      console.error('Failed to save log session:', err);
    });
  }
}

// ─── Edge style type ────────────────────────────────────────────────────────

export type EdgeStyle = "angular" | "curved";

// ─── Connection edge data builder ───────────────────────────────────────────

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

// ─── Workflow file format ───────────────────────────────────────────────────

export interface WorkflowFile {
  version: 1;
  id?: string;
  name: string;
  directoryPath?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  groups?: Record<string, NodeGroup>;
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

interface ClipboardData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ─── Image source helpers ───────────────────────────────────────────────────

const IMAGE_SOURCE_NODE_TYPES = new Set<string>([
  "imageInput", "annotation", "nanoBanana", "glbViewer", "videoFrameGrab",
]);

function clearStaleInputImages(
  removedEdges: WorkflowEdge[],
  get: () => WorkflowStore
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

// ─── Pending image sync tracker ─────────────────────────────────────────────

const pendingImageSyncs = new Map<string, Promise<void>>();

async function waitForPendingImageSyncs(timeout: number = 60000): Promise<void> {
  if (pendingImageSyncs.size === 0) return;

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = setTimeout(() => {
      console.warn(`Pending image syncs timed out after ${timeout}ms, continuing with save`);
      resolve();
    }, timeout);
  });

  try {
    await Promise.race([
      Promise.all(pendingImageSyncs.values()),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

// ─── Counters ───────────────────────────────────────────────────────────────

let nodeIdCounter = 0;
let groupIdCounter = 0;
let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

// Re-export for backward compatibility
export { generateWorkflowId, saveGenerateImageDefaults, saveNanoBananaDefaults } from "./utils/localStorage";
export { GROUP_COLORS } from "./utils/nodeDefaults";

// ─── Combined Store Interface ───────────────────────────────────────────────

interface WorkflowStore
  extends UISlice,
    ProviderSlice,
    CostSlice,
    CanvasNavSlice,
    CommentSlice,
    SnapshotSlice,
    DimmingSlice {
  // Core state
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

  // Copy/Paste
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

  // Execution
  isRunning: boolean;
  currentNodeIds: string[];
  pausedAtNodeId: string | null;
  maxConcurrentCalls: number;
  _abortController: AbortController | null;
  _buildExecutionContext: (node: WorkflowNode, signal?: AbortSignal) => NodeExecutionContext;
  executeWorkflow: (startFromNodeId?: string) => Promise<void>;
  regenerateNode: (nodeId: string) => Promise<void>;
  executeSelectedNodes: (nodeIds: string[]) => Promise<void>;
  stopWorkflow: () => void;
  setMaxConcurrentCalls: (value: number) => void;

  // Save/Load
  saveWorkflow: (name?: string) => void;
  loadWorkflow: (workflow: WorkflowFile, workflowPath?: string, options?: { preserveSnapshot?: boolean }) => Promise<void>;
  clearWorkflow: () => void;

  // Helpers
  getNodeById: (id: string) => WorkflowNode | undefined;
  getConnectedInputs: (nodeId: string) => { images: string[]; videos: string[]; audio: string[]; model3d: string | null; text: string | null; dynamicInputs: Record<string, string | string[]>; easeCurve: { bezierHandles: [number, number, number, number]; easingPreset: string | null; outputDuration: number } | null };
  validateWorkflow: () => { valid: boolean; errors: string[] };

  // Global Image History
  globalImageHistory: ImageHistoryItem[];
  addToGlobalHistory: (item: Omit<ImageHistoryItem, "id">) => void;
  clearGlobalHistory: () => void;

  // Auto-save state
  workflowId: string | null;
  workflowName: string | null;
  saveDirectoryPath: string | null;
  generationsPath: string | null;
  lastSavedAt: number | null;
  hasUnsavedChanges: boolean;
  autoSaveEnabled: boolean;
  isSaving: boolean;
  useExternalImageStorage: boolean;
  imageRefBasePath: string | null;

  // Auto-save actions
  setWorkflowMetadata: (id: string, name: string, path: string, generationsPath?: string | null) => void;
  setWorkflowName: (name: string) => void;
  setGenerationsPath: (path: string | null) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setUseExternalImageStorage: (enabled: boolean) => void;
  markAsUnsaved: () => void;
  saveToFile: () => Promise<boolean>;
  saveAsFile: (name: string) => Promise<boolean>;
  initializeAutoSave: () => void;
  cleanupAutoSave: () => void;
}

// ─── Store Implementation ───────────────────────────────────────────────────

const workflowStoreImpl: StateCreator<WorkflowStore> = (set, get, api) => ({
  // ── Compose slices ──────────────────────────────────────────────────────
  ...createUISlice(set, get, api),
  ...createProviderSlice(set, get, api),
  ...createCostSlice(set as never, get as never, api as never),
  ...createCanvasNavSlice(set, get, api),
  ...createCommentSlice(set as never, get as never, api as never),
  ...createSnapshotSlice(set as never, get as never, api as never),
  ...createDimmingSlice(set as never, get as never, api as never),

  // ── Core state ──────────────────────────────────────────────────────────
  nodes: [],
  edges: [],
  edgeStyle: "curved" as EdgeStyle,
  clipboard: null,
  groups: {},
  isRunning: false,
  currentNodeIds: [],
  pausedAtNodeId: null,
  maxConcurrentCalls: loadConcurrencySetting(),
  _abortController: null,
  globalImageHistory: [],

  // Auto-save initial state
  workflowId: null,
  workflowName: null,
  saveDirectoryPath: null,
  generationsPath: null,
  lastSavedAt: null,
  hasUnsavedChanges: false,
  autoSaveEnabled: true,
  isSaving: false,
  useExternalImageStorage: true,
  imageRefBasePath: null,

  // ── Settings ────────────────────────────────────────────────────────────

  setEdgeStyle: (style: EdgeStyle) => {
    set({ edgeStyle: style });
  },

  // ── Node operations ─────────────────────────────────────────────────────

  addNode: (type: NodeType, position: XYPosition, initialData?: Partial<WorkflowNodeData>) => {
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

    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
      ...(hasMeaningfulChange ? { hasUnsavedChanges: true } : {}),
    }));

    if (hasRemoveChange) {
      get().incrementManualChangeCount();
    }
  },

  // ── Edge operations ─────────────────────────────────────────────────────

  onEdgesChange: (changes: EdgeChange<WorkflowEdge>[]) => {
    const hasMeaningfulChange = changes.some((c) => c.type !== "select");
    const hasRemoveChange = changes.some((c) => c.type === "remove");
    const hasAddOrRemove = changes.some((c) => c.type === "add" || c.type === "remove");

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

  // ── Copy/Paste ──────────────────────────────────────────────────────────

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

  // ── Group operations ────────────────────────────────────────────────────

  createGroup: (nodeIds: string[]) => {
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

  // ── Helpers ─────────────────────────────────────────────────────────────

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

  // ── Execution context builder ───────────────────────────────────────────

  _buildExecutionContext: (node: WorkflowNode, signal?: AbortSignal): NodeExecutionContext => ({
    node,
    getConnectedInputs: get().getConnectedInputs,
    updateNodeData: get().updateNodeData,
    getFreshNode: (id: string) => get().nodes.find((n) => n.id === id),
    getEdges: () => get().edges,
    getNodes: () => get().nodes,
    signal,
    providerSettings: get().providerSettings,
    addIncurredCost: (cost: number) => get().addIncurredCost(cost),
    addToGlobalHistory: (item) => get().addToGlobalHistory(item),
    generationsPath: get().generationsPath,
    saveDirectoryPath: get().saveDirectoryPath,
    workflowId: get().workflowId,
    workflowName: get().workflowName,
    trackSaveGeneration: (key: string, promise: Promise<void>) => {
      pendingImageSyncs.set(key, promise);
      promise.finally(() => pendingImageSyncs.delete(key));
    },
    appendOutputGalleryImage: (targetId: string, image: string) => {
      set((state) => ({
        nodes: state.nodes.map((n) =>
          n.id === targetId && n.type === "outputGallery"
            ? { ...n, data: { ...n.data, images: [image, ...((n.data as OutputGalleryNodeData).images || [])] } as WorkflowNodeData }
            : n
        ) as WorkflowNode[],
        hasUnsavedChanges: true,
      }));
    },
    get: get as () => unknown,
  }),

  // ── Execution: executeWorkflow ──────────────────────────────────────────

  executeWorkflow: async (startFromNodeId?: string) => {
    const { nodes, edges, groups, isRunning, maxConcurrentCalls } = get();

    if (isRunning) {
      logger.warn('workflow.start', 'Workflow already running, ignoring execution request');
      return;
    }

    const abortController = new AbortController();
    const isResuming = startFromNodeId === get().pausedAtNodeId;
    set({ isRunning: true, pausedAtNodeId: null, currentNodeIds: [], _abortController: abortController });

    await logger.startSession();
    logger.info('workflow.start', 'Workflow execution started', {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      startFromNodeId,
      isResuming,
      maxConcurrentCalls,
    });

    const levels = groupNodesByLevel(nodes, edges);

    let startLevel = 0;
    if (startFromNodeId) {
      const foundLevel = levels.findIndex((l) => l.nodeIds.includes(startFromNodeId));
      if (foundLevel !== -1) startLevel = foundLevel;
    }

    const executeSingleNode = async (node: WorkflowNode, signal: AbortSignal): Promise<void> => {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      const dimmedNodeIds = get().dimmedNodeIds;
      if (dimmedNodeIds.has(node.id)) {
        logger.info('node.execution', 'Node skipped (downstream of disabled Switch)', {
          nodeId: node.id,
          nodeType: node.type,
        });
        return;
      }

      const isResumingThisNode = isResuming && node.id === startFromNodeId;
      if (!isResumingThisNode) {
        const incomingEdges = edges.filter((e) => e.target === node.id);
        const pauseEdge = incomingEdges.find((e) => e.data?.hasPause);
        if (pauseEdge) {
          logger.info('workflow.end', 'Workflow paused at node', {
            nodeId: node.id,
            nodeType: node.type,
          });
          set({ pausedAtNodeId: node.id });
          useToast.getState().show("Workflow paused - click Run to continue", "warning");
          abortController.abort();
          return;
        }
      }

      const nodeGroup = node.groupId ? groups[node.groupId] : null;
      if (nodeGroup?.locked) {
        logger.info('node.execution', `Skipping node in locked group`, {
          nodeId: node.id,
          nodeType: node.type,
          groupId: node.groupId,
          groupName: nodeGroup.name,
        });
        return;
      }

      logger.info('node.execution', `Executing ${node.type} node`, {
        nodeId: node.id,
        nodeType: node.type,
      });

      const executionCtx = get()._buildExecutionContext(node, signal);

      // conditionalSwitch needs pre-evaluation of rules before dispatch
      if (node.type === "conditionalSwitch") {
        await evaluateAndExecuteConditionalSwitch(node, executionCtx, get().getConnectedInputs, get().updateNodeData);
      } else {
        await dispatchExecuteNode(executionCtx);
      }
    };

    try {
      for (let levelIdx = startLevel; levelIdx < levels.length; levelIdx++) {
        if (abortController.signal.aborted || !get().isRunning) break;

        const level = levels[levelIdx];
        const levelNodes = level.nodeIds
          .map((id) => nodes.find((n) => n.id === id))
          .filter((n): n is WorkflowNode => n !== undefined);

        if (levelNodes.length === 0) continue;

        const batches = chunk(levelNodes, maxConcurrentCalls);

        for (const batch of batches) {
          if (abortController.signal.aborted || !get().isRunning) break;

          const batchIds = batch.map((n) => n.id);
          set({ currentNodeIds: batchIds });

          logger.info('node.execution', `Executing level ${levelIdx} batch`, {
            level: levelIdx,
            nodeCount: batch.length,
            nodeIds: batchIds,
          });

          const results = await Promise.allSettled(
            batch.map((node) => executeSingleNode(node, abortController.signal))
          );

          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r.status === 'rejected' &&
                !(r.reason instanceof DOMException && r.reason.name === 'AbortError')) {
              const failedNode = batch[i];
              logger.error('workflow.error', 'Node execution failed in parallel batch', {
                level: levelIdx,
                nodeId: failedNode.id,
                nodeType: failedNode.type,
                error: r.reason instanceof Error ? r.reason.message : String(r.reason),
              });
              abortController.abort();
              throw r.reason;
            }
          }
        }
      }

      if (!abortController.signal.aborted && get().isRunning) {
        logger.info('workflow.end', 'Workflow execution completed successfully');
      }

      set({ isRunning: false, currentNodeIds: [], _abortController: null });
      saveLogSession();
      await logger.endSession();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        logger.info('workflow.end', 'Workflow execution cancelled by user');
      } else {
        logger.error('workflow.error', 'Workflow execution failed', {}, error instanceof Error ? error : undefined);
        useToast.getState().show(
          `Workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          "error"
        );
      }
      set({ isRunning: false, currentNodeIds: [], _abortController: null });
      saveLogSession();
      await logger.endSession();
    }
  },

  stopWorkflow: () => {
    const controller = get()._abortController;
    if (controller) {
      controller.abort("user-cancelled");
    }
    set({ isRunning: false, currentNodeIds: [], _abortController: null });
  },

  setMaxConcurrentCalls: (value: number) => {
    const clamped = Math.max(1, Math.min(10, value));
    saveConcurrencySetting(clamped);
    set({ maxConcurrentCalls: clamped });
  },

  // ── Execution: regenerateNode ───────────────────────────────────────────

  regenerateNode: async (nodeId: string) => {
    const { nodes, updateNodeData, isRunning } = get();

    if (isRunning) {
      logger.warn('node.execution', 'Cannot regenerate node, workflow already running', { nodeId });
      return;
    }

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) {
      logger.warn('node.error', 'Node not found for regeneration', { nodeId });
      return;
    }

    set({ isRunning: true, currentNodeIds: [nodeId] });

    await logger.startSession();
    logger.info('node.execution', 'Regenerating node', {
      nodeId,
      nodeType: node.type,
    });

    try {
      const executionCtx = get()._buildExecutionContext(node);

      // Use centralized dispatcher with stored fallback for regen
      await dispatchExecuteNode(executionCtx, { useStoredFallback: true });

      // Propagate to downstream consumer nodes
      const { edges: currentEdges } = get();
      const downstreamEdges = currentEdges.filter(e => e.source === nodeId);
      for (const edge of downstreamEdges) {
        const targetNode = get().nodes.find(n => n.id === edge.target);
        if (!targetNode) continue;
        // Only propagate to display/consumer nodes
        const consumerTypes = new Set(["glbViewer", "output", "outputGallery", "imageCompare"]);
        if (consumerTypes.has(targetNode.type ?? "")) {
          const targetCtx = get()._buildExecutionContext(targetNode);
          await dispatchExecuteNode(targetCtx);
        }
      }

      logger.info('node.execution', 'Node regeneration completed successfully', { nodeId });
      set({ isRunning: false, currentNodeIds: [] });

      saveLogSession();
      await logger.endSession();
    } catch (error) {
      logger.error('node.error', 'Node regeneration failed', {
        nodeId,
      }, error instanceof Error ? error : undefined);
      updateNodeData(nodeId, {
        status: "error",
        error: error instanceof Error ? error.message : "Regeneration failed",
      });
      set({ isRunning: false, currentNodeIds: [] });

      saveLogSession();
      await logger.endSession();
    }
  },

  // ── Execution: executeSelectedNodes ─────────────────────────────────────

  executeSelectedNodes: async (nodeIds: string[]) => {
    const { nodes, edges, isRunning, maxConcurrentCalls } = get();

    if (isRunning) {
      logger.warn('node.execution', 'Cannot execute nodes, workflow already running');
      return;
    }

    if (nodeIds.length === 0) {
      logger.warn('node.execution', 'No nodes provided for execution');
      return;
    }

    const selectedSet = new Set(nodeIds);
    const nodesToExecute = nodeIds
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is WorkflowNode => n !== undefined);

    if (nodesToExecute.length === 0) {
      logger.warn('node.execution', 'No valid nodes found for execution');
      return;
    }

    const abortController = new AbortController();
    set({ isRunning: true, currentNodeIds: nodeIds, _abortController: abortController });

    await logger.startSession();
    logger.info('node.execution', 'Executing selected nodes', {
      nodeCount: nodesToExecute.length,
      nodeIds,
    });

    const executeNodeWithContext = async (node: WorkflowNode, signal: AbortSignal) => {
      if (signal.aborted) {
        throw new DOMException('Aborted', 'AbortError');
      }

      logger.info('node.execution', `Executing ${node.type} node`, {
        nodeId: node.id,
        nodeType: node.type,
      });

      const executionCtx = get()._buildExecutionContext(node, signal);

      if (node.type === "conditionalSwitch") {
        await evaluateAndExecuteConditionalSwitch(node, executionCtx, get().getConnectedInputs, get().updateNodeData);
      } else {
        await dispatchExecuteNode(executionCtx, { useStoredFallback: true });
      }
    };

    try {
      const selectedEdges = edges.filter(
        (e) => selectedSet.has(e.source) && selectedSet.has(e.target)
      );

      const levels = groupNodesByLevel(nodesToExecute, selectedEdges);

      for (const level of levels) {
        if (abortController.signal.aborted || !get().isRunning) break;

        const levelNodes = level.nodeIds
          .map((id) => nodesToExecute.find((n) => n.id === id))
          .filter((n): n is WorkflowNode => n !== undefined);

        if (levelNodes.length === 0) continue;

        const batches = chunk(levelNodes, maxConcurrentCalls);

        for (const batch of batches) {
          if (abortController.signal.aborted || !get().isRunning) break;

          const batchIds = batch.map((n) => n.id);
          set({ currentNodeIds: batchIds });

          logger.info('node.execution', `Executing batch of selected nodes`, {
            level: level.level,
            nodeCount: batch.length,
            nodeIds: batchIds,
          });

          const results = await Promise.allSettled(
            batch.map((node) => executeNodeWithContext(node, abortController.signal))
          );

          const failed = results.find(
            (r): r is PromiseRejectedResult =>
              r.status === 'rejected' &&
              !(r.reason instanceof DOMException && r.reason.name === 'AbortError')
          );

          if (failed) {
            logger.error('node.error', 'Node execution failed in batch', {
              level: level.level,
              error: failed.reason instanceof Error ? failed.reason.message : String(failed.reason),
            });
            abortController.abort();
            throw failed.reason;
          }
        }
      }

      // Propagate to downstream consumer nodes not in the selected set
      if (!abortController.signal.aborted && get().isRunning) {
        const { edges: currentEdges } = get();
        const propagated = new Set<string>();
        const consumerTypes = new Set(["glbViewer", "output", "outputGallery", "imageCompare"]);

        for (const nId of nodeIds) {
          const downstreamEdges = currentEdges.filter(e => e.source === nId);
          for (const edge of downstreamEdges) {
            if (selectedSet.has(edge.target) || propagated.has(edge.target)) continue;
            const targetNode = get().nodes.find(n => n.id === edge.target);
            if (!targetNode || !consumerTypes.has(targetNode.type ?? "")) continue;
            const targetCtx = get()._buildExecutionContext(targetNode);
            await dispatchExecuteNode(targetCtx);
            propagated.add(edge.target);
          }
        }
      }

      logger.info('node.execution', 'Selected nodes execution completed successfully');
      set({ isRunning: false, currentNodeIds: [], _abortController: null });

      saveLogSession();
      await logger.endSession();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        logger.info('node.execution', 'Selected nodes execution cancelled by user');
      } else {
        logger.error('node.error', 'Selected nodes execution failed', {}, error instanceof Error ? error : undefined);
        useToast.getState().show(
          `Execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          "error"
        );
      }
      set({ isRunning: false, currentNodeIds: [], _abortController: null });

      saveLogSession();
      await logger.endSession();
    }
  },

  // ── Save/Load ───────────────────────────────────────────────────────────

  saveWorkflow: (name?: string) => {
    const { nodes, edges, edgeStyle, groups } = get();

    const workflow: WorkflowFile = {
      version: 1,
      name: name || `workflow-${new Date().toISOString().slice(0, 10)}`,
      nodes: nodes.map(({ selected, ...rest }) => rest),
      edges,
      edgeStyle,
      groups: groups && Object.keys(groups).length > 0 ? groups : undefined,
    };

    const json = JSON.stringify(workflow, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${workflow.name}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  loadWorkflow: async (workflow: WorkflowFile, workflowPath?: string, options?: { preserveSnapshot?: boolean }) => {
    // Update nodeIdCounter to avoid ID collisions
    const maxNodeId = workflow.nodes.reduce((max, node) => {
      const match = node.id.match(/-(\d+)$/);
      if (match) {
        return Math.max(max, parseInt(match[1], 10));
      }
      return max;
    }, 0);
    nodeIdCounter = maxNodeId;

    // Update groupIdCounter to avoid ID collisions
    const maxGroupId = Object.keys(workflow.groups || {}).reduce((max, id) => {
      const match = id.match(/-(\d+)$/);
      if (match) {
        return Math.max(max, parseInt(match[1], 10));
      }
      return max;
    }, 0);
    groupIdCounter = maxGroupId;

    // Migrate legacy nanoBanana nodes
    workflow.nodes = workflow.nodes.map((node) => {
      if (node.type === "nanoBanana") {
        const data = node.data as NanoBananaNodeData;
        if (data.model && !data.selectedModel) {
          const displayName = MODEL_DISPLAY_NAMES[data.model] || data.model;
          return {
            ...node,
            data: {
              ...data,
              selectedModel: {
                provider: "gemini" as ProviderType,
                modelId: data.model,
                displayName,
              },
            },
          };
        }
      }
      return node;
    }) as WorkflowNode[];

    // Migrate legacy indexed handle IDs on edges
    const nanoBananaNodeIds = new Set(
      workflow.nodes.filter((n) => n.type === "nanoBanana").map((n) => n.id)
    );
    workflow.edges = workflow.edges.map((edge) => {
      if (!nanoBananaNodeIds.has(edge.target)) return edge;
      const th = edge.targetHandle;
      if (th === "image-0" || th === "text-0") {
        const baseHandle = th === "image-0" ? "image" : "text";
        return {
          ...edge,
          targetHandle: baseHandle,
          id: `edge-${edge.source}-${edge.target}-${edge.sourceHandle || "default"}-${baseHandle}`,
        };
      }
      return edge;
    });

    // Deduplicate edges by ID
    const edgeById = new Map<string, WorkflowEdge>();
    for (const edge of workflow.edges) {
      edgeById.set(edge.id, edge);
    }
    if (edgeById.size < workflow.edges.length) {
      workflow.edges = Array.from(edgeById.values());
    }

    // Look up saved config
    const configs = loadSaveConfigs();
    const savedConfig = workflow.id ? configs[workflow.id] : null;

    const directoryPath = workflowPath || savedConfig?.directoryPath || workflow.directoryPath || null;

    // Hydrate images
    let hydratedWorkflow = workflow;
    if (directoryPath) {
      try {
        hydratedWorkflow = await hydrateWorkflowImages(workflow, directoryPath);
      } catch (error) {
        console.error("Failed to hydrate workflow images:", error);
      }
    }

    // Load cost data
    const costData = workflow.id ? (await import("./utils/localStorage")).loadWorkflowCostData(workflow.id) : null;

    set({
      nodes: hydratedWorkflow.nodes.map(node => ({
        ...node,
        selected: false,
        position: {
          x: isFinite(node.position?.x) ? node.position.x : 0,
          y: isFinite(node.position?.y) ? node.position.y : 0,
        },
      })),
      edges: hydratedWorkflow.edges,
      edgeStyle: hydratedWorkflow.edgeStyle || "angular",
      groups: hydratedWorkflow.groups || {},
      isRunning: false,
      currentNodeIds: [],
      workflowId: workflow.id || null,
      workflowName: workflow.name,
      saveDirectoryPath: directoryPath || null,
      generationsPath: savedConfig?.generationsPath || null,
      lastSavedAt: savedConfig?.lastSavedAt || null,
      hasUnsavedChanges: false,
      incurredCost: costData?.incurredCost || 0,
      imageRefBasePath: directoryPath || null,
      useExternalImageStorage: savedConfig?.useExternalImageStorage ?? true,
      viewedCommentNodeIds: new Set<string>(),
      showQuickstart: false,
    });

    if (!options?.preserveSnapshot) {
      get().clearSnapshot();
    }

    get().recomputeDimmedNodes();
  },

  clearWorkflow: () => {
    set({
      nodes: [],
      edges: [],
      groups: {},
      isRunning: false,
      currentNodeIds: [],
      workflowId: null,
      workflowName: null,
      saveDirectoryPath: null,
      generationsPath: null,
      lastSavedAt: null,
      hasUnsavedChanges: false,
      incurredCost: 0,
      imageRefBasePath: null,
      viewedCommentNodeIds: new Set<string>(),
      dimmedNodeIds: new Set<string>(),
    });
    get().clearSnapshot();
  },

  // ── Global Image History ────────────────────────────────────────────────

  addToGlobalHistory: (item: Omit<ImageHistoryItem, "id">) => {
    const newItem: ImageHistoryItem = {
      ...item,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    set((state) => ({
      globalImageHistory: [newItem, ...state.globalImageHistory],
    }));
  },

  clearGlobalHistory: () => {
    set({ globalImageHistory: [] });
  },

  // ── Auto-save ───────────────────────────────────────────────────────────

  setWorkflowMetadata: (id: string, name: string, path: string, generationsPath?: string | null) => {
    const currentGenPath = get().generationsPath;
    const derivedGenerationsPath = generationsPath ?? currentGenPath ?? `${path}/generations`;
    set({
      workflowId: id,
      workflowName: name,
      saveDirectoryPath: path,
      generationsPath: derivedGenerationsPath,
    });
  },

  setWorkflowName: (name: string) => {
    set({ workflowName: name, hasUnsavedChanges: true });
  },

  setGenerationsPath: (path: string | null) => {
    set({ generationsPath: path });
  },

  setAutoSaveEnabled: (enabled: boolean) => {
    set({ autoSaveEnabled: enabled });
  },

  setUseExternalImageStorage: (enabled: boolean) => {
    set({ useExternalImageStorage: enabled });
  },

  markAsUnsaved: () => {
    set({ hasUnsavedChanges: true });
  },

  saveToFile: async () => {
    let {
      nodes,
      edges,
      edgeStyle,
      groups,
      workflowId,
      workflowName,
      saveDirectoryPath,
      useExternalImageStorage,
      imageRefBasePath,
    } = get();

    if (!workflowId || !workflowName || !saveDirectoryPath) {
      return false;
    }

    set({ isSaving: true });

    try {
      await waitForPendingImageSyncs();

      let currentNodes = get().nodes;

      const hasExistingRefs = currentNodes.some(node => {
        const data = node.data as Record<string, unknown>;
        return data.imageRef || data.outputImageRef || data.sourceImageRef || data.inputImageRefs;
      });

      const isNewDirectory = useExternalImageStorage && (
        (imageRefBasePath !== null && imageRefBasePath !== saveDirectoryPath) ||
        (imageRefBasePath === null && hasExistingRefs)
      );

      if (isNewDirectory) {
        const newWorkflowId = generateWorkflowId();
        workflowId = newWorkflowId;
        currentNodes = clearNodeImageRefs(currentNodes);
        set({ nodes: currentNodes, workflowId: newWorkflowId });
      }

      let workflow: WorkflowFile = {
        version: 1,
        id: workflowId,
        name: workflowName,
        nodes: currentNodes,
        edges,
        edgeStyle,
        groups: groups && Object.keys(groups).length > 0 ? groups : undefined,
      };

      if (useExternalImageStorage) {
        workflow = await externalizeWorkflowImages(workflow, saveDirectoryPath);
      }

      const response = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directoryPath: saveDirectoryPath,
          filename: workflowName,
          workflow,
        }),
      });

      const result = await response.json();

      if (result.success) {
        const timestamp = Date.now();

        if (useExternalImageStorage && workflow.nodes !== currentNodes) {
          const nodesWithRefs = currentNodes.map((node, index) => {
            const externalizedNode = workflow.nodes[index];
            if (!externalizedNode || node.id !== externalizedNode.id) {
              return node;
            }

            const mergedData = { ...node.data } as Record<string, unknown>;
            const extData = externalizedNode.data as Record<string, unknown>;

            if (extData.imageRef && typeof extData.imageRef === 'string') {
              mergedData.imageRef = extData.imageRef;
            }
            if (extData.sourceImageRef && typeof extData.sourceImageRef === 'string') {
              mergedData.sourceImageRef = extData.sourceImageRef;
            }
            if (extData.outputImageRef && typeof extData.outputImageRef === 'string') {
              mergedData.outputImageRef = extData.outputImageRef;
            }
            if (extData.inputImageRefs && Array.isArray(extData.inputImageRefs)) {
              mergedData.inputImageRefs = extData.inputImageRefs;
            }

            return { ...node, data: mergedData as WorkflowNodeData } as WorkflowNode;
          });

          set({
            nodes: nodesWithRefs,
            lastSavedAt: timestamp,
            hasUnsavedChanges: false,
            imageRefBasePath: saveDirectoryPath,
          });
        } else {
          set({
            lastSavedAt: timestamp,
            hasUnsavedChanges: false,
            imageRefBasePath: useExternalImageStorage ? saveDirectoryPath : null,
          });
        }

        saveSaveConfig({
          workflowId,
          name: workflowName,
          directoryPath: saveDirectoryPath,
          generationsPath: get().generationsPath,
          lastSavedAt: timestamp,
          useExternalImageStorage,
        });

        return true;
      } else {
        useToast.getState().show(`Auto-save failed: ${result.error}`, "error");
        return false;
      }
    } catch (error) {
      useToast
        .getState()
        .show(
          `Auto-save failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          "error"
        );
      return false;
    } finally {
      set({ isSaving: false });
    }
  },

  saveAsFile: async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) return false;

    const { saveDirectoryPath, workflowId: prevId, workflowName: prevName, hasUnsavedChanges: prevUnsaved } = get();
    if (!saveDirectoryPath) return false;

    const newWorkflowId = generateWorkflowId();
    set({
      workflowId: newWorkflowId,
      workflowName: trimmedName,
      hasUnsavedChanges: true,
    });

    const success = await get().saveToFile();
    if (!success) {
      set({ workflowId: prevId, workflowName: prevName, hasUnsavedChanges: prevUnsaved });
    }
    return success;
  },

  initializeAutoSave: () => {
    if (autoSaveIntervalId) return;

    autoSaveIntervalId = setInterval(async () => {
      const state = get();
      if (
        state.autoSaveEnabled &&
        state.hasUnsavedChanges &&
        state.workflowId &&
        state.workflowName &&
        state.saveDirectoryPath &&
        !state.isSaving
      ) {
        await state.saveToFile();
      }
    }, 90 * 1000);
  },

  cleanupAutoSave: () => {
    if (autoSaveIntervalId) {
      clearInterval(autoSaveIntervalId);
      autoSaveIntervalId = null;
    }
  },
});

// ─── Create Store ─────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowStore>()(workflowStoreImpl);

// ─── Convenience hooks ────────────────────────────────────────────────────

/**
 * Stable hook for provider API keys.
 * Uses shallow equality to prevent unnecessary re-renders.
 */
export function useProviderApiKeys() {
  return useWorkflowStore(
    useShallow((state) => ({
      geminiApiKey: state.providerSettings.providers.gemini?.apiKey ?? null,
      replicateApiKey: state.providerSettings.providers.replicate?.apiKey ?? null,
      falApiKey: state.providerSettings.providers.fal?.apiKey ?? null,
      kieApiKey: state.providerSettings.providers.kie?.apiKey ?? null,
      wavespeedApiKey: state.providerSettings.providers.wavespeed?.apiKey ?? null,
      replicateEnabled: state.providerSettings.providers.replicate?.enabled ?? false,
      kieEnabled: state.providerSettings.providers.kie?.enabled ?? false,
    }))
  );
}
