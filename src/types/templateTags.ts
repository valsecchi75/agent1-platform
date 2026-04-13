/**
 * Template Tag Taxonomy Types
 *
 * Controlled vocabulary for template tagging, managed by admins.
 * Tags are organized into groups for structured filtering.
 */

/** Tag group categories — each maps to a filter axis in the UI */
export type TagGroup = "generation" | "task" | "provider" | "style";

export const TAG_GROUP_LABELS: Record<TagGroup, string> = {
  generation: "Generation Type",
  task: "Task / Use Case",
  provider: "Model / Provider",
  style: "Style",
};

export const TAG_GROUP_ICONS: Record<TagGroup, string> = {
  generation: "Layers",
  task: "Target",
  provider: "Cpu",
  style: "Palette",
};

/** A single tag in the taxonomy */
export interface TemplateTag {
  id: number;
  slug: string;
  label: string;
  groupKey: TagGroup;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  usageCount?: number;
  createdAt: string;
}

/** Input for creating a new tag */
export interface CreateTagInput {
  label: string;
  groupKey: TagGroup;
  icon?: string;
  sortOrder?: number;
}

/** Input for updating a tag */
export interface UpdateTagInput {
  label?: string;
  groupKey?: TagGroup;
  icon?: string;
  sortOrder?: number;
  isActive?: boolean;
}
