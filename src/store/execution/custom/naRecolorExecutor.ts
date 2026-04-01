/**
 * NA - Recolor Executor
 */

import type { NodeExecutionContext } from "../types";
import { executeNAPipeline } from "./naPipelineExecutor";
import type { NARecolorData } from "@/types/customNodes";

const PACK_ID = "comfyui_neural_atelier";
const CONFIG_DIR = "NA_Recolor";
const PLACEHOLDER = "-- Select a Pantone color --";

export async function executeNARecolor(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as NARecolorData;

  updateNodeData(node.id, { status: "loading", error: null });

  try {
    const [templatesRes, rulesRes] = await Promise.all([
      fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/prompt_templates.json`),
      fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/recolor_rules.json`),
    ]);

    const templates = templatesRes.ok ? await templatesRes.json() : {};
    const rules = rulesRes.ok ? await rulesRes.json() : { invariants: [] };

    const inputs = getConnectedInputs(node.id);
    const referenceImages = inputs.images.filter(Boolean);

    // Determine target color
    let targetColor = "";
    let colorSource = "";

    if (referenceImages.length > 1) {
      targetColor = "color from reference image";
      colorSource = "reference_image";
    } else if (nodeData.pantoneColorCurated && nodeData.pantoneColorCurated !== PLACEHOLDER) {
      targetColor = nodeData.pantoneColorCurated;
      colorSource = "pantone_curated";
    } else if (nodeData.pantoneColor && nodeData.pantoneColor !== PLACEHOLDER) {
      targetColor = nodeData.pantoneColor;
      colorSource = "pantone_all";
    } else {
      throw new Error("Please select a Pantone color or connect a color reference image.");
    }

    const systemInstruction = templates.system_instruction || "You are a color expert for fashion garments.";
    const userTemplate = templates.user_prompt_template || "Recolor this garment to {PANTONE_COLOR}. Brief: {BRIEF}. Constraints: {INVARIANTS_LIST}";
    const invariants = (rules.invariants || []).map((inv: string) => `- ${inv}`).join("\n");

    const userPrompt = userTemplate
      .replace("{PANTONE_COLOR}", targetColor)
      .replace("{COLOR_SOURCE}", colorSource)
      .replace("{BRIEF}", nodeData.brief || "No additional context provided.")
      .replace("{INVARIANTS_LIST}", invariants);

    const result = await executeNAPipeline(ctx, {
      systemPrompt: systemInstruction,
      userPrompt,
      referenceImages,
      imageModel: nodeData.imageModel,
      aspectRatio: nodeData.aspectRatio,
      resolution: nodeData.resolution,
      topP: nodeData.topP,
    });

    updateNodeData(node.id, {
      outputImage: result.image,
      prompt: result.nanoBananaPrompt,
      log: result.log.join("\n"),
      outputJson: JSON.stringify({
        target_color: targetColor,
        color_source: colorSource,
        flash_latency_s: +result.flashLatency.toFixed(2),
        gen_latency_s: +result.genLatency.toFixed(2),
        total_latency_s: +(result.flashLatency + result.genLatency).toFixed(2),
      }, null, 2),
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
