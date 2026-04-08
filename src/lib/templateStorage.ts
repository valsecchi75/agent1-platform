/**
 * Template Pack Storage — Server-side CRUD for template folders
 *
 * Storage layout:
 *   storage/templates/{slug}/
 *     meta.json                  — lightweight metadata (no nodes/edges)
 *     template.json              — full payload (metadata + nodes + edges)
 *     preview/
 *       1.jpg, 1a.jpg, 1b.jpg   — preview animation frames
 *
 * The meta.json file is kept in sync automatically on every write.
 * listTemplates() reads only meta.json (fast even with 200MB+ templates).
 * getTemplate() reads the full template.json when a specific template is needed.
 *
 * This module uses synchronous fs operations and is server-side only.
 */

import * as fs from "fs";
import * as path from "path";
import type {
  TemplatePack,
  TemplatePackMeta,
  TemplateCategory,
  SaveTemplateInput,
} from "@/types/templates";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge } from "@/types/workflow";

const STORAGE_DIR = path.resolve(process.cwd(), "storage");
const TEMPLATES_DIR = path.join(STORAGE_DIR, "templates");

// Maximum file size (in bytes) we'll attempt to parse for metadata migration.
// Files larger than this are skipped during auto-migration to avoid blocking.
const MAX_MIGRATION_SIZE = 20 * 1024 * 1024; // 20 MB

/**
 * Ensure storage/templates directory exists
 */
function ensureTemplatesDir(): void {
  if (!fs.existsSync(TEMPLATES_DIR)) {
    fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  }
}

/**
 * Build a TemplatePackMeta object from a full TemplatePack
 */
function buildMeta(data: TemplatePack, previewFrames: string[]): TemplatePackMeta {
  return {
    slug: data.slug,
    name: data.name,
    description: data.description,
    author: data.author,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    source: data.source,
    sourceUrl: data.sourceUrl,
    registryVersion: data.registryVersion,
    category: data.category,
    tags: data.tags,
    techTags: data.techTags,
    nodeCount: data.nodeCount ?? data.nodes?.length ?? 0,
    previewFrames,
  };
}

/**
 * Write the lightweight meta.json sidecar file for a template
 */
function writeMeta(slug: string, meta: TemplatePackMeta): void {
  const metaPath = path.join(TEMPLATES_DIR, slug, "meta.json");
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

/**
 * Try to read meta.json for a template. Returns null if not found.
 */
function readMeta(slug: string): TemplatePackMeta | null {
  const metaPath = path.join(TEMPLATES_DIR, slug, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  try {
    const content = fs.readFileSync(metaPath, "utf-8");
    return JSON.parse(content) as TemplatePackMeta;
  } catch {
    return null;
  }
}

/**
 * Convert a name to a URL-safe slug with uniqueness checking
 * E.g. "My Template Pack" → "my-template-pack"
 * If slug exists, append -2, -3, etc.
 */
export function slugify(name: string): string {
  ensureTemplatesDir();

  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Collapse multiple dashes
    .replace(/^-|-$/g, ""); // Remove leading/trailing dashes

  // Truncate to 50 characters
  slug = slug.substring(0, 50);

  // Check for uniqueness
  let finalSlug = slug;
  let counter = 2;
  while (fs.existsSync(path.join(TEMPLATES_DIR, finalSlug))) {
    finalSlug = `${slug}-${counter}`;
    counter++;
  }

  return finalSlug;
}

/**
 * List all templates with lightweight metadata (no nodes/edges).
 *
 * Reads meta.json when available (instant, even for 200MB+ templates).
 * Falls back to parsing template.json only for small files (<20MB)
 * and writes meta.json for next time.
 */
export function listTemplates(): TemplatePackMeta[] {
  ensureTemplatesDir();

  const dirs = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  const templates: TemplatePackMeta[] = [];

  for (const dir of dirs) {
    if (!dir.isDirectory()) continue;

    const slug = dir.name;

    // 1. Try fast path: read meta.json
    const meta = readMeta(slug);
    if (meta) {
      // Refresh preview frames (cheap directory read)
      meta.previewFrames = getPreviewFrames(slug);
      templates.push(meta);
      continue;
    }

    // 2. Slow path: no meta.json yet — check template.json size before parsing
    const templatePath = path.join(TEMPLATES_DIR, slug, "template.json");
    if (!fs.existsSync(templatePath)) continue;

    try {
      const stat = fs.statSync(templatePath);

      if (stat.size > MAX_MIGRATION_SIZE) {
        // File too large to parse just for listing.
        // Create minimal meta from filename and file stats.
        console.warn(
          `[Templates] Skipping full parse for ${slug} (${(stat.size / 1024 / 1024).toFixed(0)}MB). ` +
          `Run "GET /api/templates/${slug}" once to generate meta.json.`
        );
        const minimalMeta: TemplatePackMeta = {
          slug,
          name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          description: `Community workflow (${(stat.size / 1024 / 1024).toFixed(0)}MB)`,
          author: "Community",
          createdAt: stat.birthtime.toISOString(),
          updatedAt: stat.mtime.toISOString(),
          source: "local" as "local",
          sourceUrl: null,
          registryVersion: "1.0.0",
          category: "simple" as TemplateCategory,
          tags: [],
          techTags: [],
          nodeCount: 0,
          previewFrames: getPreviewFrames(slug),
        };
        // Write meta.json so we don't hit this path again
        writeMeta(slug, minimalMeta);
        templates.push(minimalMeta);
        continue;
      }

      // Small file — parse normally and generate meta.json for next time
      const content = fs.readFileSync(templatePath, "utf-8");
      const data = JSON.parse(content) as TemplatePack;
      const previewFrames = getPreviewFrames(slug);
      const newMeta = buildMeta(data, previewFrames);

      // Write meta.json sidecar
      writeMeta(slug, newMeta);

      templates.push(newMeta);
    } catch (error) {
      // Skip malformed templates
      console.error(`Failed to parse template ${slug}:`, error);
    }
  }

  // Sort by updatedAt descending
  templates.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return templates;
}

/**
 * Get full template data including nodes and edges.
 * Also writes/refreshes meta.json as a side effect.
 */
export function getTemplate(slug: string): TemplatePack | null {
  ensureTemplatesDir();

  const templatePath = path.join(TEMPLATES_DIR, slug, "template.json");
  if (!fs.existsSync(templatePath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(templatePath, "utf-8");
    const data = JSON.parse(content) as TemplatePack;

    // Ensure meta.json is up to date
    const previewFrames = getPreviewFrames(slug);
    const meta = buildMeta(data, previewFrames);
    writeMeta(slug, meta);

    return data;
  } catch (error) {
    console.error(`Failed to parse template ${slug}:`, error);
    return null;
  }
}

/**
 * Create a new template with optional preview images
 */
export function createTemplate(
  slug: string,
  data: TemplatePack,
  previewImages?: Array<{ filename: string; buffer: Buffer }>
): string {
  ensureTemplatesDir();

  const templateDir = path.join(TEMPLATES_DIR, slug);

  // Check if slug already exists
  if (fs.existsSync(templateDir)) {
    throw new Error(`Template with slug "${slug}" already exists`);
  }

  // Create template directory
  fs.mkdirSync(templateDir, { recursive: true });

  // Write template.json
  const templatePath = path.join(templateDir, "template.json");
  fs.writeFileSync(templatePath, JSON.stringify(data, null, 2), "utf-8");

  // Write preview images if provided
  if (previewImages && previewImages.length > 0) {
    const previewDir = path.join(templateDir, "preview");
    fs.mkdirSync(previewDir, { recursive: true });

    for (const { filename, buffer } of previewImages) {
      // Sanitize filename to prevent path traversal
      const safeName = path.basename(filename);
      const imagePath = path.join(previewDir, safeName);
      fs.writeFileSync(imagePath, buffer);
    }
  }

  // Write meta.json sidecar
  const previewFrames = getPreviewFrames(slug);
  const meta = buildMeta(data, previewFrames);
  writeMeta(slug, meta);

  return slug;
}

/**
 * Update an existing template with partial updates
 */
export function updateTemplate(
  slug: string,
  updates: Partial<TemplatePack>,
  previewImages?: Array<{ filename: string; buffer: Buffer }>
): boolean {
  ensureTemplatesDir();

  const templateDir = path.join(TEMPLATES_DIR, slug);
  const templatePath = path.join(templateDir, "template.json");

  if (!fs.existsSync(templatePath)) {
    return false;
  }

  try {
    // Read existing template
    const content = fs.readFileSync(templatePath, "utf-8");
    const existing = JSON.parse(content) as TemplatePack;

    // Merge updates (preserve nodes/edges if not in updates)
    const merged: TemplatePack = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
      // Always preserve nodes and edges unless explicitly provided
      nodes: updates.nodes ?? existing.nodes,
      edges: updates.edges ?? existing.edges,
    };

    // Write merged template
    fs.writeFileSync(templatePath, JSON.stringify(merged, null, 2), "utf-8");

    // Update preview images if provided
    if (previewImages && previewImages.length > 0) {
      const previewDir = path.join(templateDir, "preview");

      // Clear existing preview folder
      if (fs.existsSync(previewDir)) {
        fs.rmSync(previewDir, { recursive: true, force: true });
      }

      // Create new preview folder and write images
      fs.mkdirSync(previewDir, { recursive: true });
      for (const { filename, buffer } of previewImages) {
        const safeName = path.basename(filename);
        const imagePath = path.join(previewDir, safeName);
        fs.writeFileSync(imagePath, buffer);
      }
    }

    // Refresh meta.json
    const previewFrames = getPreviewFrames(slug);
    const meta = buildMeta(merged, previewFrames);
    writeMeta(slug, meta);

    return true;
  } catch (error) {
    console.error(`Failed to update template ${slug}:`, error);
    return false;
  }
}

/**
 * Delete a template and all its files
 */
export function deleteTemplate(slug: string): boolean {
  ensureTemplatesDir();

  const templateDir = path.join(TEMPLATES_DIR, slug);

  if (!fs.existsSync(templateDir)) {
    return false;
  }

  try {
    fs.rmSync(templateDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error(`Failed to delete template ${slug}:`, error);
    return false;
  }
}

/**
 * Get sorted list of preview image filenames in a template
 * Sorts naturally: 1.jpg, 1a.jpg, 1b.jpg, 2.jpg, 2a.jpg, etc.
 */
export function getPreviewFrames(slug: string): string[] {
  ensureTemplatesDir();

  const previewDir = path.join(TEMPLATES_DIR, slug, "preview");
  if (!fs.existsSync(previewDir)) {
    return [];
  }

  try {
    const files = fs.readdirSync(previewDir);

    // Filter valid image files and sort naturally
    const frames = files
      .filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
      .sort((a, b) => {
        // Natural sort: 1.jpg < 1a.jpg < 1b.jpg < 2.jpg
        const aMatch = a.match(/^(\d+)([a-z]?)\./i);
        const bMatch = b.match(/^(\d+)([a-z]?)\./i);

        if (!aMatch || !bMatch) {
          return a.localeCompare(b);
        }

        const aNum = parseInt(aMatch[1], 10);
        const bNum = parseInt(bMatch[1], 10);

        if (aNum !== bNum) {
          return aNum - bNum;
        }

        // Same number, sort by letter suffix
        const aLetter = aMatch[2] || "";
        const bLetter = bMatch[2] || "";
        return aLetter.localeCompare(bLetter);
      });

    return frames;
  } catch (error) {
    console.error(`Failed to read preview frames for ${slug}:`, error);
    return [];
  }
}

/**
 * Get absolute path to a preview image file
 * Returns null if not found or filename contains path traversal characters
 */
export function getPreviewImagePath(
  slug: string,
  filename: string
): string | null {
  ensureTemplatesDir();

  // Sanitize filename to prevent path traversal
  const safeName = path.basename(filename);
  if (safeName !== filename) {
    return null;
  }

  const imagePath = path.join(TEMPLATES_DIR, slug, "preview", safeName);

  if (!fs.existsSync(imagePath)) {
    return null;
  }

  return imagePath;
}

/**
 * Auto-detect technology tags from node types and model selections
 *
 * Rules:
 * - Node types: nanoBanana → "Nano Banana", llmGenerate → "LLM", etc.
 * - Model data:
 *   - nanoBanana with model containing "gemini" → "Gemini"
 *   - nanoBanana with selectedModel.provider === "fal" → "fal.ai"
 *   - nanoBanana with selectedModel.provider === "replicate" → "Replicate"
 *   - generateVideo with model containing "veo" → "Veo"
 * - Custom nodes → "Custom: {type}"
 */
export function detectTechTags(nodes: WorkflowNode[]): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tags = new Set<string>();

  for (const node of nodes) {
    const nodeType = node.type;
    const nodeData = node.data as any;

    // Map known node types to tech tags
    switch (nodeType) {
      case "nanoBanana": {
        tags.add("Nano Banana");
        // Check for model-specific tags
        if (nodeData.model && typeof nodeData.model === "string") {
          if (nodeData.model.toLowerCase().includes("gemini")) {
            tags.add("Gemini");
          }
        }
        if (nodeData.selectedModel?.provider) {
          if (nodeData.selectedModel.provider === "fal") {
            tags.add("fal.ai");
          } else if (nodeData.selectedModel.provider === "replicate") {
            tags.add("Replicate");
          }
        }
        break;
      }
      case "llmGenerate": {
        tags.add("LLM");
        break;
      }
      case "generateVideo": {
        tags.add("Video Gen");
        if (nodeData.selectedModel?.modelId) {
          if (nodeData.selectedModel.modelId.toLowerCase().includes("veo")) {
            tags.add("Veo");
          }
        }
        break;
      }
      case "generate3d": {
        tags.add("3D Gen");
        break;
      }
      case "generateAudio": {
        tags.add("Audio Gen");
        break;
      }
      case "annotation": {
        tags.add("Annotation");
        break;
      }
      case "splitGrid": {
        tags.add("Split Grid");
        break;
      }
      case "promptConstructor": {
        tags.add("Prompt Constructor");
        break;
      }
      case "array": {
        tags.add("Array");
        break;
      }
      default: {
        // Check if it's a custom node (not in the standard node types)
        const standardTypes = [
          "imageInput",
          "audioInput",
          "annotation",
          "prompt",
          "array",
          "promptConstructor",
          "nanoBanana",
          "generateVideo",
          "generateAudio",
          "llmGenerate",
          "splitGrid",
          "output",
          "outputGallery",
          "imageCompare",
          "videoStitch",
          "easeCurve",
          "videoTrim",
          "videoFrameGrab",
          "router",
          "switch",
          "conditionalSwitch",
          "generate3d",
          "glbViewer",
          "naSketchToPhoto",
          "naStylingDetail",
          "naRecolor",
        ];
        if (!standardTypes.includes(nodeType)) {
          tags.add(`Custom: ${nodeType}`);
        }
      }
    }
  }

  return Array.from(tags).sort();
}

/**
 * Install a template from a remote source
 * Same as createTemplate but sets source metadata appropriately
 */
export function installRemoteTemplate(
  slug: string,
  templateData: TemplatePack,
  previewImages: Array<{ filename: string; buffer: Buffer }>,
  sourceUrl: string,
  registryVersion: string
): string {
  const data: TemplatePack = {
    ...templateData,
    slug,
    source: "remote",
    sourceUrl,
    registryVersion,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return createTemplate(slug, data, previewImages);
}
