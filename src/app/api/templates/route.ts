import { NextRequest, NextResponse } from "next/server";
import type {
  TemplatePack,
  SaveTemplateInput,
} from "@/types/templates";
import type { WorkflowNode } from "@/types/nodes";
import type { WorkflowEdge, NodeGroup } from "@/types/workflow";
import {
  listTemplates,
  createTemplate,
  slugify,
  detectTechTags,
} from "@/lib/templateStorage";

/**
 * GET /api/templates
 * List all template packs
 */
export async function GET(request: NextRequest) {
  try {
    const templates = listTemplates();
    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error("Error listing templates:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Create a new template pack
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      category,
      tags,
      author,
      nodes,
      edges,
      edgeStyle = "default",
      groups,
      previewImages,
    } = body as SaveTemplateInput & {
      nodes: WorkflowNode[];
      edges: WorkflowEdge[];
      edgeStyle?: string;
      groups?: NodeGroup[];
      previewImages?: Array<{ filename: string; data: string }>;
    };

    // Validate required fields
    if (
      !name ||
      !description ||
      !category ||
      !author ||
      !nodes ||
      !edges ||
      !Array.isArray(tags)
    ) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Generate slug
    const slug = slugify(name);

    // Detect tech tags
    const techTags = detectTechTags(nodes);

    // Decode preview images from base64
    let decodedImages: Array<{ filename: string; buffer: Buffer }> | undefined;
    if (previewImages && previewImages.length > 0) {
      decodedImages = previewImages.map((img) => {
        // Extract base64 data from data URL if needed
        let base64Data = img.data;
        if (base64Data.startsWith("data:")) {
          base64Data = base64Data.split(",")[1];
        }
        return {
          filename: sanitizeFilename(img.filename),
          buffer: Buffer.from(base64Data, "base64"),
        };
      });
    }

    // Build TemplatePack object
    const pack: TemplatePack = {
      version: 1,
      slug,
      name,
      description,
      author,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: "local",
      sourceUrl: null,
      registryVersion: null,
      category,
      tags,
      techTags,
      nodeCount: nodes.length,
      edgeStyle,
      nodes,
      edges,
      groups,
    };

    // Create template
    createTemplate(slug, pack, decodedImages);

    return NextResponse.json({
      success: true,
      slug,
    });
  } catch (error) {
    console.error("Error creating template:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create template",
      },
      { status: 500 }
    );
  }
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}
