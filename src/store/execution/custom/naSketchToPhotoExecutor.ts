/**
 * NA - Sketch to Photo Executor
 */

import type { NodeExecutionContext } from "../types";
import { executeNAPipeline } from "./naPipelineExecutor";
import type { NASketchToPhotoData } from "@/types/customNodes";

const PACK_ID = "comfyui_neural_atelier";
const CONFIG_DIR = "NA_Sketch_to_Photo_Orchestrator";

export async function executeNASketchToPhoto(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as NASketchToPhotoData;

  updateNodeData(node.id, { status: "loading", error: null });

  try {
    // Load selected prompt profile as system prompt (these are plain text files stored as .json)
    const profileName = nodeData.promptProfile || "01_Sketch_to_Photo";
    const configRes = await fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/${profileName}`);

    if (!configRes.ok) {
      throw new Error(`Failed to load profile "${profileName}": ${configRes.status}`);
    }

    // Profile files are raw text system prompts
    const systemPrompt = await configRes.text();

    const inputs = getConnectedInputs(node.id);
    const referenceImages = inputs.images.filter(Boolean);

    const result = await executeNAPipeline(ctx, {
      systemPrompt,
      userPrompt: nodeData.briefText || "",
      referenceImages,
      imageModel: nodeData.imageModel,
      aspectRatio: nodeData.aspectRatio,
      resolution: nodeData.resolution,
      topP: nodeData.topP,
    });

    updateNodeData(node.id, {
      outputImage: result.image,
      log: result.log.join("\n"),
      flashRequestJson: JSON.stringify({ profile: profileName, latency: result.flashLatency }, null, 2),
      nanoBananaRequestJson: JSON.stringify({ prompt: result.nanoBananaPrompt.substring(0, 500), latency: result.genLatency }, null, 2),
      status: "complete",
      error: null,
    });

    ctx.addToGlobalHistory({
      image: result.image,
      timestamp: Date.now(),
      prompt: result.nanoBananaPrompt,
      aspectRatio: nodeData.aspectRatio as import("@/types").AspectRatio,
      model: nodeData.imageModel as import("@/types").ModelType,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Execution failed";
    updateNodeData(node.id, { status: "error", error: msg });
    throw new Error(msg);
  }
}
