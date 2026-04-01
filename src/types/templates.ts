/**
 * Template Pack Types
 *
 * Types for the Template Pack system — reusable workflow packages stored
 * in storage/templates/{slug}/ with metadata, nodes, edges, and preview frames.
 */

import type { WorkflowEdge, NodeGroup } from "./workflow";
import type { NodeType, WorkflowNode } from "./nodes";

/**
 * Template Pack — a reusable workflow package stored as a folder
 * in storage/templates/{slug}/
 */
export interface TemplatePack {
  version: 1;
  slug: string;
  name: string;
  description: string;
  author: string;
  createdAt: string; // ISO 8601 date string
  updatedAt: string; // ISO 8601 date string

  source: "local" | "remote";
  sourceUrl: string | null; // URL to remote registry or repo
  registryVersion: string | null; // Version from remote registry

  category: TemplateCategory;
  tags: string[]; // User-defined custom tags
  techTags: string[]; // Auto-detected from node types
  nodeCount: number; // Auto-calculated from nodes array length

  edgeStyle: string; // Edge animation/style preset (e.g., "default", "animated")
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups?: NodeGroup[]; // Optional node groups/canvas organization
}

/**
 * Template category classification
 */
export type TemplateCategory =
  | "simple"
  | "advanced"
  | "production"
  | "experimental";

/**
 * Lightweight metadata returned by the list endpoint (no nodes/edges)
 */
export interface TemplatePackMeta {
  slug: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  source: "local" | "remote";
  sourceUrl: string | null;
  registryVersion: string | null;
  category: TemplateCategory;
  tags: string[];
  techTags: string[];
  nodeCount: number;
  previewFrames: string[]; // Filenames in preview/ folder, e.g. ["1.jpg", "1a.jpg", "1b.jpg"]
}

/**
 * A single entry in the remote registry.json
 */
export interface RegistryEntry {
  slug: string;
  name: string;
  description: string;
  author: string;
  version: string;
  category: TemplateCategory;
  tags: string[];
  techTags: string[];
  nodeCount: number;
  previewPath: string; // Relative path to primary preview image
  templatePath: string; // Relative path to template.json
  previewFrames: string[]; // Just filenames (e.g. ["1.jpg", "1a.jpg"])
}

/**
 * The remote registry.json root object
 */
export interface TemplateRegistry {
  registryVersion: string;
  updatedAt: string;
  baseUrl: string; // e.g. "https://raw.githubusercontent.com/user/repo/main"
  templates: RegistryEntry[];
}

/**
 * Input data for creating/updating a template
 */
export interface SaveTemplateInput {
  name: string;
  description: string;
  category: TemplateCategory;
  tags: string[];
  author: string;
  previewImages?: Array<{ filename: string; data: string }>; // Base64 data URLs
}

/**
 * Categories available in the UI
 */
export const TEMPLATE_CATEGORIES: Array<{
  value: TemplateCategory;
  label: string;
}> = [
  { value: "simple", label: "Simple" },
  { value: "advanced", label: "Advanced" },
  { value: "production", label: "Production" },
  { value: "experimental", label: "Experimental" },
];

/**
 * Tech tag detection rules — maps node types and model providers to tech tags
 */
export const TECH_TAG_MAP: Record<
  NodeType | string,
  string | ((nodeData: unknown) => string | null)
> = {
  nanoBanana: "Nano Banana",
  llmGenerate: "LLM",
  generateVideo: "Video Gen",
  generate3d: "3D Gen",
  generateAudio: "Audio Gen",
  annotation: "Annotation",
  splitGrid: "Split Grid",
  promptConstructor: "Prompt Constructor",
  array: "Array",
};
