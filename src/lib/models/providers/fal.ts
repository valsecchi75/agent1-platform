/**
 * Fal.ai Provider Module
 * Handles model discovery and schema fetching from fal.ai API
 */

import { ProviderModel, ModelCapability, ModelParameter, ModelInput } from "@/lib/providers/types";

const FAL_API_BASE = "https://api.fal.ai/v1";

// Categories we care about for generation (fal.ai)
const RELEVANT_CATEGORIES = [
  "text-to-image",
  "image-to-image",
  "text-to-video",
  "image-to-video",
  "text-to-3d",
  "image-to-3d",
  "text-to-speech",
  "text-to-music",
  "text-to-sound-effects",
];

// ============ Fal.ai Types ============

interface FalModelsResponse {
  models: FalModel[];
  next_cursor: string | null;
  has_more: boolean;
}

interface FalModel {
  endpoint_id: string;
  metadata: {
    display_name: string;
    category: string;
    description: string;
    status: "active" | "deprecated";
    tags: string[];
    updated_at: string;
    is_favorited: boolean | null;
    thumbnail_url: string;
    model_url: string;
    date: string;
    highlighted: boolean;
    pinned: boolean;
    thumbnail_animated_url?: string;
    github_url?: string;
    license_type?: "commercial" | "research" | "private";
  };
  openapi?: Record<string, unknown>;
}

// ============ Fal.ai Helpers ============

const FAL_AUDIO_CATEGORIES: Record<string, ModelCapability> = {
  "text-to-speech": "text-to-audio",
  "text-to-music": "text-to-audio",
  "text-to-sound-effects": "text-to-audio",
};

function mapFalCategory(category: string): ModelCapability | null {
  if (category in FAL_AUDIO_CATEGORIES) {
    return FAL_AUDIO_CATEGORIES[category];
  }
  if (RELEVANT_CATEGORIES.includes(category)) {
    return category as ModelCapability;
  }
  return null;
}

function isRelevantFalModel(model: FalModel): boolean {
  return RELEVANT_CATEGORIES.includes(model.metadata.category);
}

function mapFalModel(model: FalModel): ProviderModel {
  const capability = mapFalCategory(model.metadata.category);

  return {
    id: model.endpoint_id,
    name: model.metadata.display_name,
    description: model.metadata.description,
    provider: "fal",
    capabilities: capability ? [capability] : [],
    coverImage: model.metadata.thumbnail_url,
  };
}

// ============ Fal.ai API Functions ============

/**
 * Fetch all relevant models from fal.ai API with pagination
 */
export async function fetchFalModels(
  apiKey: string | null,
  searchQuery?: string
): Promise<ProviderModel[]> {
  const allModels: ProviderModel[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Key ${apiKey}`;
  }

  // Paginate through results (limit to 15 pages to avoid timeout)
  let pageCount = 0;
  const maxPages = 15;

  while (hasMore && pageCount < maxPages) {
    let url = `${FAL_API_BASE}/models?status=active`;
    if (searchQuery) {
      url += `&q=${encodeURIComponent(searchQuery)}`;
    }
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`fal.ai API error: ${response.status}`);
    }

    const data: FalModelsResponse = await response.json();
    allModels.push(...data.models.filter(isRelevantFalModel).map(mapFalModel));

    cursor = data.next_cursor;
    hasMore = data.has_more;
    pageCount++;
  }

  // Note: Pricing not fetched - external provider pricing is unreliable
  // CostDialog shows model links instead of prices for fal.ai/Replicate

  return allModels;
}

/**
 * Fetch schema for a specific fal.ai model
 * Uses: GET https://api.fal.ai/v1/models?endpoint_id={modelId}&expand=openapi-3.0
 */
export async function fetchFalSchema(
  modelId: string,
  apiKey: string | null
): Promise<{ parameters: ModelParameter[]; inputs: ModelInput[] }> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Key ${apiKey}`;
  }

  // Use fal.ai Model Search API with OpenAPI expansion
  const url = `${FAL_API_BASE}/models?endpoint_id=${encodeURIComponent(modelId)}&expand=openapi-3.0`;

  const response = await fetch(url, { headers });

  if (!response.ok) {
    // Return empty params if API fails so generation still works
    return { parameters: [], inputs: [] };
  }

  const data = await response.json();

  // Response is { models: [{ openapi: {...}, ... }] }
  const modelData = data.models?.[0];
  if (!modelData?.openapi) {
    return { parameters: [], inputs: [] };
  }

  const spec = modelData.openapi;

  // Find POST endpoint with requestBody - paths are keyed by full endpoint path
  let inputSchema: Record<string, unknown> | null = null;

  for (const pathObj of Object.values(spec.paths || {})) {
    const postOp = (pathObj as Record<string, unknown>)?.post as Record<string, unknown> | undefined;
    const reqBody = postOp?.requestBody as Record<string, unknown> | undefined;
    const content = reqBody?.content as Record<string, Record<string, unknown>> | undefined;
    const jsonContent = content?.["application/json"];

    if (jsonContent?.schema) {
      const schema = jsonContent.schema as Record<string, unknown>;

      // Handle $ref - resolve from components.schemas
      if (schema.$ref && typeof schema.$ref === "string") {
        const refPath = schema.$ref.replace("#/components/schemas/", "");
        const resolvedSchema = spec.components?.schemas?.[refPath] as Record<string, unknown> | undefined;
        if (resolvedSchema) {
          inputSchema = resolvedSchema;
          break;
        }
      } else if (schema.properties) {
        inputSchema = schema;
        break;
      }
    }
  }

  if (!inputSchema) {
    return { parameters: [], inputs: [] };
  }

  // Pass components.schemas for $ref resolution
  // Note: The calling route handler should handle schema extraction
  return { parameters: [], inputs: [] };
}
