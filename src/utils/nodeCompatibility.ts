import { NodeType } from "@/types";

/**
 * Determines which node types are compatible with a given handle type and connection direction.
 * This utility encapsulates the node compatibility filtering logic used in ConnectionDropMenu.
 */

export type HandleType = "image" | "text" | "video" | "audio" | "3d" | "easeCurve" | null;
export type ConnectionDirection = "source" | "target";

// "source" = dragging from an output handle (need nodes with input handles)
// "target" = dragging from an input handle (need nodes with output handles)

/**
 * Get compatible node types for a given handle type and connection direction.
 *
 * @param handleType The type of handle being connected (image, text, video, audio, 3d, etc.)
 * @param connectionDirection "source" = from output; "target" = from input
 * @returns Array of compatible node types
 */
export function getCompatibleNodeTypes(
  handleType: HandleType,
  connectionDirection: ConnectionDirection
): NodeType[] {
  if (!handleType) return [];

  // Dragging FROM source (output) → need nodes with TARGET (input) handles
  if (connectionDirection === "source") {
    if (handleType === "video") {
      return ["videoStitch", "easeCurve", "videoTrim", "videoFrameGrab", "generateVideo", "output", "router", "switch"];
    }
    if (handleType === "audio") {
      return ["audioInput", "output", "videoStitch", "router", "switch"];
    }
    if (handleType === "3d") {
      return ["glbViewer"];
    }
    if (handleType === "image") {
      return [
        "annotation",
        "nanoBanana",
        "generateVideo",
        "splitGrid",
        "output",
        "outputGallery",
        "imageCompare",
        "router",
        "switch",
      ];
    }
    // text handle type
    return [
      "prompt",
      "promptConstructor",
      "array",
      "nanoBanana",
      "generateVideo",
      "generateAudio",
      "llmGenerate",
      "router",
      "switch",
      "conditionalSwitch",
    ];
  }

  // Dragging FROM target (input) → need nodes with SOURCE (output) handles
  if (handleType === "video") {
    return ["generateVideo", "videoStitch", "easeCurve", "videoTrim", "router", "switch"];
  }
  if (handleType === "audio") {
    return ["audioInput", "generateAudio", "router", "switch"];
  }
  if (handleType === "3d") {
    return ["generate3d"];
  }
  if (handleType === "image") {
    return ["imageInput", "nanoBanana", "annotation", "outputGallery", "imageCompare", "router", "switch"];
  }
  // text handle type
  return ["prompt", "promptConstructor", "array", "llmGenerate", "router", "switch", "conditionalSwitch"];
}

/**
 * Check if a node type can accept input of a given handle type.
 */
export function canNodeAcceptInput(nodeType: NodeType, handleType: HandleType): boolean {
  const compatible = getCompatibleNodeTypes(handleType, "source");
  return compatible.includes(nodeType);
}

/**
 * Check if a node type can produce output of a given handle type.
 */
export function canNodeProduceOutput(nodeType: NodeType, handleType: HandleType): boolean {
  const compatible = getCompatibleNodeTypes(handleType, "target");
  return compatible.includes(nodeType);
}
