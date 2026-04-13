/**
 * persistenceStore.ts — Persistence Slice (Zona Congelata)
 *
 * Owns: workflowId, workflowName, saveDirectoryPath, generationsPath, lastSavedAt,
 *       hasUnsavedChanges, autoSaveEnabled, isSaving, useExternalImageStorage,
 *       imageRefBasePath, globalImageHistory.
 * Provides: save/load/clear workflow, auto-save, metadata helpers, global image history.
 *
 * ZONA CONGELATA — Do NOT modify without contract test + PR review.
 * See CLAUDE.md § "Zona Congelata" for rules.
 */

import type { StateCreator } from "zustand";

import {
  loadSaveConfigs,
  saveSaveConfig,
  generateWorkflowId,
} from "./utils/localStorage";
import { setNodeIdCounter, setGroupIdCounter } from "./graphStore";
import type { EdgeStyle } from "./graphStore";
import { externalizeWorkflowImages, hydrateWorkflowImages } from "@/utils/imageStorage";
import { clearNodeImageRefs } from "./utils/executionUtils";
import { useToast } from "@/components/Toast";

import type {
  WorkflowNode,
  WorkflowEdge,
  NodeGroup,
  WorkflowNodeData,
  NanoBananaNodeData,
  ImageHistoryItem,
  ProviderSettings,
  ProviderType,
  MODEL_DISPLAY_NAMES,
} from "@/types";
import { MODEL_DISPLAY_NAMES as MODEL_DISPLAY_NAMES_CONST } from "@/types";

// ─── Module-level state ────────────────────────────────────────────────────────

/** Auto-save interval handle — lives outside Zustand state. */
let autoSaveIntervalId: ReturnType<typeof setInterval> | null = null;

/** In-flight image save promises, tracked to avoid saving while syncing. */
export const pendingImageSyncs = new Map<string, Promise<void>>();

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

// ─── Workflow file format ──────────────────────────────────────────────────────

export interface WorkflowFile {
  version: 1;
  id?: string;
  name: string;
  directoryPath?: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  groups?: Record<string, NodeGroup>;
  packVersions?: Record<string, string>;
}

// ─── Deps (cross-slice access) ────────────────────────────────────────────────

/** Declares which other slice properties persistenceStore needs at runtime. */
export interface PersistenceSliceDeps {
  // GraphSlice
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  edgeStyle: EdgeStyle;
  groups: Record<string, NodeGroup>;
  // SnapshotSlice
  clearSnapshot: () => void;
  // DimmingSlice
  recomputeDimmedNodes: () => void;
  // CostSlice
  incurredCost: number;
  // ExecutionSlice state that persistenceStore sets via Zustand cross-slice set()
  isRunning: boolean;
  currentNodeIds: string[];
  // UISlice state that persistenceStore sets
  showQuickstart: boolean;
  // CommentSlice state that persistenceStore sets
  viewedCommentNodeIds: Set<string>;
  // DimmingSlice state that persistenceStore sets
  dimmedNodeIds: Set<string>;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface PersistenceSlice {
  // State
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

  // Global Image History
  globalImageHistory: ImageHistoryItem[];
  addToGlobalHistory: (item: Omit<ImageHistoryItem, "id">) => void;
  clearGlobalHistory: () => void;

  // Save/Load actions
  saveWorkflow: (name?: string) => void;
  loadWorkflow: (workflow: WorkflowFile, workflowPath?: string, options?: { preserveSnapshot?: boolean }) => Promise<void>;
  clearWorkflow: () => void;

  // Metadata helpers
  setWorkflowMetadata: (id: string, name: string, path: string, generationsPath?: string | null) => void;
  setWorkflowName: (name: string) => void;
  setGenerationsPath: (path: string | null) => void;
  setAutoSaveEnabled: (enabled: boolean) => void;
  setUseExternalImageStorage: (enabled: boolean) => void;
  markAsUnsaved: () => void;

  // File persistence
  saveToFile: () => Promise<boolean>;
  saveAsFile: (name: string) => Promise<boolean>;

  // Auto-save lifecycle
  initializeAutoSave: () => void;
  cleanupAutoSave: () => void;
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export const createPersistenceSlice: StateCreator<
  PersistenceSlice & PersistenceSliceDeps,
  [],
  [],
  PersistenceSlice
> = (set, get) => ({

  // ── State ──────────────────────────────────────────────────────────────────
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
  globalImageHistory: [],

  // ── Global Image History ──────────────────────────────────────────────────

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

  // ── saveWorkflow (browser download) ──────────────────────────────────────

  saveWorkflow: (name?: string) => {
    const { nodes, edges, edgeStyle, groups } = get();

    // Collect pack versions from installed manifests
    // TODO: Populate from NodePackManager active packs when available
    // For now, this is a placeholder that can be filled in on save
    const packVersions: Record<string, string> = {};
    try {
      // Attempt to get pack versions from localStorage or Zustand if available
      // Since we don't have direct access here, document for future integration
      // This will be properly populated when NodePackManager integration is complete
    } catch {
      // Non-critical — just skip if we can't get versions
    }

    const workflow: WorkflowFile = {
      version: 1,
      name: name || `workflow-${new Date().toISOString().slice(0, 10)}`,
      nodes: nodes.map(({ selected, ...rest }) => rest),
      edges,
      edgeStyle,
      groups: groups && Object.keys(groups).length > 0 ? groups : undefined,
      ...(Object.keys(packVersions).length > 0 && { packVersions }),
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

  // ── loadWorkflow ──────────────────────────────────────────────────────────

  loadWorkflow: async (workflow: WorkflowFile, workflowPath?: string, options?: { preserveSnapshot?: boolean }) => {
    // Sync ID counters to avoid collisions
    const maxNodeId = workflow.nodes.reduce((max, node) => {
      const match = node.id.match(/-(\d+)$/);
      if (match) return Math.max(max, parseInt(match[1], 10));
      return max;
    }, 0);
    setNodeIdCounter(maxNodeId);

    const maxGroupId = Object.keys(workflow.groups || {}).reduce((max, id) => {
      const match = id.match(/-(\d+)$/);
      if (match) return Math.max(max, parseInt(match[1], 10));
      return max;
    }, 0);
    setGroupIdCounter(maxGroupId);

    // Check pack versions for compatibility warnings
    if (workflow.packVersions && Object.keys(workflow.packVersions).length > 0) {
      try {
        // TODO: Compare with current installed pack versions when NodePackManager integration is complete
        // For now, just log the saved pack versions for debugging
        const packInfo = Object.entries(workflow.packVersions)
          .map(([pack, version]) => `${pack}@${version}`)
          .join(", ");
        console.info(`Workflow created with packs: ${packInfo}`);
      } catch (error) {
        console.warn("Failed to check pack version compatibility:", error);
      }
    }

    // Migrate legacy nanoBanana nodes
    workflow.nodes = workflow.nodes.map((node) => {
      if (node.type === "nanoBanana") {
        const data = node.data as NanoBananaNodeData;
        if (data.model && !data.selectedModel) {
          const displayName = MODEL_DISPLAY_NAMES_CONST[data.model] || data.model;
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

  // ── clearWorkflow ─────────────────────────────────────────────────────────

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

  // ── Metadata helpers ──────────────────────────────────────────────────────

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

  // ── saveToFile ────────────────────────────────────────────────────────────

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

      // Collect pack versions from installed manifests
      // TODO: Integrate with NodePackManager to get current pack versions
      // For now, this is a placeholder for future phase where pack metadata is available
      const packVersions: Record<string, string> = {};
      try {
        // Fetch from NodePackManager store or localStorage when integrated
        // This will help detect when workflows are loaded with incompatible pack versions
      } catch {
        // Non-critical — just skip if we can't get versions
      }

      let workflow: WorkflowFile = {
        version: 1,
        id: workflowId,
        name: workflowName,
        nodes: currentNodes,
        edges,
        edgeStyle,
        groups: groups && Object.keys(groups).length > 0 ? groups : undefined,
        ...(Object.keys(packVersions).length > 0 && { packVersions }),
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

  // ── saveAsFile ────────────────────────────────────────────────────────────

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

  // ── Auto-save lifecycle ────────────────────────────────────────────────────

  initializeAutoSave: () => {
    if (autoSaveIntervalId !== null) return; // Already running

    const { autoSaveEnabled, saveToFile } = get();
    if (!autoSaveEnabled) return;

    autoSaveIntervalId = setInterval(async () => {
      const state = get();
      if (state.hasUnsavedChanges && !state.isSaving) {
        await state.saveToFile();
      }
    }, 90000); // 90 seconds
  },

  cleanupAutoSave: () => {
    if (autoSaveIntervalId !== null) {
      clearInterval(autoSaveIntervalId);
      autoSaveIntervalId = null;
    }
  },
});