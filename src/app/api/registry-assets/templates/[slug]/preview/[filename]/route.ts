import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

/**
 * GET /api/registry-assets/templates/[slug]/preview/[filename]
 * Serve preview images from agent1-registry/templates/[slug]/preview/[filename]
 * Used when the remote GitHub raw URLs are not accessible (local dev fallback).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; filename: string }> }
) {
  const { slug, filename } = await params;

  // Sanitize inputs to prevent path traversal
  const safeSlug = slug.replace(/[^a-zA-Z0-9_-]/g, "");
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");

  const imagePath = path.resolve(
    process.cwd(),
    "..",
    "agent1-registry",
    "templates",
    safeSlug,
    "preview",
    safeFilename
  );

  if (!fs.existsSync(imagePath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(safeFilename).toLowerCase();

  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
