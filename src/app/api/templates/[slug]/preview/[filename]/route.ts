import { NextRequest, NextResponse } from "next/server";
import { extname } from "path";
import { getPreviewImagePath } from "@/lib/templateStorage";
import * as fs from "fs";

interface RouteParams {
  params: Promise<{ slug: string; filename: string }>;
}

/**
 * Get MIME type from file extension
 */
function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Sanitize filename to prevent path traversal
 */
function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "");
}

/**
 * Sanitize slug to prevent path traversal
 */
function sanitizeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/g, "");
}

/**
 * GET /api/templates/{slug}/preview/{filename}
 * Serve preview images
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { slug, filename } = await params;
    const safeSlug = sanitizeSlug(slug);
    const safeFilename = sanitizeFilename(filename);

    if (!safeSlug || !safeFilename) {
      return NextResponse.json(
        { success: false, error: "Invalid slug or filename" },
        { status: 400 }
      );
    }

    // Get the path to the preview image
    const imagePath = getPreviewImagePath(safeSlug, safeFilename);

    if (!imagePath) {
      return NextResponse.json(
        { success: false, error: "Preview image not found" },
        { status: 404 }
      );
    }

    // Read the file
    const fileBuffer = fs.readFileSync(imagePath);

    // Determine MIME type
    const mimeType = getMimeType(safeFilename);

    // Return image with cache control
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
        "Content-Length": fileBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error serving preview image:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to serve preview image",
      },
      { status: 500 }
    );
  }
}
