/**
 * Unified Models API Endpoint
 *
 * Aggregates models from all configured providers (Replicate, fal.ai, Gemini, WaveSpeed).
 * Uses in-memory caching to reduce external API calls.
 *
 * GET /api/models
 *
 * Query params:
 *   - provider: Optional, filter to specific provider ("replicate" | "fal" | "gemini" | "wavespeed")
 *   - search: Optional, search query
 *   - refresh: Optional, bypass cache if "true"
 *   - capabilities: Optional, filter by capabilities (comma-separated)
 *
 * Headers:
 *   - X-Replicate-Key: Replicate API key
 *   - X-Fal-Key: fal.ai API key (optional, works without but rate limited)
 *   - X-WaveSpeed-Key: WaveSpeed API key
 *
 * Response:
 *   {
 *     success: true,
 *     models: ProviderModel[],
 *     cached: boolean,
 *     providers: { [provider]: { success, count, cached?, error? } },
 *     errors?: string[]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { ProviderModel, ModelCapability } from "@/lib/providers";
import {
  getCachedModels,
  setCachedModels,
  getCacheKey,
} from "@/lib/providers/cache";
import { ProviderType } from "@/types";
import { fetchReplicateModels } from "@/lib/models/providers/replicate";
import { fetchFalModels } from "@/lib/models/providers/fal";
import { fetchWaveSpeedModels } from "@/lib/models/providers/wavespeed";
import { filterModelsBySearch } from "@/lib/models/modelFiltering";


// Kie.ai models (hardcoded - no discovery API available)
const KIE_MODELS: ProviderModel[] = [
  // ============ Image Models (11) ============
  {
    id: "z-image",
    name: "Z-Image",
    description: "Fast, affordable text-to-image generation. Great for quick iterations.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.004, currency: "USD" },
    pageUrl: "https://kie.ai/z-image",
  },
  {
    id: "seedream/4.5-text-to-image",
    name: "Seedream 4.5",
    description: "High-quality text-to-image generation with excellent prompt following.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.032, currency: "USD" },
    pageUrl: "https://kie.ai/seedream",
  },
  {
    id: "seedream/4.5-edit",
    name: "Seedream 4.5 Edit",
    description: "Image editing and transformation using Seedream 4.5.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.032, currency: "USD" },
    pageUrl: "https://kie.ai/seedream",
  },
  {
    id: "gpt-image/1.5-text-to-image",
    name: "GPT Image 1.5",
    description: "OpenAI-style image generation with excellent prompt understanding.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.06, currency: "USD" },
    pageUrl: "https://kie.ai/gpt-image-1",
  },
  {
    id: "gpt-image/1.5-image-to-image",
    name: "GPT Image 1.5 Edit",
    description: "Image editing using GPT Image 1.5 model.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.06, currency: "USD" },
    pageUrl: "https://kie.ai/gpt-image-1",
  },
  {
    id: "flux-2/pro-text-to-image",
    name: "FLUX.2 Pro",
    description: "FLUX.2 Pro text-to-image generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  {
    id: "flux-2/pro-image-to-image",
    name: "FLUX.2 Pro Edit",
    description: "FLUX.2 Pro image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  {
    id: "flux-2/flex-text-to-image",
    name: "FLUX.2 Flex",
    description: "FLUX.2 Flex text-to-image generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  {
    id: "flux-2/flex-image-to-image",
    name: "FLUX.2 Flex Edit",
    description: "FLUX.2 Flex image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux-2",
  },
  // NOTE: nano-banana-pro removed from Kie — it's a Gemini-native model, listed in GEMINI_IMAGE_MODELS
  {
    id: "grok-imagine/text-to-image",
    name: "Grok Imagine",
    description: "Grok Imagine text-to-image generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  {
    id: "grok-imagine/image-to-image",
    name: "Grok Imagine Edit",
    description: "Grok Imagine image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  // ============ Video Models (11) ============
  {
    id: "grok-imagine/text-to-video",
    name: "Grok Imagine Video",
    description: "Grok Imagine text-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  {
    id: "grok-imagine/image-to-video",
    name: "Grok Imagine I2V",
    description: "Grok Imagine image-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/grok-imagine",
  },
  {
    id: "kling-2.6/text-to-video",
    name: "Kling 2.6",
    description: "Kling 2.6 video generation from text.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.60, currency: "USD" },
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling-2.6/image-to-video",
    name: "Kling 2.6 Image-to-Video",
    description: "Kling 2.6 video generation from images.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.60, currency: "USD" },
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling-2.6/motion-control",
    name: "Kling 2.6 Motion Control",
    description: "Motion transfer from video to static image. Supports 720p and 1080p output.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling/v2-5-turbo-text-to-video-pro",
    name: "Kling 2.5 Turbo",
    description: "Kling 2.5 Turbo text-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "kling/v2-5-turbo-image-to-video-pro",
    name: "Kling 2.5 Turbo I2V",
    description: "Kling 2.5 Turbo image-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-2-6",
  },
  {
    id: "wan/2-6-text-to-video",
    name: "Wan 2.6",
    description: "Wan 2.6 video generation from text.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.90, currency: "USD" },
    pageUrl: "https://kie.ai/wan-2-6",
  },
  {
    id: "wan/2-6-image-to-video",
    name: "Wan 2.6 Image-to-Video",
    description: "Wan 2.6 video generation from images.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.90, currency: "USD" },
    pageUrl: "https://kie.ai/wan-2-6",
  },
  {
    id: "wan/2-6-video-to-video",
    name: "Wan 2.6 V2V",
    description: "Wan 2.6 video-to-video transformation via Kie.ai.",
    provider: "kie",
    capabilities: ["video-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/wan-2-6",
  },
  {
    id: "topaz/video-upscale",
    name: "Topaz Video Upscale",
    description: "AI video upscaling. Supports 1x, 2x, and 4x scaling factors.",
    provider: "kie",
    capabilities: ["video-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/topaz",
  },
  {
    id: "veo3/text-to-video",
    name: "Veo 3",
    description: "Google Veo 3.1 high-quality text-to-video generation with audio via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://docs.kie.ai/veo3-api/quickstart",
  },
  {
    id: "veo3/image-to-video",
    name: "Veo 3 I2V",
    description: "Google Veo 3.1 image-to-video generation via Kie.ai. Supports 1-2 reference images.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://docs.kie.ai/veo3-api/quickstart",
  },
  {
    id: "veo3-fast/text-to-video",
    name: "Veo 3 Fast",
    description: "Google Veo 3.1 fast text-to-video generation with audio via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://docs.kie.ai/veo3-api/quickstart",
  },
  {
    id: "veo3-fast/image-to-video",
    name: "Veo 3 Fast I2V",
    description: "Google Veo 3.1 fast image-to-video generation via Kie.ai. Supports 1-2 reference images.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://docs.kie.ai/veo3-api/quickstart",
  },
  // ============ Audio/TTS Models (4) ============
  {
    id: "elevenlabs/turbo-v2.5",
    name: "ElevenLabs Turbo v2.5",
    description: "Fast, high-quality text-to-speech with natural-sounding voices from ElevenLabs via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-audio"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.05, currency: "USD" },
    pageUrl: "https://kie.ai/elevenlabs-tts",
  },
  {
    id: "elevenlabs/multilingual-v2",
    name: "ElevenLabs Multilingual v2",
    description: "Multilingual text-to-speech supporting multiple languages with natural voices via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-audio"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.05, currency: "USD" },
    pageUrl: "https://kie.ai/elevenlabs-tts",
  },
  {
    id: "elevenlabs/text-to-dialogue-v3",
    name: "ElevenLabs Eleven V3",
    description: "ElevenLabs' most expressive text-to-speech model with emotional nuance, supporting 70+ languages and audio tags for dialogue via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-audio"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.06, currency: "USD" },
    pageUrl: "https://kie.ai/elevenlabs/text-to-dialogue-v3",
  },
  {
    id: "elevenlabs/sound-effect-v2",
    name: "ElevenLabs Sound Effects v2",
    description: "Generate sound effects from text descriptions. Supports looping, 0.5-22 second duration, and multiple output formats via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-audio"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.02, currency: "USD" },
    pageUrl: "https://kie.ai/elevenlabs-sound-effect",
  },
  // ============ New Image Models ============
  {
    id: "4o-image/text-to-image",
    name: "4o Image",
    description: "GPT-4o powered image generation with strong prompt understanding and text rendering via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/4o-image",
  },
  {
    id: "flux-1/kontext-text-to-image",
    name: "Flux.1 Kontext",
    description: "Contextual image editing and generation with FLUX.1 Kontext via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/flux1-kontext",
  },
  {
    id: "midjourney/text-to-image",
    name: "Midjourney",
    description: "Midjourney image generation via Kie.ai. High-quality artistic and photorealistic output.",
    provider: "kie",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/midjourney",
  },
  {
    id: "midjourney/image-to-image",
    name: "Midjourney Edit",
    description: "Midjourney image-to-image editing via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-image"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/midjourney",
  },
  // ============ New Video Models ============
  {
    id: "sora-2/text-to-video",
    name: "Sora 2",
    description: "OpenAI Sora 2 text-to-video generation via Kie.ai. High-quality, cinematic video output.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/sora-2",
  },
  {
    id: "sora-2/image-to-video",
    name: "Sora 2 I2V",
    description: "OpenAI Sora 2 image-to-video generation via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/sora-2",
  },
  {
    id: "s-2pro/text-to-video",
    name: "Sora 2 Pro",
    description: "OpenAI Sora 2 Pro with higher quality and longer duration via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/sora-2",
  },
  {
    id: "runway/gen4-turbo-text-to-video",
    name: "Runway Gen-4 Turbo",
    description: "Runway Gen-4 Turbo text-to-video with fast rendering via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/runway-gen4",
  },
  {
    id: "runway/gen4-text-to-video",
    name: "Runway Gen-4",
    description: "Runway Gen-4 video generation with scene reasoning and camera control via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/runway-gen4",
  },
  {
    id: "kling-3.0/text-to-video",
    name: "Kling 3.0",
    description: "Kling 3.0 video generation with cinematic visuals, fluid motion, and native audio via Kie.ai.",
    provider: "kie",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-3-0",
  },
  {
    id: "kling-3.0/image-to-video",
    name: "Kling 3.0 I2V",
    description: "Kling 3.0 image-to-video with cinematic output via Kie.ai.",
    provider: "kie",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/kling-3-0",
  },
  // ============ Music Models (Suno via Kie) ============
  {
    id: "suno/v4",
    name: "Suno V4",
    description: "AI music generation with Suno V4 via Kie.ai. Create full songs from text prompts.",
    provider: "kie",
    capabilities: ["text-to-music"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/suno",
  },
  {
    id: "suno/v4.5",
    name: "Suno V4.5",
    description: "Enhanced AI music generation with Suno V4.5 via Kie.ai. Improved quality and style control.",
    provider: "kie",
    capabilities: ["text-to-music"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/suno",
  },
  {
    id: "suno/v5",
    name: "Suno V5",
    description: "Latest Suno V5 music generation via Kie.ai. Highest quality AI-generated music with full instrumentation.",
    provider: "kie",
    capabilities: ["text-to-music"],
    coverImage: undefined,
    pageUrl: "https://kie.ai/suno",
  },
];

// Gemini image models (hardcoded - these don't come from an external API)
const GEMINI_IMAGE_MODELS: ProviderModel[] = [
  {
    id: "nano-banana",
    name: "Nano Banana",
    description: "Fast image generation with Gemini 2.5 Flash. Supports text-to-image and image-to-image with aspect ratio control.",
    provider: "gemini",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.039, currency: "USD" },
  },
  {
    id: "nano-banana-2",
    name: "Nano Banana 2",
    description: "High-efficiency image generation with Gemini 3.1 Flash. Supports resolution control (512/1K/2K/4K), Google Search grounding, and up to 10 reference images.",
    provider: "gemini",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.067, currency: "USD" },
  },
  {
    id: "nano-banana-pro",
    name: "Nano Banana Pro",
    description: "High-quality image generation with Gemini 3 Pro. Supports text-to-image, image-to-image, resolution control (1K/2K/4K), and Google Search grounding.",
    provider: "gemini",
    capabilities: ["text-to-image", "image-to-image"],
    coverImage: undefined,
    pricing: { type: "per-run", amount: 0.134, currency: "USD" },
  },
  {
    id: "imagen-4.0-fast-generate-001",
    name: "Imagen 4 Fast",
    description: "Fast, affordable text-to-image generation with Imagen 4. Optimized for high volume and quick iterations.",
    provider: "gemini",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-image", amount: 0.02, currency: "USD" },
  },
  {
    id: "imagen-4.0-generate-001",
    name: "Imagen 4",
    description: "High-fidelity text-to-image generation with Imagen 4. Photorealistic output, precise text rendering, up to 2K resolution.",
    provider: "gemini",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-image", amount: 0.04, currency: "USD" },
  },
  {
    id: "imagen-4.0-ultra-generate-001",
    name: "Imagen 4 Ultra",
    description: "Highest quality text-to-image generation with Imagen 4 Ultra. Maximum fidelity, complex lighting, up to 2K resolution.",
    provider: "gemini",
    capabilities: ["text-to-image"],
    coverImage: undefined,
    pricing: { type: "per-image", amount: 0.06, currency: "USD" },
  },
];

// Gemini video models (native Veo via Gemini API)
const GEMINI_VIDEO_MODELS: ProviderModel[] = [
  {
    id: "veo-3.1/text-to-video",
    name: "Veo 3.1",
    description: "Highest quality video generation with Veo 3.1. Supports 720p/1080p/4k, 4-8 second clips, and native audio via Gemini API.",
    provider: "gemini",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pricing: { type: "per-second", amount: 0.40, currency: "USD" },
  },
  {
    id: "veo-3.1/image-to-video",
    name: "Veo 3.1 I2V",
    description: "Image-to-video generation with Veo 3.1. Supports 720p/1080p/4k, 4-8 second clips, and native audio via Gemini API.",
    provider: "gemini",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pricing: { type: "per-second", amount: 0.40, currency: "USD" },
  },
  {
    id: "veo-3.1-fast/text-to-video",
    name: "Veo 3.1 Fast",
    description: "Fast, cost-effective video generation with Veo 3.1 Fast. Supports 720p/1080p/4k, 4-8 second clips via Gemini API.",
    provider: "gemini",
    capabilities: ["text-to-video"],
    coverImage: undefined,
    pricing: { type: "per-second", amount: 0.15, currency: "USD" },
  },
  {
    id: "veo-3.1-fast/image-to-video",
    name: "Veo 3.1 Fast I2V",
    description: "Fast image-to-video generation with Veo 3.1 Fast. Supports 720p/1080p/4k, 4-8 second clips via Gemini API.",
    provider: "gemini",
    capabilities: ["image-to-video"],
    coverImage: undefined,
    pricing: { type: "per-second", amount: 0.15, currency: "USD" },
  },
];

// Gemini music models (Lyria via Gemini API)
const GEMINI_MUSIC_MODELS: ProviderModel[] = [
  {
    id: "lyria-3-pro-preview",
    name: "Lyria 3 Pro",
    description: "Full-length AI music generation with Lyria 3 Pro via Gemini API. Create complete songs from text prompts.",
    provider: "gemini",
    capabilities: ["text-to-music"],
    coverImage: undefined,
    pricing: { type: "per-song", amount: 0.08, currency: "USD" },
  },
  {
    id: "lyria-3-clip-preview",
    name: "Lyria 3 Clip",
    description: "Short AI music clip generation with Lyria 3 via Gemini API. Up to 30-second clips.",
    provider: "gemini",
    capabilities: ["text-to-music"],
    coverImage: undefined,
    pricing: { type: "per-song", amount: 0.04, currency: "USD" },
  },
];

// Gemini TTS models (Text-to-Speech via Gemini API)
const GEMINI_TTS_MODELS: ProviderModel[] = [
  {
    id: "gemini-2.5-flash-preview-tts",
    name: "Gemini Flash TTS",
    description: "Fast text-to-speech generation with Gemini 2.5 Flash. Natural-sounding voices, supports 1-2 speakers.",
    provider: "gemini",
    capabilities: ["text-to-speech"],
    coverImage: undefined,
  },
  {
    id: "gemini-2.5-pro-preview-tts",
    name: "Gemini Pro TTS",
    description: "High-fidelity text-to-speech with Gemini 2.5 Pro. Premium voice quality and expressive speech synthesis.",
    provider: "gemini",
    capabilities: ["text-to-speech"],
    coverImage: undefined,
  },
];

// WaveSpeed models are now fetched dynamically from https://api.wavespeed.ai/api/v3/models

// ============ Response Types ============

interface ProviderResult {
  success: boolean;
  count: number;
  cached?: boolean;
  error?: string;
}

interface ModelsSuccessResponse {
  success: true;
  models: ProviderModel[];
  cached: boolean;
  providers: Record<string, ProviderResult>;
  /** All providers that have API keys configured (env or client header) */
  availableProviders: string[];
  errors?: string[];
}

interface ModelsErrorResponse {
  success: false;
  error: string;
}

type ModelsResponse = ModelsSuccessResponse | ModelsErrorResponse;

// ============ Helpers for Provider Integration ============
// Note: Per-provider fetch logic moved to /lib/models/providers/
// - fetchReplicateModels -> providers/replicate.ts
// - fetchFalModels -> providers/fal.ts
// - fetchWaveSpeedModels -> providers/wavespeed.ts

// ============ Main Handler ============

export async function GET(
  request: NextRequest
): Promise<NextResponse<ModelsResponse>> {
  // Parse query params
  const providerFilter = request.nextUrl.searchParams.get("provider") as
    | ProviderType
    | null;
  const searchQuery = request.nextUrl.searchParams.get("search") || undefined;
  const refresh = request.nextUrl.searchParams.get("refresh") === "true";
  const capabilitiesParam = request.nextUrl.searchParams.get("capabilities");
  const capabilitiesFilter: ModelCapability[] | null = capabilitiesParam
    ? (capabilitiesParam.split(",") as ModelCapability[])
    : null;

  // Get API keys from headers, falling back to env variables
  const replicateKey = request.headers.get("X-Replicate-Key") || process.env.REPLICATE_API_KEY || null;
  const falKey = request.headers.get("X-Fal-Key") || process.env.FAL_API_KEY || null;
  const kieKey = request.headers.get("X-Kie-Key") || process.env.KIE_API_KEY || null;
  const wavespeedKey = request.headers.get("X-WaveSpeed-Key") || process.env.WAVESPEED_API_KEY || null;

  // Build list of all available providers (have keys from env or client headers)
  const availableProviders: string[] = ["gemini"]; // Gemini always available
  if (falKey) availableProviders.push("fal");
  if (replicateKey) availableProviders.push("replicate");
  if (kieKey) availableProviders.push("kie");
  if (wavespeedKey) availableProviders.push("wavespeed");

  // Determine which providers to fetch from (excluding gemini/kie - handled separately as hardcoded)
  const providersToFetch: ProviderType[] = [];
  let includeGemini = false;
  let includeKie = false;

  if (providerFilter) {
    if (providerFilter === "gemini") {
      // Only Gemini requested - no external API calls needed
      includeGemini = true;
    } else if (providerFilter === "kie") {
      // Only Kie requested - no external API calls needed (hardcoded models)
      if (kieKey) {
        includeKie = true;
      } else {
        return NextResponse.json<ModelsErrorResponse>(
          {
            success: false,
            error: "Kie API key required. Add KIE_API_KEY to .env.local or configure in Settings.",
          },
          { status: 400 }
        );
      }
    } else if (providerFilter === "wavespeed") {
      if (wavespeedKey) {
        // WaveSpeed requested with key - fetch from API
        providersToFetch.push("wavespeed");
      } else {
        // WaveSpeed requested but no key configured
        return NextResponse.json<ModelsErrorResponse>(
          {
            success: false,
            error:
              "WaveSpeed API key required. Add WAVESPEED_API_KEY to .env.local or configure in Settings.",
          },
          { status: 400 }
        );
      }
    } else if (providerFilter === "replicate" && replicateKey) {
      providersToFetch.push("replicate");
    } else if (providerFilter === "fal" && falKey) {
      providersToFetch.push("fal");
    }
  } else {
    // Include all providers that have keys configured
    includeGemini = true; // Gemini always available
    includeKie = kieKey ? true : false; // Kie only if API key is configured
    if (wavespeedKey) {
      providersToFetch.push("wavespeed"); // WaveSpeed if key is configured
    }
    if (replicateKey) {
      providersToFetch.push("replicate");
    }
    if (falKey) {
      providersToFetch.push("fal");
    }
  }

  // Gemini and Kie are always available (with key for Kie), so we don't fail if no external providers
  if (providersToFetch.length === 0 && !includeGemini && !includeKie) {
    return NextResponse.json<ModelsErrorResponse>(
      {
        success: false,
        error:
          "No providers available. Add REPLICATE_API_KEY, FAL_API_KEY, KIE_API_KEY, or WAVESPEED_API_KEY to .env.local or configure in Settings.",
      },
      { status: 400 }
    );
  }

  const allModels: ProviderModel[] = [];
  const providerResults: Record<string, ProviderResult> = {};
  const errors: string[] = [];
  let anyFromCache = false;
  let allFromCache = true;

  // Add Gemini models first if included (they appear at the top)
  if (includeGemini) {
    // Filter by search query if provided
    let geminiModels = [...GEMINI_IMAGE_MODELS, ...GEMINI_VIDEO_MODELS, ...GEMINI_MUSIC_MODELS, ...GEMINI_TTS_MODELS];
    if (searchQuery) {
      geminiModels = filterModelsBySearch(geminiModels, searchQuery);
    }
    allModels.push(...geminiModels);
    providerResults["gemini"] = {
      success: true,
      count: geminiModels.length,
      cached: true, // Hardcoded models are effectively "cached"
    };
    anyFromCache = true;
  }

  // Add Kie models if included (hardcoded, no API call needed)
  if (includeKie) {
    // Filter by search query if provided
    let kieModels = KIE_MODELS;
    if (searchQuery) {
      kieModels = filterModelsBySearch(kieModels, searchQuery);
    }
    allModels.push(...kieModels);
    providerResults["kie"] = {
      success: true,
      count: kieModels.length,
      cached: true, // Hardcoded models are effectively "cached"
    };
    anyFromCache = true;
  }

  // Fetch from each provider (replicate, fal, wavespeed)
  for (const provider of providersToFetch) {
    // For Replicate and WaveSpeed, always use base cache key since we filter client-side
    // For fal.ai, include search in cache key since their API supports search
    const cacheKey =
      provider === "replicate" || provider === "wavespeed"
        ? getCacheKey(provider)
        : getCacheKey(provider, searchQuery);
    let models: ProviderModel[] | null = null;
    let fromCache = false;

    // Check cache first (unless refresh=true)
    if (!refresh) {
      const cached = getCachedModels(cacheKey);
      if (cached) {
        models = cached;
        fromCache = true;
        anyFromCache = true;

        // For Replicate and WaveSpeed, apply client-side search filtering on cached models
        if ((provider === "replicate" || provider === "wavespeed") && searchQuery) {
          models = filterModelsBySearch(models, searchQuery);
        }
      }
    }

    // Fetch from API if cache miss
    if (!models) {
      allFromCache = false;
      try {
        if (provider === "replicate") {
          // Fetch all models (no search param - we filter client-side)
          const allReplicateModels = await fetchReplicateModels(replicateKey!);
          // Cache the full list
          setCachedModels(cacheKey, allReplicateModels);
          // Apply search filter if needed
          models = searchQuery
            ? filterModelsBySearch(allReplicateModels, searchQuery)
            : allReplicateModels;
        } else if (provider === "fal") {
          models = await fetchFalModels(falKey, searchQuery);
          // Cache the results (fal.ai handles search server-side)
          setCachedModels(cacheKey, models);
        } else if (provider === "wavespeed") {
          // Fetch all models from WaveSpeed API
          const allWaveSpeedModels = await fetchWaveSpeedModels(wavespeedKey!);
          // Cache the full list
          setCachedModels(cacheKey, allWaveSpeedModels);
          // Apply search filter if needed (client-side filtering like Replicate)
          models = searchQuery
            ? filterModelsBySearch(allWaveSpeedModels, searchQuery)
            : allWaveSpeedModels;
        } else {
          models = [];
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        // 401 = API key not configured — skip silently, this is normal
        const is401 = errorMessage.includes('401') || errorMessage.includes('Unauthorized');
        if (!is401) {
          console.warn(`[Models] ${provider}: ${errorMessage}`);
        }
        errors.push(`${provider}: ${errorMessage}`);
        providerResults[provider] = {
          success: false,
          count: 0,
          error: errorMessage,
        };
        continue;
      }
    }

    // Add to results
    allModels.push(...models);
    providerResults[provider] = {
      success: true,
      count: models.length,
      cached: fromCache,
    };
  }

  // Check if we got any models
  if (allModels.length === 0 && errors.length === providersToFetch.length) {
    // All providers failed
    return NextResponse.json<ModelsErrorResponse>(
      {
        success: false,
        error: `All providers failed: ${errors.join("; ")}`,
      },
      { status: 500 }
    );
  }

  // Filter by capabilities if specified
  let filteredModels = allModels;
  if (capabilitiesFilter && capabilitiesFilter.length > 0) {
    filteredModels = allModels.filter((model) =>
      model.capabilities.some((cap) => capabilitiesFilter.includes(cap))
    );
  }

  // Sort models by provider, then by name
  filteredModels.sort((a, b) => {
    if (a.provider !== b.provider) {
      return a.provider.localeCompare(b.provider);
    }
    return a.name.localeCompare(b.name);
  });

  const response: ModelsSuccessResponse = {
    success: true,
    models: filteredModels,
    cached: anyFromCache && allFromCache,
    providers: providerResults,
    availableProviders,
  };

  if (errors.length > 0) {
    response.errors = errors;
  }

  return NextResponse.json<ModelsSuccessResponse>(response);
}
