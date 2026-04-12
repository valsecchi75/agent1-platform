/**
 * WaveSpeed Provider Module
 * Handles model discovery and schema fetching from WaveSpeed API
 */

import { ProviderModel, ModelCapability, ModelParameter, ModelInput } from "@/lib/providers/types";
import { WaveSpeedApiSchema, setCachedWaveSpeedSchemas } from "@/lib/providers/cache";

const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";

// ============ WaveSpeed Types ============

interface WaveSpeedModel {
  // Model ID can be in different fields depending on API version
  model_id?: string;
  id?: string;
  modelId?: string;
  name?: string;
  display_name?: string;
  description?: string;
  category?: string;
  type?: string;
  thumbnail_url?: string;
  cover_image?: string;
  coverImage?: string;
  pricing?: {
    amount?: number;
    currency?: string;
  };
  // Dynamic schema from API (contains api_schemas[] with request_schema)
  api_schema?: WaveSpeedApiSchema;
}

interface WaveSpeedModelsResponse {
  models?: WaveSpeedModel[];
  data?: WaveSpeedModel[];
  results?: WaveSpeedModel[];
}

// ============ WaveSpeed Helpers ============

function inferWaveSpeedCapabilities(model: WaveSpeedModel): ModelCapability[] {
  const capabilities: ModelCapability[] = [];
  const modelId = model.model_id?.toLowerCase() || "";
  const name = (model.name || model.display_name || "").toLowerCase();
  const description = (model.description || "").toLowerCase();
  const category = (model.category || model.type || "").toLowerCase();
  const searchText = `${modelId} ${name} ${description} ${category}`;

  // Check for 3D-related keywords first
  const is3DModel =
    searchText.includes("3d") ||
    searchText.includes("mesh") ||
    searchText.includes("tripo") ||
    searchText.includes("hunyuan3d") ||
    category.includes("3d");

  if (is3DModel) {
    const hasImageInput =
      searchText.includes("image") ||
      searchText.includes("img") ||
      searchText.includes("photo");
    if (hasImageInput) {
      capabilities.push("image-to-3d");
    } else {
      capabilities.push("text-to-3d");
    }
    return capabilities;
  }

  // Check for audio-related keywords
  const isAudioModel =
    searchText.includes("music") ||
    searchText.includes("audio") ||
    searchText.includes("tts") ||
    searchText.includes("text-to-speech") ||
    searchText.includes("speech") ||
    searchText.includes("sound effect") ||
    searchText.includes("voice") ||
    category.includes("audio") ||
    category.includes("music") ||
    category.includes("speech");

  if (isAudioModel) {
    capabilities.push("text-to-audio");
    return capabilities;
  }

  // Check for video-related keywords
  const isVideoModel =
    searchText.includes("video") ||
    searchText.includes("animate") ||
    searchText.includes("motion") ||
    searchText.includes("wan") ||
    searchText.includes("kling") ||
    searchText.includes("luma") ||
    searchText.includes("minimax") ||
    searchText.includes("i2v") ||
    searchText.includes("t2v") ||
    category.includes("video");

  if (isVideoModel) {
    if (
      searchText.includes("img2vid") ||
      searchText.includes("image-to-video") ||
      searchText.includes("i2v")
    ) {
      capabilities.push("image-to-video");
    } else {
      capabilities.push("text-to-video");
    }
  } else {
    // Image model
    capabilities.push("text-to-image");

    // Check for image-to-image capability
    if (
      searchText.includes("img2img") ||
      searchText.includes("image-to-image") ||
      searchText.includes("inpaint") ||
      searchText.includes("controlnet") ||
      searchText.includes("upscale") ||
      searchText.includes("edit") ||
      searchText.includes("kontext")
    ) {
      capabilities.push("image-to-image");
    }
  }

  return capabilities.length > 0 ? capabilities : ["text-to-image"];
}

function mapWaveSpeedModel(model: WaveSpeedModel): ProviderModel {
  // Handle different field names for model ID
  const modelId = model.model_id || model.id || model.modelId || model.name || "unknown";
  const displayName = model.display_name || model.name || modelId;

  return {
    id: modelId,
    name: displayName,
    description: model.description || null,
    provider: "wavespeed",
    capabilities: inferWaveSpeedCapabilities(model),
    coverImage: model.thumbnail_url || model.cover_image || model.coverImage,
    pricing: model.pricing
      ? {
          type: "per-run",
          amount: model.pricing.amount || 0,
          currency: model.pricing.currency || "USD",
        }
      : undefined,
  };
}

// ============ WaveSpeed API Functions ============

/**
 * Fetch all models from WaveSpeed API with schema caching
 */
export async function fetchWaveSpeedModels(apiKey: string): Promise<ProviderModel[]> {
  const response = await fetch(`${WAVESPEED_API_BASE}/models`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`WaveSpeed API error: ${response.status}`);
  }

  const data: WaveSpeedModelsResponse = await response.json();

  // Handle different response formats (models, data, or results array)
  const models = data.models || data.data || data.results || [];

  if (!Array.isArray(models)) {
    console.warn("[WaveSpeed] Unexpected response format:", data);
    return [];
  }

  // Log first model structure for debugging (including api_schema if present)
  if (models.length > 0) {
    const firstModel = models[0];
    console.log("[WaveSpeed] First model sample:", JSON.stringify(firstModel, null, 2).substring(0, 1000));
    console.log(`[WaveSpeed] Total models: ${models.length}`);
    console.log(`[WaveSpeed] First model has api_schema: ${!!firstModel.api_schema}`);
  }

  // Extract and cache schemas from models that have them
  const schemaMap = new Map<string, WaveSpeedApiSchema>();
  for (const model of models) {
    const modelId = model.model_id || model.id || model.modelId || model.name;
    if (modelId && model.api_schema) {
      schemaMap.set(modelId, model.api_schema);
    }
  }

  // Bulk cache all schemas
  if (schemaMap.size > 0) {
    console.log(`[WaveSpeed] Caching ${schemaMap.size} model schemas`);
    setCachedWaveSpeedSchemas(schemaMap);
  }

  return models.map(mapWaveSpeedModel);
}

/**
 * Fetch schema for a specific WaveSpeed model (minimal wrapper)
 * Schema extraction happens in the route handler via cache or API
 */
export async function fetchWaveSpeedSchema(
  modelId: string,
  apiKey: string | null
): Promise<{ api_schema?: WaveSpeedApiSchema }> {
  if (!apiKey) {
    return {};
  }

  try {
    const response = await fetch(`${WAVESPEED_API_BASE}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return {};
    }

    const data: WaveSpeedModelsResponse = await response.json();
    const models = data.models || data.data || data.results || [];

    // Find the model by ID
    const model = models.find((m) => {
      const id = m.model_id || m.id || m.modelId || m.name;
      return id === modelId;
    });

    return { api_schema: model?.api_schema };
  } catch (error) {
    console.warn(`[WaveSpeed Schema] Failed to fetch: ${error}`);
    return {};
  }
}
