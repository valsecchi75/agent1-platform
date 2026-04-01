#!/usr/bin/env node

/**
 * Migration Script: Move templates from public/workflows/ to storage/templates/
 *
 * This script:
 * 1. Reads all .json files from public/workflows/
 * 2. Transforms each to the new TemplatePack format
 * 3. Copies images to storage/templates/{slug}/preview/
 * 4. Generates slug from filename (lowercase, dashes)
 * 5. Detects tech tags based on node types
 */

import fs from "fs";
import path from "path";

// TECH_TAG_MAP — same as in src/types/templates.ts
const TECH_TAG_MAP: Record<string, string> = {
  nanoBanana: "Nano Banana",
  llmGenerate: "LLM",
  generateVideo: "Video Gen",
  generate3d: "3D Gen",
  generateAudio: "Audio Gen",
  annotation: "Annotation",
  splitGrid: "Split Grid",
  promptConstructor: "Prompt Constructor",
  array: "Array",
  prompt: "Prompt",
  imageInput: "Image Input",
  output: "Output",
};

interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  style?: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

interface WorkflowFile {
  version?: number;
  name?: string;
  description?: string;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
  category?: string;
  tags?: string[];
  edgeStyle?: string;
  nodes?: WorkflowNode[];
  edges?: WorkflowEdge[];
  groups?: unknown[];
  thumbnailUrl?: string;
}

interface TemplatePack {
  version: 1;
  slug: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  source: "local" | "remote";
  sourceUrl: string | null;
  registryVersion: string | null;
  category: string;
  tags: string[];
  techTags: string[];
  nodeCount: number;
  edgeStyle: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  groups?: unknown[];
}

/**
 * Generate a slug from filename (e.g., "Product Shot.json" → "product-shot")
 */
function generateSlug(filename: string): string {
  return filename
    .replace(/\.json$/i, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * Detect tech tags from node types in the workflow
 */
function detectTechTags(nodes: WorkflowNode[]): string[] {
  const techTags = new Set<string>();

  for (const node of nodes) {
    const nodeType = node.type;
    if (TECH_TAG_MAP[nodeType]) {
      techTags.add(TECH_TAG_MAP[nodeType]);
    }
  }

  return Array.from(techTags).sort();
}

/**
 * Find matching image files for a template
 * Looks in: public/workflows/images/{name}.(jpg|png)
 */
function findImages(
  workflowsDir: string,
  filename: string
): { primary: string | null; secondary: string | null } {
  const imagesDir = path.join(workflowsDir, "images");
  const basename = filename.replace(/\.json$/i, "");

  const jpgPath = path.join(imagesDir, `${basename}.jpg`);
  const pngPath = path.join(imagesDir, `${basename}.png`);

  const primary = fs.existsSync(jpgPath) ? jpgPath : null;
  const secondary = fs.existsSync(pngPath) ? pngPath : null;

  return { primary, secondary };
}

/**
 * Copy image file and return the destination path
 */
function copyImage(
  srcPath: string,
  destPath: string,
  filename: string
): boolean {
  try {
    const destDir = path.dirname(destPath);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }
    fs.copyFileSync(srcPath, destPath);
    return true;
  } catch (err) {
    console.error(`  ⚠️  Failed to copy image ${filename}:`, err);
    return false;
  }
}

/**
 * Main migration function
 */
function migrate() {
  const appDir = path.resolve(__dirname, "..");
  const workflowsDir = path.join(appDir, "public", "workflows");
  const storagePath = path.join(appDir, "storage", "templates");

  console.log("\n🚀 Starting template migration...\n");
  console.log(`📂 Source: ${workflowsDir}`);
  console.log(`📂 Destination: ${storagePath}\n`);

  // Get all .json files
  const files = fs
    .readdirSync(workflowsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    console.log("ℹ️  No .json files found in public/workflows/");
    return;
  }

  console.log(`📋 Found ${files.length} workflow files\n`);

  let migratedCount = 0;
  let skippedCount = 0;
  const results: Array<{
    filename: string;
    slug: string;
    status: "migrated" | "skipped" | "error";
    reason?: string;
  }> = [];

  for (const filename of files) {
    const slug = generateSlug(filename);
    const templateDir = path.join(storagePath, slug);
    const previewDir = path.join(templateDir, "preview");

    // Skip if template already exists
    if (fs.existsSync(templateDir)) {
      console.log(
        `⏭️  Skipping ${filename} (template ${slug} already exists)`
      );
      results.push({ filename, slug, status: "skipped", reason: "exists" });
      skippedCount++;
      continue;
    }

    try {
      // Read workflow file
      const workflowPath = path.join(workflowsDir, filename);
      const workflowJson = JSON.parse(
        fs.readFileSync(workflowPath, "utf-8")
      ) as WorkflowFile;

      // Build template pack
      const now = new Date().toISOString();
      const template: TemplatePack = {
        version: 1,
        slug,
        name: workflowJson.name || slug,
        description: workflowJson.description || "",
        author: workflowJson.author || "AGENT 1 Preset",
        createdAt: workflowJson.createdAt || now,
        updatedAt: now,
        source: "local",
        sourceUrl: null,
        registryVersion: null,
        category: workflowJson.category || "simple",
        tags: workflowJson.tags || [],
        techTags: detectTechTags(workflowJson.nodes || []),
        nodeCount: (workflowJson.nodes || []).length,
        edgeStyle: workflowJson.edgeStyle || "curved",
        nodes: workflowJson.nodes || [],
        edges: workflowJson.edges || [],
      };

      // Include groups if present
      if (workflowJson.groups) {
        template.groups = workflowJson.groups;
      }

      // Create directories
      if (!fs.existsSync(templateDir)) {
        fs.mkdirSync(templateDir, { recursive: true });
      }
      if (!fs.existsSync(previewDir)) {
        fs.mkdirSync(previewDir, { recursive: true });
      }

      // Write template.json
      const templatePath = path.join(templateDir, "template.json");
      fs.writeFileSync(templatePath, JSON.stringify(template, null, 2));

      // Copy images
      const { primary, secondary } = findImages(workflowsDir, filename);
      let imageCopyCount = 0;

      if (primary) {
        const destPath = path.join(previewDir, "1.jpg");
        if (copyImage(primary, destPath, filename)) {
          imageCopyCount++;
          console.log(`  ✅ Copied primary image (1.jpg)`);
        }
      }

      if (secondary) {
        const destPath = path.join(previewDir, "1a.png");
        if (copyImage(secondary, destPath, filename)) {
          imageCopyCount++;
          console.log(`  ✅ Copied secondary image (1a.png)`);
        }
      }

      console.log(
        `✅ Migrated ${filename} → ${slug} (${template.nodeCount} nodes, ${imageCopyCount} images, tags: ${template.techTags.join(", ") || "none"})`
      );

      results.push({ filename, slug, status: "migrated" });
      migratedCount++;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error migrating ${filename}:`, errorMsg);
      results.push({
        filename,
        slug,
        status: "error",
        reason: errorMsg,
      });
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Migration Summary");
  console.log("=".repeat(60));
  console.log(`✅ Migrated: ${migratedCount}/${files.length}`);
  console.log(`⏭️  Skipped: ${skippedCount}/${files.length}`);
  console.log(`❌ Errors: ${files.length - migratedCount - skippedCount}/${files.length}`);
  console.log("=".repeat(60));

  if (migratedCount > 0) {
    console.log("\n📦 Migrated templates:");
    results
      .filter((r) => r.status === "migrated")
      .forEach((r) => {
        console.log(`  - ${r.slug}`);
      });
  }

  console.log(
    "\n💡 Templates are now in: storage/templates/{slug}/template.json"
  );
  console.log("💡 Preview images are in: storage/templates/{slug}/preview/\n");
}

// Run migration
migrate();
