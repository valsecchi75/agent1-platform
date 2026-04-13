/**
 * Connection validation utilities for the workflow canvas.
 *
 * Extracted from WorkflowCanvas.tsx to be reusable across components.
 *
 * MIGRATED (Phase 2B-3): validateConnectionWithSpec() uses the NodeSpec registry
 * for type-matching, replacing hardcoded per-type rules in WorkflowCanvas.tsx.
 * The isValidConnection callback in WorkflowCanvas now delegates here.
 */

import { nodeSpecRegistry, registerAllNodeSpecs } from "@/lib/nodes";

// Ensure registry is available
registerAllNodeSpecs();

export type HandleCategory = "image" | "text" | "video" | "audio" | "3d" | "easeCurve";

/**
 * Determine handle type from handle ID using naming conventions.
 * Returns null for generic/router handles to allow any type connection.
 */
export const getHandleType = (handleId: string | null | undefined): HandleCategory | null => {
  if (!handleId) return null;
  // Generic Router handles — return null to allow any type connection
  if (handleId === "generic-input" || handleId === "generic-output") return null;
  // EaseCurve handles (must check before other types)
  if (handleId === "easeCurve") return "easeCurve";
  // 3D handles
  if (handleId === "3d") return "3d";
  // Standard handles
  if (handleId === "video") return "video";
  if (handleId === "audio" || handleId.startsWith("audio")) return "audio";
  if (handleId === "image" || handleId === "text") return handleId;
  // Dynamic handles - check naming patterns (including indexed: text-0, image-0)
  if (handleId.includes("video")) return "video";
  if (handleId.startsWith("image-") || handleId.includes("image") || handleId.includes("frame")) return "image";
  if (handleId.startsWith("text-") || handleId === "prompt" || handleId === "negative_prompt" || handleId.includes("prompt")) return "text";
  return null;
};

/**
 * Define which handles each node type has.
 */
export const getNodeHandles = (nodeType: string): { inputs: string[]; outputs: string[] } => {
  switch (nodeType) {
    case "imageInput":
      return { inputs: ["reference"], outputs: ["image"] };
    case "audioInput":
      return { inputs: ["audio"], outputs: ["audio"] };
    case "annotation":
      return { inputs: ["image"], outputs: ["image"] };
    case "prompt":
      return { inputs: ["text"], outputs: ["text"] };
    case "array":
      return { inputs: ["text"], outputs: ["text"] };
    case "promptConstructor":
      return { inputs: ["text"], outputs: ["text"] };
    case "nanoBanana":
      return { inputs: ["image", "text"], outputs: ["image"] };
    case "generateVideo":
      return { inputs: ["image", "text"], outputs: ["video"] };
    case "generate3d":
      return { inputs: ["image", "text"], outputs: ["3d"] };
    case "generateAudio":
      return { inputs: ["text"], outputs: ["audio"] };
    case "llmGenerate":
      return { inputs: ["text", "image"], outputs: ["text"] };
    case "splitGrid":
      return { inputs: ["image"], outputs: ["reference"] };
    case "output":
      return { inputs: ["image", "video", "audio"], outputs: [] };
    case "outputGallery":
      return { inputs: ["image"], outputs: [] };
    case "imageCompare":
      return { inputs: ["image"], outputs: [] };
    case "videoStitch":
      return { inputs: ["video", "audio"], outputs: ["video"] };
    case "easeCurve":
      return { inputs: ["video", "easeCurve"], outputs: ["video", "easeCurve"] };
    case "videoTrim":
      return { inputs: ["video"], outputs: ["video"] };
    case "videoFrameGrab":
      return { inputs: ["video"], outputs: ["image"] };
    case "router":
      return { inputs: ["image", "text", "video", "audio", "3d", "easeCurve", "generic-input"], outputs: ["image", "text", "video", "audio", "3d", "easeCurve", "generic-output"] };
    case "switch":
      return { inputs: ["generic-input"], outputs: [] };
    case "conditionalSwitch":
      return { inputs: ["text"], outputs: [] };
    case "glbViewer":
      return { inputs: ["3d"], outputs: ["image"] };
    default:
      return { inputs: [], outputs: [] };
  }
};

// ─── Node reference shape for connection validation ──────────────────────────

export interface NodeRef {
  id: string;
  type?: string;
  data: Record<string, unknown>;
}

// ─── Spec-driven Connection Validation ───────────────────────────────────────

/**
 * Pure function: validates a connection using the NodeSpec registry.
 *
 * This replaces the hardcoded per-node-type rules in WorkflowCanvas.isValidConnection.
 * All behaviors are preserved exactly:
 *   - Switch: accepts any source type, outputs match stored inputType
 *   - ConditionalSwitch: text only in/out
 *   - EaseCurve: only to easeCurve targets (or via router)
 *   - Video: only to allowedTargetNodeTypes defined in spec
 *   - 3D: only to matching 3D handles (or router)
 *   - Audio: audio to audio or allowed targets
 *   - Standard: sourceType === targetType
 *
 * @param connection The ReactFlow connection to validate
 * @param sourceNode The source node (with type and data)
 * @param targetNode The target node (with type and data)
 */
export function validateConnectionWithSpec(
  connection: {
    source: string;
    target: string;
    sourceHandle: string | null | undefined;
    targetHandle: string | null | undefined;
  },
  sourceNode: NodeRef | undefined,
  targetNode: NodeRef | undefined
): boolean {
  const sourceType = getHandleType(connection.sourceHandle);
  const targetType = getHandleType(connection.targetHandle);

  // Switch input: accept any type (generic-input handle)
  if (targetNode?.type === "switch" && connection.targetHandle === "generic-input") return true;

  // Switch output: match outputType against stored inputType in node data
  if (sourceNode?.type === "switch") {
    const switchData = sourceNode.data as { inputType?: string | null };
    if (switchData.inputType && targetType) {
      return switchData.inputType === targetType;
    }
    return true; // inputType not set yet — allow connection
  }

  // ConditionalSwitch: text only in and out
  if (targetNode?.type === "conditionalSwitch") return sourceType === "text";
  if (sourceNode?.type === "conditionalSwitch") return targetType === "text";

  // Can't determine types — allow
  if (!sourceType || !targetType) return true;

  // EaseCurve connections: only between easeCurve nodes (or passthrough router)
  if (sourceType === "easeCurve" || targetType === "easeCurve") {
    if (targetNode?.type === "router" || sourceNode?.type === "router") return true;
    if (sourceType !== "easeCurve" || targetType !== "easeCurve") return false;
    return targetNode?.type === "easeCurve";
  }

  // Video: use spec connectionRules.allowedTargetNodeTypes if defined
  if (sourceType === "video") {
    if (!targetNode) return false;
    const sourceSpec = sourceNode?.type
      ? nodeSpecRegistry.getSpec(sourceNode.type)
      : undefined;
    const allowedTargets = sourceSpec?.connectionRules?.allowedTargetNodeTypes;

    if (allowedTargets && allowedTargets.length > 0) {
      return allowedTargets.includes(targetNode.type ?? "");
    }
    // Fallback to hardcoded list for video sources without a spec
    const videoTargets = ["generateVideo", "videoStitch", "easeCurve", "videoTrim", "videoFrameGrab", "output", "router"];
    return videoTargets.includes(targetNode.type ?? "");
  }

  // 3D: 3d handles only (or router)
  if (sourceType === "3d" || targetType === "3d") {
    if (sourceNode?.type === "router" || targetNode?.type === "router") return true;
    return sourceType === "3d" && targetType === "3d";
  }

  // Audio: audio to audio handles, or to allowed targets (output, router, generateVideo)
  if (sourceType === "audio" || targetType === "audio") {
    if (sourceType === "audio") {
      const audioTargets = ["output", "router", "generateVideo"];
      if (targetNode && audioTargets.includes(targetNode.type ?? "")) return true;
    }
    return sourceType === "audio" && targetType === "audio";
  }

  // Standard: sourceType must match targetType
  return sourceType === targetType;
}
