/**
 * nodeDefaults.ts — Node default data + dimensions.
 *
 * MIGRATED (Phase 2B-1): createDefaultNodeData now uses the NodeSpec registry
 * as the primary source of truth. For nodes that read persisted localStorage
 * settings (nanoBanana, generateVideo, etc.), we apply those on top of the
 * static spec defaults, keeping full backward compatibility.
 *
 * The only logic that lives here is:
 *   1. Registry lookup for static defaults
 *   2. localStorage merge for user-persisted defaults on generation nodes
 *
 * Zero switch cases. Zero hardcoded per-type branches (except the localStorage
 * merge helpers below, which are pure data transforms, not type routing).
 */

import { loadGenerateImageDefaults, loadNodeDefaults } from "./localStorage";
import { nodeSpecRegistry, registerAllNodeSpecs } from "@/lib/nodes";
import {
  NodeType,
  ModelType,
  WorkflowNodeData,
  GroupColor,
  SelectedModel,
  MODEL_DISPLAY_NAMES,
} from "@/types";

// Ensure all specs are registered before any lookup
registerAllNodeSpecs();

// ─── Default Dimensions ───────────────────────────────────────────────────────

/**
 * Default dimensions for each node type.
 * Now sourced from the NodeSpec registry instead of a hardcoded Record.
 * Proxy ensures any unregistered type gets a safe fallback.
 */
export const defaultNodeDimensions: Record<NodeType, { width: number; height: number }> = (() => {
  const raw = {} as Record<string, { width: number; height: number }>;
  for (const spec of nodeSpecRegistry.getAllSpecs()) {
    raw[spec.type] = spec.defaultDimensions;
  }
  return new Proxy(raw, {
    get(target, key: string) {
      return target[key] ?? { width: 300, height: 280 };
    },
  }) as Record<NodeType, { width: number; height: number }>;
})();

// ─── Group Colors ─────────────────────────────────────────────────────────────

/**
 * Group color palette (dark mode tints).
 */
export const GROUP_COLORS: Record<GroupColor, string> = {
  neutral: "#262626",
  blue: "#1e3a5f",
  green: "#1a3d2e",
  purple: "#2d2458",
  orange: "#3d2a1a",
  red: "#3d1a1a",
};

/**
 * Order in which group colors are assigned.
 */
export const GROUP_COLOR_ORDER: GroupColor[] = [
  "neutral", "blue", "green", "purple", "orange", "red"
];

// ─── localStorage-merged defaults ────────────────────────────────────────────
// These nodes merge user-persisted localStorage settings on top of spec defaults.

function makeNanoBananaDefaults(): WorkflowNodeData {
  const specData = nodeSpecRegistry.getDefaultData("nanoBanana") ?? {};
  const nodeDefaults = loadNodeDefaults();
  const legacyDefaults = loadGenerateImageDefaults();

  let selectedModel: SelectedModel;
  if (nodeDefaults.generateImage?.selectedModel) {
    selectedModel = nodeDefaults.generateImage.selectedModel;
  } else {
    const modelDisplayName = MODEL_DISPLAY_NAMES[legacyDefaults.model as ModelType] || legacyDefaults.model;
    selectedModel = {
      provider: "gemini",
      modelId: legacyDefaults.model,
      displayName: modelDisplayName,
    };
  }

  return {
    ...specData,
    aspectRatio: nodeDefaults.generateImage?.aspectRatio ?? legacyDefaults.aspectRatio,
    resolution: nodeDefaults.generateImage?.resolution ?? legacyDefaults.resolution,
    model: legacyDefaults.model,
    selectedModel,
    useGoogleSearch: nodeDefaults.generateImage?.useGoogleSearch ?? legacyDefaults.useGoogleSearch,
    useImageSearch: nodeDefaults.generateImage?.useImageSearch ?? legacyDefaults.useImageSearch,
  } as WorkflowNodeData;
}

function makeGenerateVideoDefaults(): WorkflowNodeData {
  const specData = nodeSpecRegistry.getDefaultData("generateVideo") ?? {};
  const nodeDefaults = loadNodeDefaults();
  return {
    ...specData,
    selectedModel: nodeDefaults.generateVideo?.selectedModel,
  } as WorkflowNodeData;
}

function makeGenerate3DDefaults(): WorkflowNodeData {
  const specData = nodeSpecRegistry.getDefaultData("generate3d") ?? {};
  const nodeDefaults = loadNodeDefaults();
  return {
    ...specData,
    selectedModel: nodeDefaults.generate3d?.selectedModel,
  } as WorkflowNodeData;
}

function makeGenerateAudioDefaults(): WorkflowNodeData {
  const specData = nodeSpecRegistry.getDefaultData("generateAudio") ?? {};
  const nodeDefaults = loadNodeDefaults();
  return {
    ...specData,
    selectedModel: nodeDefaults.generateAudio?.selectedModel,
  } as WorkflowNodeData;
}

function makeLlmGenerateDefaults(): WorkflowNodeData {
  const specData = nodeSpecRegistry.getDefaultData("llmGenerate") ?? {};
  const nodeDefaults = loadNodeDefaults();
  const llmDefaults = nodeDefaults.llm;
  return {
    ...specData,
    provider: llmDefaults?.provider ?? "google",
    model: llmDefaults?.model ?? "gemini-3.1-pro-preview",
    temperature: llmDefaults?.temperature ?? 0.7,
    maxTokens: llmDefaults?.maxTokens ?? 8192,
  } as WorkflowNodeData;
}

/**
 * Switch nodes require fresh random IDs at creation time.
 */
function makeSwitchDefaults(): WorkflowNodeData {
  return {
    inputType: null,
    switches: [
      { id: Math.random().toString(36).slice(2, 9), name: "Output 1", enabled: true }
    ]
  } as WorkflowNodeData;
}

/**
 * ConditionalSwitch nodes require fresh random rule IDs at creation time.
 */
function makeConditionalSwitchDefaults(): WorkflowNodeData {
  return {
    incomingText: null,
    rules: [
      {
        id: "rule-" + Math.random().toString(36).slice(2, 9),
        value: "",
        mode: "contains",
        label: "Rule 1",
        isMatched: false,
      }
    ]
  } as WorkflowNodeData;
}

// ─── Dynamic Defaults Map ─────────────────────────────────────────────────────

/**
 * Node types that need runtime-computed defaults
 * (localStorage merge or random ID generation).
 * All other types use pure static registry defaults.
 */
const DYNAMIC_DEFAULTS: Partial<Record<NodeType, () => WorkflowNodeData>> = {
  nanoBanana: makeNanoBananaDefaults,
  generateVideo: makeGenerateVideoDefaults,
  generate3d: makeGenerate3DDefaults,
  generateAudio: makeGenerateAudioDefaults,
  llmGenerate: makeLlmGenerateDefaults,
  switch: makeSwitchDefaults,
  conditionalSwitch: makeConditionalSwitchDefaults,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates default data for a node based on its type.
 *
 * Strategy:
 *   1. Runtime-computed defaults (localStorage merge, random IDs) — highest priority
 *   2. NodeSpec registry static defaults
 *   3. Empty object fallback (should never be reached for known types)
 *
 * Backward compatible: returns identical structures to the original 344-line switch.
 */
export const createDefaultNodeData = (type: NodeType): WorkflowNodeData => {
  const dynamicFn = DYNAMIC_DEFAULTS[type];
  if (dynamicFn) {
    return dynamicFn();
  }

  const specData = nodeSpecRegistry.getDefaultData(type);
  if (specData !== undefined) {
    return { ...specData } as WorkflowNodeData;
  }

  console.warn(`[nodeDefaults] No spec registered for node type "${type}". Using empty defaults.`);
  return {} as WorkflowNodeData;
};
