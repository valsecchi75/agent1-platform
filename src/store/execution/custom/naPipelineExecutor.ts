/**
 * Neural Atelier — Shared 2-stage pipeline executor.
 *
 * Stage 1: Gemini Flash — prompt orchestration (text generation)
 * Stage 2: Nano Banana Pro — image generation from orchestrated prompt
 *
 * All 3 NA nodes call this after building their node-specific prompts.
 */

import type { NodeExecutionContext } from "../types";
import { buildGenerateHeaders, buildLlmHeaders } from "@/store/utils/buildApiHeaders";
import { NA_IMAGE_MODELS, NA_FLASH_MODEL } from "@/types/customNodes";

export interface NAPipelineInput {
  systemPrompt: string;
  userPrompt: string;
  referenceImages: string[];
  imageModel: string;
  aspectRatio: string;
  resolution: string;
  topP: number;
}

export interface NAPipelineResult {
  image: string;
  nanoBananaPrompt: string;
  flashLatency: number;
  genLatency: number;
  log: string[];
}

export async function executeNAPipeline(
  ctx: NodeExecutionContext,
  input: NAPipelineInput
): Promise<NAPipelineResult> {
  const log: string[] = [];
  const { signal, providerSettings } = ctx;

  // ── Stage 1: Gemini Flash — Prompt Orchestration ──
  log.push("Stage 1: Calling Gemini Flash for prompt orchestration...");

  const llmHeaders = buildLlmHeaders("google", providerSettings);
  const flashStart = Date.now();

  const assetManifest = input.referenceImages.length > 0
    ? `Asset Manifest:\n- ${input.referenceImages.length} reference image(s) provided\n\n`
    : "Asset Manifest:\n- No reference images\n\n";

  const fullUserPrompt = `${assetManifest}User Brief:\n${input.userPrompt || "No brief provided."}\n\nBased on the provided assets and brief, generate the nano_banana_prompt following your system instructions.\nYou MUST respond with ONLY a valid JSON object in this exact format:\n{"nano_banana_prompt": "your generated prompt here"}\n\nDo not include any other text, explanation, or markdown formatting.`;

  const flashResponse = await fetch("/api/llm", {
    method: "POST",
    headers: llmHeaders,
    body: JSON.stringify({
      prompt: input.systemPrompt + "\n\n---\n\n" + fullUserPrompt,
      images: input.referenceImages.length > 0 ? input.referenceImages : undefined,
      provider: "google",
      model: NA_FLASH_MODEL,
      temperature: 0.7,
      maxTokens: 2048,
    }),
    ...(signal ? { signal } : {}),
  });

  const flashLatency = (Date.now() - flashStart) / 1000;

  if (!flashResponse.ok) {
    const errorText = await flashResponse.text();
    throw new Error(`Gemini Flash failed (${flashResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const flashResult = await flashResponse.json();

  if (!flashResult.success || !flashResult.text) {
    throw new Error(`Gemini Flash returned no text: ${flashResult.error || "Unknown error"}`);
  }

  // Parse JSON response to extract nano_banana_prompt
  let nanoBananaPrompt: string;
  try {
    let responseText = flashResult.text.trim();
    if (responseText.startsWith("```")) {
      const lines = responseText.split("\n");
      if (lines[0].startsWith("```")) lines.shift();
      if (lines[lines.length - 1]?.trim() === "```") lines.pop();
      responseText = lines.join("\n");
    }
    const parsed = JSON.parse(responseText);
    nanoBananaPrompt = parsed.nano_banana_prompt;
    if (!nanoBananaPrompt) {
      throw new Error("Missing nano_banana_prompt key");
    }
  } catch {
    nanoBananaPrompt = flashResult.text.trim();
    log.push("Warning: Flash response was not valid JSON, using raw text as prompt");
  }

  log.push(`Stage 1 complete (${flashLatency.toFixed(2)}s) — prompt: ${nanoBananaPrompt.length} chars`);

  // ── Stage 2: Nano Banana Pro — Image Generation ──
  log.push("Stage 2: Calling Nano Banana Pro for image generation...");

  const modelInfo = NA_IMAGE_MODELS.find((m) => m.value === input.imageModel) || NA_IMAGE_MODELS[0];
  const genHeaders = buildGenerateHeaders("gemini", providerSettings);
  const genStart = Date.now();

  const genResponse = await fetch("/api/generate", {
    method: "POST",
    headers: genHeaders,
    body: JSON.stringify({
      images: input.referenceImages,
      prompt: nanoBananaPrompt,
      aspectRatio: input.aspectRatio,
      resolution: input.resolution,
      model: modelInfo.value,
      selectedModel: {
        provider: "gemini",
        modelId: modelInfo.modelId,
        displayName: modelInfo.label,
      },
      parameters: { topP: input.topP },
    }),
    ...(signal ? { signal } : {}),
  });

  const genLatency = (Date.now() - genStart) / 1000;

  if (!genResponse.ok) {
    const errorText = await genResponse.text();
    throw new Error(`Nano Banana failed (${genResponse.status}): ${errorText.substring(0, 200)}`);
  }

  const genResult = await genResponse.json();

  if (!genResult.success || !genResult.image) {
    throw new Error(`Nano Banana returned no image: ${genResult.error || "Unknown error"}`);
  }

  log.push(`Stage 2 complete (${genLatency.toFixed(2)}s) — image generated`);

  return { image: genResult.image, nanoBananaPrompt, flashLatency, genLatency, log };
}
