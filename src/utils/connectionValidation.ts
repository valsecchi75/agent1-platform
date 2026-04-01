/**
 * Connection validation utilities for the workflow canvas.
 *
 * Extracted from WorkflowCanvas.tsx to be reusable across components.
 */

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
