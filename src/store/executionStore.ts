/**
 * executionStore.ts — Execution Slice (Zona Congelata)
 *
 * Owns: isRunning, currentNodeIds, pausedAtNodeId, maxConcurrentCalls, _abortController.
 * Provides: executeWorkflow, regenerateNode, executeSelectedNodes, stopWorkflow.
 *
 * ZONA CONGELATA — Do NOT modify without contract test + PR review.
 * See CLAUDE.md § "Zona Congelata" for rules.
 */

import type { StateCreator } from "zustand";

import { executeNode as dispatchExecuteNode } from "./execution/executeNode";
import type { NodeExecutionContext } from "./execution";
// NOTE: executeOutput etc. are imported by executeNode.ts internally; not used directly here.
// Keeping import to avoid breaking existing references if any.
// import { executeOutput, executeOutputGallery, executeImageCompare, executeGlbViewer } from "./execution";
import { pendingImageSyncs } from "./persistenceStore";
import {
  CONCURRENCY_SETTINGS_KEY,
  loadConcurrencySetting,
  saveConcurrencySetting,
  groupNodesByLevel,
  chunk,
} from "./utils/executionUtils";
import { evaluateRule } from "./utils/ruleEvaluation";
import { useToast } from "@/components/Toast";
import { logger } from "@/utils/logger";

import type {
  WorkflowNode,
  WorkflowEdge,
  NodeGroup,
  WorkflowNodeData,
  OutputGalleryNodeData,
  ProviderSettings,
  ImageHistoryItem,
  ArrayNodeData,
  MatchMode,
} from "@/types";

export { CONCURRENCY_SETTINGS_KEY } from "./utils/executionUtils";

// ─── Module-level helpers ─────────────────────────────────────────────────────

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

async function evaluateAndExecuteConditionalSwitch(
  node: WorkflowNode,
  executionCtx: NodeExecutionContext,
  getConnectedInputs: (nodeId: string) => { text: string | null; [key: string]: unknown },
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

// ─── Deps (cross-slice access) ────────────────────────────────────────────────

/** Declares which other slice properties executionStore needs at runtime. */
export interface ExecutionSliceDeps {
  // GraphSlice
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups: Record<string, NodeGroup>;
  getConnectedInputs: (nodeId: string) => { images: string[]; videos: string[]; audio: string[]; model3d: string | null; text: string | null; dynamicInputs: Record<string, string | string[]>; easeCurve: { bezierHandles: [number, number, number, number]; easingPreset: string | null; outputDuration: number } | null };
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  // DimmingSlice
  dimmedNodeIds: Set<string>;
  // PersistenceSlice
  generationsPath: string | null;
  saveDirectoryPath: string | null;
  workflowId: string | null;
  workflowName: string | null;
  addToGlobalHistory: (item: Omit<ImageHistoryItem, "id">) => void;
  // CostSlice
  addIncurredCost: (cost: number) => void;
  // ProviderSlice
  providerSettings: ProviderSettings;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface ExecutionSlice {
  // State
  isRunning: boolean;
  currentNodeIds: string[];
  pausedAtNodeId: string | null;
  maxConcurrentCalls: number;
  _abortController: AbortController | null;

  // Actions
  _buildExecutionContext: (node: WorkflowNode, signal?: AbortSignal) => NodeExecutionContext;
  executeWorkflow: (startFromNodeId?: string) => Promise<void>;
  regenerateNode: (nodeId: string) => Promise<void>;
  executeSelectedNodes: (nodeIds: string[]) => Promise<void>;
  stopWorkflow: () => void;
  setMaxConcurrentCalls: (value: number) => void;
}

// ─── Creator ──────────────────────────────────────────────────────────────────

export const createExecutionSlice: StateCreator<
  ExecutionSlice & ExecutionSliceDeps,
  [],
  [],
  ExecutionSlice
> = (set, get) => ({

  // ── State ──────────────────────────────────────────────────────────────────
  isRunning: false,
  currentNodeIds: [],
  pausedAtNodeId: null,
  maxConcurrentCalls: loadConcurrencySetting(),
  _abortController: null,

  // ── Execution context builder ─────────────────────────────────────────────

  _buildExecutionContext: (node: WorkflowNode, signal?: AbortSignal): NodeExecutionContext => {
    return {
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
    };
  },

  // ── executeWorkflow ────────────────────────────────────────────────────────

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

      const freshNodeForBypass = get().nodes.find(n => n.id === node.id);
      if (freshNodeForBypass?.data?.bypassed) {
        logger.info('node.execution', 'Node skipped (bypassed)', {
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

        // ── Batch-mode Array node handling ──────────────────────────────────
        if (levelIdx < levels.length - 1 && !abortController.signal.aborted && get().isRunning) {
          const batchArrayNode = levelNodes.find((n) => {
            if (n.type !== "array") return false;
            const freshN = get().nodes.find((fn) => fn.id === n.id);
            const data = freshN?.data as ArrayNodeData | undefined;
            return data?.batchMode === true && (data?.outputItems?.length ?? 0) > 0;
          });

          if (batchArrayNode) {
            const freshBatch = get().nodes.find((n) => n.id === batchArrayNode.id);
            const batchData = freshBatch?.data as ArrayNodeData | undefined;
            const items = batchData?.outputItems ?? [];

            const executeLevel = async (lvlNodes: WorkflowNode[]) => {
              const lvlBatches = chunk(lvlNodes, maxConcurrentCalls);
              for (const lvlBatch of lvlBatches) {
                if (abortController.signal.aborted || !get().isRunning) break;
                set({ currentNodeIds: lvlBatch.map((n) => n.id) });
                const lvlResults = await Promise.allSettled(
                  lvlBatch.map((node) => executeSingleNode(node, abortController.signal))
                );
                for (let i = 0; i < lvlResults.length; i++) {
                  const r = lvlResults[i];
                  if (r.status === 'rejected' &&
                      !(r.reason instanceof DOMException && r.reason.name === 'AbortError')) {
                    abortController.abort();
                    throw r.reason;
                  }
                }
              }
            };

            for (let itemIdx = 0; itemIdx < items.length; itemIdx++) {
              if (abortController.signal.aborted || !get().isRunning) break;

              logger.info('node.execution', `Array batch: executing item ${itemIdx + 1}/${items.length}`, {
                nodeId: batchArrayNode.id,
                item: items[itemIdx],
              });

              get().updateNodeData(batchArrayNode.id, { outputText: items[itemIdx] });

              for (let remainingIdx = levelIdx + 1; remainingIdx < levels.length; remainingIdx++) {
                if (abortController.signal.aborted || !get().isRunning) break;
                const remainingNodes = levels[remainingIdx].nodeIds
                  .map((id) => get().nodes.find((n) => n.id === id))
                  .filter((n): n is WorkflowNode => n !== undefined);
                if (remainingNodes.length === 0) continue;
                await executeLevel(remainingNodes);
              }
            }

            get().updateNodeData(batchArrayNode.id, { outputText: JSON.stringify(items) });
            break;
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

  // ── stopWorkflow ──────────────────────────────────────────────────────────

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

  // ── regenerateNode ────────────────────────────────────────────────────────

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

      await dispatchExecuteNode(executionCtx, { useStoredFallback: true });

      const { edges: currentEdges } = get();
      const downstreamEdges = currentEdges.filter(e => e.source === nodeId);
      for (const edge of downstreamEdges) {
        const targetNode = get().nodes.find(n => n.id === edge.target);
        if (!targetNode) continue;
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

  // ── executeSelectedNodes ──────────────────────────────────────────────────

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
});
