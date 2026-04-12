/**
 * Custom Nodes — Type Definitions
 *
 * Types for the custom_nodes system and Neural Atelier node pack.
 */

import type { BaseNodeData } from "./annotation";
import type { NodeStatus } from "./nodes";

// ── Custom Node Pack (manifest.json) ──

export interface CustomNodePackManifest {
  name: string;
  version: string;
  author: string;
  description: string;
  category: string;
  nodes: CustomNodeDefinition[];
}

export interface CustomNodeDefinition {
  id: string;
  label: string;
  description: string;
  configDir: string;
}

// ── Shared generation settings (all NA nodes) ──

export interface NAGenerationSettings {
  imageModel: string;
  aspectRatio: string;
  resolution: string;
  topP: number;
}

export const NA_IMAGE_MODELS = [
  { value: "nano-banana-pro", label: "Nano Banana Pro", modelId: "gemini-3-pro-image-preview" },
  { value: "nano-banana-2", label: "Nano Banana 2", modelId: "gemini-3.1-flash-image-preview" },
] as const;

export const NA_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
export const NA_RESOLUTIONS = ["1K", "2K", "4K"] as const;

// ── Gemini Flash model for prompt orchestration ──
export const NA_FLASH_MODEL = "gemini-2.5-flash";

// ── NA - Sketch to Photo ──

export interface NASketchToPhotoData extends BaseNodeData {
  promptProfile: string;
  briefText: string;
  imageModel: string;
  aspectRatio: string;
  resolution: string;
  topP: number;
  outputImage: string | null;
  log: string | null;
  flashRequestJson: string | null;
  nanoBananaRequestJson: string | null;
  status: NodeStatus;
  error: string | null;
}

// ── NA - Styling Detail Change ──

export interface NAStylingDetailData extends BaseNodeData {
  garmentType: string;
  detailCategory: string;
  detailOption: string;
  description: string;
  brief: string;
  imageModel: string;
  aspectRatio: string;
  resolution: string;
  topP: number;
  outputImage: string | null;
  prompt: string | null;
  log: string | null;
  outputJson: string | null;
  status: NodeStatus;
  error: string | null;
}

// ── NA - Recolor ──

export interface NARecolorData extends BaseNodeData {
  pantoneColorCurated: string;
  pantoneColor: string;
  brief: string;
  imageModel: string;
  aspectRatio: string;
  resolution: string;
  topP: number;
  outputImage: string | null;
  prompt: string | null;
  log: string | null;
  outputJson: string | null;
  status: NodeStatus;
  error: string | null;
}

// ── Morpheus Model Management ──

export interface MorpheusTalent {
  id: string;
  name: string;
  gender: string;
  age_group: string;
  ethnicity: string;
  skin_tone: string;
  hair_color: string;
  hair_style: string;
  eye_color: string;
  body_type: string;
  freckles: boolean;
  tags: string[];
  description: string;
  image_path: string;
  thumbnail_url?: string;
  full_image_url?: string;
  copyright: string;
  download_url: string;
  rating?: number;
  portfolio_size?: number;
  is_favorite: boolean;
}

export interface MorpheusTalentCatalog {
  version: string;
  description: string;
  talents: MorpheusTalent[];
  metadata?: {
    total_talents: number;
    gender_distribution: Record<string, number>;
    age_distribution: Record<string, number>;
    ethnicity_distribution: Record<string, number>;
    popular_tags: string[];
  };
}

export interface MorpheusFilters {
  name: string;
  tags: string;
  tagLogic: "OR" | "AND";
  gender: string;
  age_group: string;
  ethnicity: string;
  favoritesOnly: boolean;
}

export interface MorpheusModelManagementData extends BaseNodeData {
  // Selected talent
  selectedTalentId: string | null;
  selectedTalentName: string | null;
  selectedTalentImage: string | null;
  selectedTalentDescription: string | null;
  selectedTalentTags: string[];

  // Filters state
  filters: MorpheusFilters;
  currentPage: number;

  // Patreon auth state
  patreonAuthenticated: boolean;
  patreonUserName: string | null;
  patreonDeviceId: string | null;

  // Variable output (for @variableName system)
  variableName: string | undefined;

  // Outputs
  outputImage: string | null;
  outputDescription: string | null;
  outputMetadata: string | null;

  // Status
  status: NodeStatus;
  error: string | null;
}

// ── Foundation Utility Nodes ──

export interface PreviewImageData extends BaseNodeData {
  image: string | null;
  label: string;
}

export interface ShowAnythingData extends BaseNodeData {
  content: string | null;
  contentType: "text" | "image" | "video" | "audio" | "json" | "unknown";
}
