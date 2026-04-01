/**
 * NA - Styling Detail Change Executor
 */

import type { NodeExecutionContext } from "../types";
import { executeNAPipeline } from "./naPipelineExecutor";
import type { NAStylingDetailData } from "@/types/customNodes";

const PACK_ID = "comfyui_neural_atelier";
const CONFIG_DIR = "NA_Styling_Detail_Change";

export async function executeNAStylingDetail(ctx: NodeExecutionContext): Promise<void> {
  const { node, getConnectedInputs, updateNodeData } = ctx;
  const nodeData = node.data as NAStylingDetailData;

  updateNodeData(node.id, { status: "loading", error: null });

  try {
    // Load configs
    const [templatesRes, garmentsRes] = await Promise.all([
      fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/prompt_templates.json`),
      fetch(`/api/custom-nodes/${PACK_ID}/configs/${CONFIG_DIR}/garments.json`),
    ]);

    const templates = templatesRes.ok ? await templatesRes.json() : {};
    const garmentsConfig = garmentsRes.ok ? await garmentsRes.json() : { garment_types: [] };

    const systemInstruction = templates.system_instruction || "You are a fashion styling expert. Generate a detailed prompt for garment modification.";
    const userTemplate = templates.user_prompt_template || "Modify the {GARMENT_TYPE} {DETAIL_CATEGORY} to {DETAIL_OPTION}. Description: {USER_DESCRIPTION}. Brief: {BRIEF}. Constraints: {INVARIANTS_LIST}";

    // Get invariants
    const invariants = templates.invariants?.[nodeData.garmentType] || [];
    const invariantsText = invariants.map((inv: string) => `- ${inv}`).join("\n");

    // Build description
    let description = nodeData.description?.trim() || "";
    if (!description) {
      for (const gt of garmentsConfig.garment_types || []) {
        if (gt.value === nodeData.garmentType) {
          for (const cat of gt.categories || []) {
            if (cat.value === nodeData.detailCategory) {
              description = (cat.default_template || "").replace("{OPTION}", nodeData.detailOption);
              break;
            }
          }
          break;
        }
      }
    }

    const userPrompt = userTemplate
      .replace("{GARMENT_TYPE}", nodeData.garmentType)
      .replace("{DETAIL_CATEGORY}", nodeData.detailCategory)
      .replace("{DETAIL_OPTION}", nodeData.detailOption)
      .replace("{USER_DESCRIPTION}", description)
      .replace("{BRIEF}", nodeData.brief || "No additional context provided.")
      .replace("{REFERENCE_DETAIL_USED}", "")
      .replace("{INVARIANTS_LIST}", invariantsText);

    const inputs = getConnectedInputs(node.id);
    const referenceImages = inputs.images.filter(Boolean);

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
        change_type: nodeData.detailCategory,
        detail_option: nodeData.detailOption,
        garment_type: nodeData.garmentType,
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
