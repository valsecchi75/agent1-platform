/**
 * Replicate Provider Module
 * Handles model discovery and schema fetching from Replicate API
 */

import { ProviderModel, ModelCapability, ModelParameter, ModelInput } from "@/lib/providers/types";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// ============ Replicate Types ============

interface ReplicateModelsResponse {
  next: string | null;
  previous: string | null;
  results: ReplicateModel[];
}

interface ReplicateModel {
  url: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  github_url?: string;
  paper_url?: string;
  license_url?: string;
  run_count: number;
  cover_image_url?: string;
  default_example?: Record<string, unknown>;
  latest_version?: {
    id: string;
    openapi_schema?: Record<string, unknown>;
  };
}

// ============ Replicate Helpers ============

function inferReplicateCapabilities(model: ReplicateModel): ModelCapability[] {
  const capabilities: ModelCapability[] = [];
  const searchText = `${model.name} ${model.description ?? ""}`.toLowerCase();

  // Check for 3D-related keywords first
  const is3DModel =
    searchText.includes("3d") ||
    searchText.includes("mesh") ||
    searchText.includes("triposr") ||
    searchText.includes("tripo") ||
    searchText.includes("hunyuan3d") ||
    searchText.includes("instant-mesh") ||
    searchText.includes("point-e") ||
    searchText.includes("shap-e");

  if (is3DModel) {
    // 3D model - determine if image-to-3d or text-to-3d
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
    searchText.includes("bark") ||
    searchText.includes("xtts");

  if (isAudioModel) {
    capabilities.push("text-to-audio");
    return capabilities;
  }

  // Check for video-related keywords
  const isVideoModel =
    searchText.includes("video") ||
    searchText.includes("animate") ||
    searchText.includes("motion") ||
    searchText.includes("luma") ||
    searchText.includes("kling") ||
    searchText.includes("minimax");

  if (isVideoModel) {
    // Video model - determine video capability type
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
    // Image model - default to text-to-image
    capabilities.push("text-to-image");

    // Check for image-to-image capability
    if (
      searchText.includes("img2img") ||
      searchText.includes("image-to-image") ||
      searchText.includes("inpaint") ||
      searchText.includes("controlnet") ||
      searchText.includes("upscale") ||
      searchText.includes("restore")
    ) {
      capabilities.push("image-to-image");
    }
  }

  return capabilities;
}

function mapReplicateModel(model: ReplicateModel): ProviderModel {
  return {
    id: `${model.owner}/${model.name}`,
    name: model.name,
    description: model.description,
    provider: "replicate",
    capabilities: inferReplicateCapabilities(model),
    coverImage: model.cover_image_url,
  };
}

// ============ Replicate API Functions ============

/**
 * Fetch all models from Replicate API with pagination
 */
export async function fetchReplicateModels(apiKey: string): Promise<ProviderModel[]> {
  const allModels: ProviderModel[] = [];

  // Always fetch from the models endpoint - search endpoint is unreliable
  let url: string | null = `${REPLICATE_API_BASE}/models`;

  // Paginate through results (limit to 15 pages to avoid timeout)
  let pageCount = 0;
  const maxPages = 15;

  while (url && pageCount < maxPages) {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const data: ReplicateModelsResponse = await response.json();
    if (data.results) {
      allModels.push(...data.results.map(mapReplicateModel));
    }
    url = data.next;
    pageCount++;
  }

  return allModels;
}

/**
 * Fetch schema for a specific Replicate model
 */
export async function fetchReplicateSchema(
  modelId: string,
  apiKey: string
): Promise<{ parameters: ModelParameter[]; inputs: ModelInput[] }> {
  const [owner, name] = modelId.split("/");

  const response = await fetch(
    `https://api.replicate.com/v1/models/${owner}/${name}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Replicate API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract schema from latest_version.openapi_schema
  const openApiSchema = data.latest_version?.openapi_schema;
  if (!openApiSchema) {
    return { parameters: [], inputs: [] };
  }

  // Navigate to Input schema
  const inputSchema = openApiSchema.components?.schemas?.Input;
  if (!inputSchema || typeof inputSchema !== "object") {
    return { parameters: [], inputs: [] };
  }

  // Pass components.schemas for $ref resolution
  // Note: This imports extractParametersFromSchema from the shared schema module
  // The calling route handler should pass this function or handle extraction separately
  return { parameters: [], inputs: [] };
}
