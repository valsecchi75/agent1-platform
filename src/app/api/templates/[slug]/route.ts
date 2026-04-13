import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import type { TemplatePack } from "@/types/templates";
import type { WorkflowNode } from "@/types/nodes";
import {
  getTemplate,
  updateTemplate,
  deleteTemplate,
  detectTechTags,
} from "@/lib/templateStorage";

// Allow up to 5 minutes for loading large templates (200MB+)
export const maxDuration = 300;

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * Sanitize slug to prevent path traversal
 */
function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/g, "");
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * GET /api/templates/{slug}
 * Load a specific template pack.
 *
 * For large templates (>50MB) we stream the file directly from disk
 * instead of parsing into JSON and re-serializing, to avoid OOM.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const safeSlug = sanitizeSlug(slug);

    if (!safeSlug) {
      return NextResponse.json(
        { success: false, error: "Invalid slug" },
        { status: 400 }
      );
    }

    // Resolve the template file path
    const TEMPLATES_DIR = path.join(process.cwd(), "storage", "templates");
    const templatePath = path.join(TEMPLATES_DIR, safeSlug, "template.json");

    if (!fs.existsSync(templatePath)) {
      return NextResponse.json(
        { success: false, error: `Template not found: ${slug}` },
        { status: 404 }
      );
    }

    const stat = fs.statSync(templatePath);
    const LARGE_FILE_THRESHOLD = 50 * 1024 * 1024; // 50 MB

    if (stat.size > LARGE_FILE_THRESHOLD) {
      // Large file: stream directly from disk wrapped in { success: true, template: ... }
      console.log(
        `[Templates] Streaming large template ${safeSlug} (${(stat.size / 1024 / 1024).toFixed(0)}MB)`
      );

      const fileStream = fs.createReadStream(templatePath, { encoding: "utf-8" });

      const stream = new ReadableStream({
        start(controller) {
          // Prepend the wrapper
          controller.enqueue(new TextEncoder().encode('{"success":true,"template":'));

          fileStream.on("data", (chunk: Buffer | string) => {
            controller.enqueue(new TextEncoder().encode(chunk.toString()));
          });

          fileStream.on("end", () => {
            // Close the wrapper
            controller.enqueue(new TextEncoder().encode("}"));
            controller.close();
          });

          fileStream.on("error", (err) => {
            console.error(`[Templates] Stream error for ${safeSlug}:`, err);
            controller.error(err);
          });
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "application/json",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    // Small file: use the standard getTemplate (also refreshes meta.json)
    const template = getTemplate(safeSlug);

    if (!template) {
      return NextResponse.json(
        { success: false, error: `Template not found: ${slug}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error("Error loading template:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load template" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/templates/{slug}
 * Update a template pack
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const safeSlug = sanitizeSlug(slug);

    if (!safeSlug) {
      return NextResponse.json(
        { success: false, error: "Invalid slug" },
        { status: 400 }
      );
    }

    // Check if template exists
    const existing = getTemplate(safeSlug);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Template not found: ${slug}` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      tags,
      nodes,
      edges,
      previewImages,
    } = body;

    // Build updates object
    const updates: Partial<TemplatePack> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) updates.category = category;
    if (tags !== undefined) updates.tags = tags;
    if (nodes !== undefined) {
      updates.nodes = nodes;
      updates.nodeCount = nodes.length;
      // Re-detect tech tags if nodes change
      updates.techTags = detectTechTags(nodes);
    }
    if (edges !== undefined) updates.edges = edges;

    // Decode preview images if provided
    let decodedImages: Array<{ filename: string; buffer: Buffer }> | undefined;
    if (previewImages && previewImages.length > 0) {
      decodedImages = previewImages.map((img: { filename: string; data: string }) => {
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

    // Update template
    updateTemplate(safeSlug, updates, decodedImages);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error updating template:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update template",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/{slug}
 * Delete a template pack
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug } = await params;
    const safeSlug = sanitizeSlug(slug);

    if (!safeSlug) {
      return NextResponse.json(
        { success: false, error: "Invalid slug" },
        { status: 400 }
      );
    }

    // Check if template exists
    const existing = getTemplate(safeSlug);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Template not found: ${slug}` },
        { status: 404 }
      );
    }

    // Delete template
    deleteTemplate(safeSlug);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Error deleting template:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete template",
      },
      { status: 500 }
    );
  }
}
