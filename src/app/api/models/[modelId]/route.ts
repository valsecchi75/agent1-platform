/**
 * Model Schema API Endpoint
 *
 * Fetches parameter schema for a specific model from its provider.
 * Returns simplified parameter list for UI rendering.
 *
 * GET /api/models/:modelId?provider=replicate|fal|wavespeed
 *
 * Headers:
 *   - X-Replicate-Key: Required for Replicate models
 *   - X-Fal-Key: Optional for fal.ai models
 *   - X-WaveSpeed-Key: Optional for WaveSpeed models
 *
 * Response:
 *   {
 *     success: true,
 *     parameters: ModelParameter[],
 *     cached: boolean
 *   }
 *
 * WaveSpeed models fetch schemas dynamically from the /api/v3/models endpoint,
 * with fallback to static definitions for models without api_schema.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCachedWaveSpeedSchema,
  setCachedWaveSpeedSchema,
  WaveSpeedApiSchema,
} from "@/lib/providers/cache";
import { ModelParameter, ModelInput } from "@/lib/providers/types";
import { ProviderType } from "@/types";
import { fetchReplicateSchema } from "@/lib/models/providers/replicate";
import { fetchFalSchema } from "@/lib/models/providers/fal";
import { fetchWaveSpeedSchema } from "@/lib/models/providers/wavespeed";
import {
  extractParametersFromSchema,
  isImageInput,
  isTextInput,
  convertSchemaProperty,
  toLabel,
  resolvePropertyType,
} from "@/lib/models/schemaExtraction";

// Cache for model schemas (10 minute TTL)
const schemaCache = new Map<string, { parameters: ModelParameter[]; inputs: ModelInput[]; timestamp: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Note: Shared extraction constants moved to schemaExtraction.ts

interface SchemaSuccessResponse {
  success: true;
  parameters: ModelParameter[];
  inputs: ModelInput[];
  cached: boolean;
}

interface SchemaErrorResponse {
  success: false;
  error: string;
}

type SchemaResponse = SchemaSuccessResponse | SchemaErrorResponse;

// Note: Schema extraction helper functions moved to /lib/models/schemaExtraction.ts
// - toLabel()
// - isImageInput()
// - isTextInput()
// - resolvePropertyType()
// - convertSchemaProperty()

interface ExtractedSchema {
  parameters: ModelParameter[];
  inputs: ModelInput[];
}

// Note: Provider-specific schema fetching moved to /lib/models/providers/
// - fetchReplicateSchema -> providers/replicate.ts
// - fetchFalSchema -> providers/fal.ts
// - fetchWaveSpeedSchema -> providers/wavespeed.ts

// Note: extractParametersFromSchema moved to /lib/models/schemaExtraction.ts

/**
 * Get hardcoded schema for Kie.ai models
 * Kie.ai doesn't have a schema discovery API, so we define these manually
 */
function getKieSchema(modelId: string): ExtractedSchema {
  // Common parameters for image models
  const imageParams: ModelParameter[] = [
    { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["1:1", "4:3", "3:4", "16:9", "9:16"], default: "1:1" },
    { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
  ];

  // Flux-2 aspect ratios (includes auto and additional ratios)
  const flux2AspectRatios = ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "auto"];

  // Model-specific schemas
  const schemas: Record<string, ExtractedSchema> = {
    // ============ Image models ============
    "z-image": {
      parameters: imageParams,
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "seedream/4.5-text-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"], default: "1:1" },
        { name: "quality", type: "string", description: "Output quality", enum: ["basic", "high"], default: "basic" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "seedream/4.5-edit": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "21:9"], default: "1:1" },
        { name: "quality", type: "string", description: "Output quality", enum: ["basic", "high"], default: "basic" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "image_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "gpt-image/1.5-text-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["1:1", "2:3", "3:2"], default: "3:2" },
        { name: "quality", type: "string", description: "Output quality", enum: ["medium", "high"], default: "medium" },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "gpt-image/1.5-image-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["1:1", "2:3", "3:2"], default: "3:2" },
        { name: "quality", type: "string", description: "Output quality", enum: ["medium", "high"], default: "medium" },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "input_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "flux-2/pro-text-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: flux2AspectRatios, default: "1:1" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["1K", "2K"], default: "1K" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "flux-2/pro-image-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: flux2AspectRatios, default: "1:1" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["1K", "2K"], default: "1K" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "input_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "flux-2/flex-text-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: flux2AspectRatios, default: "1:1" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["1K", "2K"], default: "1K" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "flux-2/flex-image-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: flux2AspectRatios, default: "1:1" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["1K", "2K"], default: "1K" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "input_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "nano-banana-pro": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["1:1", "2:3", "3:2", "4:3", "16:9", "9:16", "21:9", "auto"], default: "1:1" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["1K", "2K", "4K"], default: "1K" },
        { name: "output_format", type: "string", description: "Output format", enum: ["png", "jpg"], default: "png" },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "image_input", type: "image", required: false, label: "Image", isArray: true },
      ],
    },
    "grok-imagine/text-to-image": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["2:3", "3:2", "1:1", "16:9", "9:16"], default: "1:1" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "grok-imagine/image-to-image": {
      parameters: [],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "image_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    // ============ Audio/TTS models ============
    "elevenlabs/turbo-v2.5": {
      parameters: [
        { name: "voice_id", type: "string", description: "Voice ID to use for synthesis" },
        { name: "stability", type: "number", description: "Voice stability (0-1)", default: 0.5, minimum: 0, maximum: 1 },
        { name: "similarity_boost", type: "number", description: "Similarity boost (0-1)", default: 0.75, minimum: 0, maximum: 1 },
        { name: "output_format", type: "string", description: "Audio output format", enum: ["mp3_44100_128", "mp3_44100_192", "pcm_16000", "pcm_22050", "pcm_24000", "pcm_44100"], default: "mp3_44100_128" },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Text" }],
    },
    "elevenlabs/multilingual-v2": {
      parameters: [
        { name: "voice_id", type: "string", description: "Voice ID to use for synthesis" },
        { name: "stability", type: "number", description: "Voice stability (0-1)", default: 0.5, minimum: 0, maximum: 1 },
        { name: "similarity_boost", type: "number", description: "Similarity boost (0-1)", default: 0.75, minimum: 0, maximum: 1 },
        { name: "output_format", type: "string", description: "Audio output format", enum: ["mp3_44100_128", "mp3_44100_192", "pcm_16000", "pcm_22050", "pcm_24000", "pcm_44100"], default: "mp3_44100_128" },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Text" }],
    },
    "elevenlabs/text-to-dialogue-v3": {
      parameters: [
        { name: "stability", type: "number", description: "Voice stability (0-1)", default: 0.5, minimum: 0, maximum: 1 },
        { name: "similarity_boost", type: "number", description: "Similarity boost (0-1)", default: 0.75, minimum: 0, maximum: 1 },
        { name: "output_format", type: "string", description: "Audio output format", enum: ["mp3_44100_128", "mp3_44100_192", "pcm_16000", "pcm_22050", "pcm_24000", "pcm_44100"], default: "mp3_44100_128" },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Text / Dialogue Script" }],
    },
    "elevenlabs/sound-effect-v2": {
      parameters: [
        { name: "duration_seconds", type: "number", description: "Duration in seconds (0.5-22)", minimum: 0.5, maximum: 22 },
        { name: "loop", type: "boolean", description: "Enable smooth looping", default: false },
        { name: "prompt_influence", type: "number", description: "How closely to follow the prompt (0-1)", default: 0.3, minimum: 0, maximum: 1 },
        { name: "output_format", type: "string", description: "Audio output format", enum: ["mp3_44100_128", "mp3_44100_192", "pcm_16000", "pcm_22050", "pcm_24000", "pcm_44100"], default: "mp3_44100_128" },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Sound Description" }],
    },
    // ============ Video models ============
    "grok-imagine/text-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["2:3", "3:2", "1:1", "16:9", "9:16"], default: "2:3" },
        { name: "duration", type: "string", description: "Video duration in seconds", enum: ["6", "10"], default: "6" },
        { name: "mode", type: "string", description: "Generation mode", enum: ["fun", "normal", "spicy"], default: "normal" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "grok-imagine/image-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["2:3", "3:2", "1:1", "16:9", "9:16"], default: "2:3" },
        { name: "duration", type: "string", description: "Video duration in seconds", enum: ["6", "10"], default: "6" },
        { name: "mode", type: "string", description: "Generation mode", enum: ["fun", "normal", "spicy"], default: "normal" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "image_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "kling-2.6/text-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16", "1:1"], default: "16:9" },
        { name: "duration", type: "string", description: "Video duration", enum: ["5", "10"], default: "5" },
        { name: "sound", type: "boolean", description: "Enable sound generation", default: true },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "kling-2.6/image-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16", "1:1"], default: "16:9" },
        { name: "duration", type: "string", description: "Video duration", enum: ["5", "10"], default: "5" },
        { name: "sound", type: "boolean", description: "Enable sound generation", default: true },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "image_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "kling-2.6/motion-control": {
      parameters: [
        { name: "mode", type: "string", description: "Output resolution", enum: ["720p", "1080p"], default: "720p" },
        { name: "character_orientation", type: "string", description: "Character orientation source", enum: ["image", "video"], default: "video" },
      ],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "input_urls", type: "image", required: true, label: "Image", isArray: true },
        { name: "video_urls", type: "image", required: true, label: "Video", isArray: true },
      ],
    },
    "kling/v2-5-turbo-text-to-video-pro": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16", "1:1"], default: "16:9" },
        { name: "duration", type: "string", description: "Video duration", enum: ["5", "10"], default: "5" },
        { name: "cfg_scale", type: "number", description: "Guidance scale", minimum: 0, maximum: 1, default: 0.5 },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "negative_prompt", type: "text", required: false, label: "Negative Prompt" },
      ],
    },
    "kling/v2-5-turbo-image-to-video-pro": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16", "1:1"], default: "16:9" },
        { name: "duration", type: "string", description: "Video duration", enum: ["5", "10"], default: "5" },
        { name: "cfg_scale", type: "number", description: "Guidance scale", minimum: 0, maximum: 1, default: 0.5 },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "negative_prompt", type: "text", required: false, label: "Negative Prompt" },
        { name: "image_url", type: "image", required: true, label: "Image" },
        { name: "tail_image_url", type: "image", required: false, label: "Tail Image" },
      ],
    },
    "wan/2-6-text-to-video": {
      parameters: [
        { name: "duration", type: "string", description: "Video duration in seconds", enum: ["5", "10", "15"], default: "5" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["720p", "1080p"], default: "1080p" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "wan/2-6-image-to-video": {
      parameters: [
        { name: "duration", type: "string", description: "Video duration in seconds", enum: ["5", "10", "15"], default: "5" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["720p", "1080p"], default: "1080p" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "image_urls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "wan/2-6-video-to-video": {
      parameters: [
        { name: "duration", type: "string", description: "Video duration in seconds", enum: ["5", "10"], default: "5" },
        { name: "resolution", type: "string", description: "Output resolution", enum: ["720p", "1080p"], default: "1080p" },
        { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: false, label: "Prompt" },
        { name: "video_urls", type: "image", required: true, label: "Video", isArray: true },
      ],
    },
    "topaz/video-upscale": {
      parameters: [
        { name: "upscale_factor", type: "string", description: "Upscale factor", enum: ["1", "2", "4"], default: "2" },
      ],
      inputs: [
        { name: "video_url", type: "image", required: true, label: "Video" },
      ],
    },
    "veo3/text-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16"], default: "16:9" },
        { name: "seeds", type: "integer", description: "Random seed (10000-99999)", minimum: 10000, maximum: 99999 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "veo3/image-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16"], default: "16:9" },
        { name: "seeds", type: "integer", description: "Random seed (10000-99999)", minimum: 10000, maximum: 99999 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "imageUrls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
    "veo3-fast/text-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16"], default: "16:9" },
        { name: "seeds", type: "integer", description: "Random seed (10000-99999)", minimum: 10000, maximum: 99999 },
      ],
      inputs: [{ name: "prompt", type: "text", required: true, label: "Prompt" }],
    },
    "veo3-fast/image-to-video": {
      parameters: [
        { name: "aspect_ratio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16"], default: "16:9" },
        { name: "seeds", type: "integer", description: "Random seed (10000-99999)", minimum: 10000, maximum: 99999 },
      ],
      inputs: [
        { name: "prompt", type: "text", required: true, label: "Prompt" },
        { name: "imageUrls", type: "image", required: true, label: "Image", isArray: true },
      ],
    },
  };

  return schemas[modelId] || { parameters: [], inputs: [] };
}

/**
 * Get schema for Gemini video models (native Veo via Gemini API)
 * Returns null if the model is not a Gemini video model.
 */
function getGeminiVideoSchema(modelId: string): ExtractedSchema | null {
  const commonParams: ModelParameter[] = [
    { name: "aspectRatio", type: "string", description: "Output aspect ratio", enum: ["16:9", "9:16"], default: "16:9" },
    { name: "durationSeconds", type: "string", description: "Video duration in seconds", enum: ["4", "6", "8"], default: "8" },
    { name: "resolution", type: "string", description: "Output resolution", enum: ["720p", "1080p", "4k"], default: "720p" },
    { name: "seed", type: "integer", description: "Random seed for reproducibility", minimum: 0 },
  ];

  const textInputs: ModelInput[] = [
    { name: "prompt", type: "text", required: true, label: "Prompt" },
    { name: "negative_prompt", type: "text", required: false, label: "Neg. Prompt" },
  ];

  const schemas: Record<string, ExtractedSchema> = {
    "veo-3.1/text-to-video": {
      parameters: commonParams,
      inputs: textInputs,
    },
    "veo-3.1/image-to-video": {
      parameters: commonParams,
      inputs: [
        ...textInputs,
        { name: "image", type: "image", required: true, label: "Image" },
      ],
    },
    "veo-3.1-fast/text-to-video": {
      parameters: commonParams,
      inputs: textInputs,
    },
    "veo-3.1-fast/image-to-video": {
      parameters: commonParams,
      inputs: [
        ...textInputs,
        { name: "image", type: "image", required: true, label: "Image" },
      ],
    },
  };

  return schemas[modelId] ?? null;
}

/**
 * Get static schema for WaveSpeed models (fallback when dynamic schema not available)
 */
function getStaticWaveSpeedSchema(modelId: string): ExtractedSchema {
  const modelIdLower = modelId.toLowerCase();

  // Common image generation parameters for FLUX, SD3, etc.
  const imageParams: ModelParameter[] = [
    {
      name: "num_inference_steps",
      type: "integer",
      description: "Number of denoising steps. More steps usually lead to higher quality but slower generation.",
      default: 28,
      minimum: 1,
      maximum: 100,
    },
    {
      name: "guidance_scale",
      type: "number",
      description: "Guidance scale for classifier-free guidance. Higher values follow the prompt more closely.",
      default: 3.5,
      minimum: 0,
      maximum: 20,
    },
    {
      name: "seed",
      type: "integer",
      description: "Random seed for reproducibility. Use -1 for random.",
      default: -1,
    },
    {
      name: "image_size",
      type: "string",
      description: "Output image dimensions",
      default: "1024x1024",
      enum: ["512x512", "768x768", "1024x1024", "1024x576", "576x1024", "1024x768", "768x1024", "1280x720", "720x1280"],
    },
  ];

  // Image inputs for image-to-image models
  const imageInputs: ModelInput[] = [];

  // Video model parameters (WAN, Kling, Luma, etc.)
  const videoParams: ModelParameter[] = [
    {
      name: "num_frames",
      type: "integer",
      description: "Number of frames to generate",
      default: 81,
      minimum: 16,
      maximum: 256,
    },
    {
      name: "fps",
      type: "integer",
      description: "Frames per second for the output video",
      default: 16,
      minimum: 8,
      maximum: 30,
    },
    {
      name: "seed",
      type: "integer",
      description: "Random seed for reproducibility. Use -1 for random.",
      default: -1,
    },
    {
      name: "resolution",
      type: "string",
      description: "Output video resolution",
      default: "480p",
      enum: ["480p", "720p", "1080p"],
    },
  ];

  // Check if it's a video model
  const isVideoModel =
    modelIdLower.includes("wan") ||
    modelIdLower.includes("video") ||
    modelIdLower.includes("kling") ||
    modelIdLower.includes("luma") ||
    modelIdLower.includes("minimax") ||
    modelIdLower.includes("t2v") ||
    modelIdLower.includes("i2v");

  // Check if it's an image-to-image model
  const isImg2ImgModel =
    modelIdLower.includes("kontext") ||
    modelIdLower.includes("img2img") ||
    modelIdLower.includes("edit") ||
    modelIdLower.includes("inpaint") ||
    modelIdLower.includes("controlnet");

  if (isVideoModel) {
    // For i2v models, add image input
    if (modelIdLower.includes("i2v")) {
      imageInputs.push({
        name: "image",  // i2v models typically use singular "image"
        type: "image",
        required: true,
        label: "Input Image",
        description: "Starting image for video generation",
      });
    }
    return { parameters: videoParams, inputs: imageInputs };
  }

  // Image generation model
  if (isImg2ImgModel) {
    imageInputs.push({
      name: "images",  // WaveSpeed edit models expect "images" (plural array)
      type: "image",
      required: true,
      label: "Input Image",
      description: "Image to transform or edit",
      isArray: true,  // Signal that this should be sent as an array
    });

    // Add strength parameter for img2img
    imageParams.push({
      name: "strength",
      type: "number",
      description: "How much to transform the input image. 0 = no change, 1 = ignore input completely.",
      default: 0.8,
      minimum: 0,
      maximum: 1,
    });
  }

  return { parameters: imageParams, inputs: imageInputs };
}

// WaveSpeed API base URL
const WAVESPEED_API_BASE = "https://api.wavespeed.ai/api/v3";

/**
 * Fetch WaveSpeed schema dynamically from cache or API
 * Falls back to static schema if dynamic schema not available
 */
async function resolveWaveSpeedSchema(
  modelId: string,
  apiKey: string | null
): Promise<ExtractedSchema> {
  // First check if we have a cached schema from the models list
  const cachedSchema = getCachedWaveSpeedSchema(modelId);
  if (cachedSchema) {
    console.log(`[WaveSpeed Schema] Using cached schema for ${modelId}`);
    const result = extractWaveSpeedSchema(cachedSchema, modelId);
    if (result.parameters.length > 0 || result.inputs.length > 0) {
      return result;
    }
  }

  // If no cache and we have an API key, try fetching the model directly
  if (apiKey) {
    try {
      console.log(`[WaveSpeed Schema] Fetching schema for ${modelId} from API`);
      const response = await fetch(`${WAVESPEED_API_BASE}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const models = data.models || data.data || data.results || [];

        // Find the model by ID
        const model = models.find((m: Record<string, unknown>) => {
          const id = m.model_id || m.id || m.modelId || m.name;
          return id === modelId;
        });

        if (model?.api_schema) {
          // Cache the schema for future use
          setCachedWaveSpeedSchema(modelId, model.api_schema as WaveSpeedApiSchema);

          const result = extractWaveSpeedSchema(model.api_schema as WaveSpeedApiSchema, modelId);
          if (result.parameters.length > 0 || result.inputs.length > 0) {
            console.log(`[WaveSpeed Schema] Found dynamic schema with ${result.parameters.length} params, ${result.inputs.length} inputs`);
            return result;
          }
        }
      }
    } catch (error) {
      console.warn(`[WaveSpeed Schema] Failed to fetch from API: ${error}`);
    }
  }

  // Fall back to static schema
  console.log(`[WaveSpeed Schema] Using static fallback for ${modelId}`);
  return getStaticWaveSpeedSchema(modelId);
}

/**
 * Extract parameters and inputs from WaveSpeed api_schema
 * Schema structure: { api_schemas: [{ request_schema: { properties, required } }] }
 */
function extractWaveSpeedSchema(
  apiSchema: WaveSpeedApiSchema,
  modelId: string
): ExtractedSchema {
  // WaveSpeed schema structure: api_schema.api_schemas[].request_schema
  const apiSchemas = apiSchema.api_schemas;
  if (!apiSchemas || !Array.isArray(apiSchemas) || apiSchemas.length === 0) {
    console.log(`[WaveSpeed Schema] No api_schemas array found for ${modelId}`);
    return { parameters: [], inputs: [] };
  }

  // Use the first schema (primary request schema)
  const requestSchema = apiSchemas[0]?.request_schema;
  if (!requestSchema || typeof requestSchema !== "object") {
    console.log(`[WaveSpeed Schema] No request_schema found for ${modelId}`);
    return { parameters: [], inputs: [] };
  }

  // Log the schema structure for debugging
  const schemaKeys = Object.keys(requestSchema);
  console.log(`[WaveSpeed Schema] Schema keys for ${modelId}: ${schemaKeys.join(", ")}`);

  // Extract parameters using the shared extraction function
  return extractParametersFromSchema(requestSchema as Record<string, unknown>);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ modelId: string }> }
): Promise<NextResponse<SchemaResponse>> {
  // Await params before accessing properties
  const { modelId } = await params;
  const decodedModelId = decodeURIComponent(modelId);
  const provider = request.nextUrl.searchParams.get("provider") as ProviderType | null;

  if (!provider || (provider !== "replicate" && provider !== "fal" && provider !== "kie" && provider !== "wavespeed" && provider !== "gemini")) {
    return NextResponse.json<SchemaErrorResponse>(
      {
        success: false,
        error: "Invalid or missing provider. Use ?provider=replicate, ?provider=fal, ?provider=kie, ?provider=wavespeed, or ?provider=gemini",
      },
      { status: 400 }
    );
  }

  // Check cache
  const cacheKey = `${provider}:${decodedModelId}`;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json<SchemaSuccessResponse>({
      success: true,
      parameters: cached.parameters,
      inputs: cached.inputs,
      cached: true,
    });
  }

  try {
    let result: ExtractedSchema;

    if (provider === "gemini") {
      // Gemini video models use hardcoded schemas
      const geminiVideoSchema = getGeminiVideoSchema(decodedModelId);
      if (geminiVideoSchema) {
        result = geminiVideoSchema;
      } else {
        // Gemini image models don't use schema endpoint (params are built-in)
        result = { parameters: [], inputs: [] };
      }
    } else if (provider === "replicate") {
      // User-provided key takes precedence over env variable
      const apiKey = request.headers.get("X-Replicate-Key") || process.env.REPLICATE_API_KEY;
      if (!apiKey) {
        return NextResponse.json<SchemaErrorResponse>(
          {
            success: false,
            error: "Replicate API key required. Add REPLICATE_API_KEY to .env.local or configure in Settings.",
          },
          { status: 401 }
        );
      }
      result = await fetchReplicateSchema(decodedModelId, apiKey);
    } else if (provider === "kie") {
      // Kie.ai uses hardcoded schemas (no schema discovery API)
      result = getKieSchema(decodedModelId);
    } else if (provider === "wavespeed") {
      // WaveSpeed uses dynamic schemas from API, with static fallback
      const apiKey = request.headers.get("X-WaveSpeed-Key") || process.env.WAVESPEED_API_KEY || null;
      result = await resolveWaveSpeedSchema(decodedModelId, apiKey);
    } else {
      // User-provided key takes precedence over env variable
      const apiKey = request.headers.get("X-Fal-Key") || process.env.FAL_API_KEY || null;
      if (!apiKey) {
        return NextResponse.json<SchemaErrorResponse>(
          {
            success: false,
            error: "fal.ai API key not configured. Add FAL_API_KEY to .env.local or configure in Settings.",
          },
          { status: 401 }
        );
      }
      result = await fetchFalSchema(decodedModelId, apiKey);
    }

    // Cache the result
    schemaCache.set(cacheKey, { ...result, timestamp: Date.now() });

    return NextResponse.json<SchemaSuccessResponse>({
      success: true,
      parameters: result.parameters,
      inputs: result.inputs,
      cached: false,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error(`[ModelSchema] Error fetching ${decodedModelId}: ${errorMessage}`);
    return NextResponse.json<SchemaErrorResponse>(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
