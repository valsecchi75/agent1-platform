/**
 * workflowStore.ts — Backward-compatible composition layer.
 *
 * ARCHITECTURE (Phase 3 decomposition):
 * The store is now split into focused slice files:
 *   - graphStore.ts       → nodes, edges, groups, clipboard
 *   - executionStore.ts   → executeWorkflow, regenerate, execution state
 *   - persistenceStore.ts → save/load, auto-save, global history
 *   - slices/             → ui, provider, cost, canvas, comments, snapshot, dimming, auth
 *
 * This file ONLY composes those slices and re-exports backward-compatible types.
 * The 113 consumers of useWorkflowStore() continue to work without changes.
 *
 * ZONA CONGELATA — This composition layer should not be modified except to
 * add/remove top-level slices. See CLAUDE.md § "Zona Congelata" for rules.
 */

import { create } from "zustand";
import { useShallow } from "zustand/shallow";

// ─── New focused slices (Phase 3 decomposition) ───────────────────────────────

import { createGraphSlice } from "./graphStore";
import { createExecutionSlice } from "./executionStore";
import { createPersistenceSlice } from "./persistenceStore";
import type { GraphSlice } from "./graphStore";
import type { ExecutionSlice } from "./executionStore";
import type { PersistenceSlice } from "./persistenceStore";

// ─── Existing specialized slices ──────────────────────────────────────────────

import {
  createUISlice,
  createProviderSlice,
  createCostSlice,
  createCanvasNavSlice,
  createCommentSlice,
  createSnapshotSlice,
  createDimmingSlice,
  createAuthSlice,
} from "./slices";
import type {
  UISlice,
  ProviderSlice,
  CostSlice,
  CanvasNavSlice,
  CommentSlice,
  SnapshotSlice,
  DimmingSlice,
  AuthSlice,
} from "./slices";

// ─── Re-exports for full backward compatibility ───────────────────────────────

export type { EdgeStyle } from "./graphStore";
export type { WorkflowFile } from "./persistenceStore";
export type { LevelGroup } from "./utils/executionUtils";
export { CONCURRENCY_SETTINGS_KEY } from "./executionStore";
// GROUP_COLORS is a value — re-exported directly from nodeDefaults to avoid isolatedModules type-only re-export error
export { GROUP_COLORS } from "./utils/nodeDefaults";
export {
  generateWorkflowId,
  saveGenerateImageDefaults,
  saveNanoBananaDefaults,
} from "./utils/localStorage";

// ─── Combined Store Interface ─────────────────────────────────────────────────

export interface WorkflowStore
  extends GraphSlice,
    ExecutionSlice,
    PersistenceSlice,
    UISlice,
    ProviderSlice,
    CostSlice,
    CanvasNavSlice,
    CommentSlice,
    SnapshotSlice,
    DimmingSlice,
    AuthSlice {}

// ─── Store Creation ───────────────────────────────────────────────────────────

export const useWorkflowStore = create<WorkflowStore>()((set, get, api) => ({
  // Focused core slices (Phase 3)
  ...createGraphSlice(set as never, get as never, api as never),
  ...createExecutionSlice(set as never, get as never, api as never),
  ...createPersistenceSlice(set as never, get as never, api as never),

  // Specialized slices
  ...createUISlice(set, get, api),
  ...createProviderSlice(set, get, api),
  ...createCostSlice(set as never, get as never, api as never),
  ...createCanvasNavSlice(set, get, api),
  ...createCommentSlice(set as never, get as never, api as never),
  ...createSnapshotSlice(set as never, get as never, api as never),
  ...createDimmingSlice(set as never, get as never, api as never),
  ...createAuthSlice(set as never, get as never, api as never),
}));

// ─── Convenience hooks ────────────────────────────────────────────────────────

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
