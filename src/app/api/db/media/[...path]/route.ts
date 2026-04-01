import * as fs from "fs/promises";
import * as path from "path";
import { NextRequest, NextResponse } from "next/server";

// MIME type mapping for common media files
const MIME_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
};

// Supported file extensions
const SUPPORTED_EXTENSIONS = new Set(Object.keys(MIME_TYPES));

// GET: Serve media files from data directory
// Path: /api/db/media/[...path]
// Security: prevents directory traversal, resolves to {cwd}/data/{relativePath}
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Path is required",
        },
        { status: 400 }
      );
    }

    // Join path segments
    const relativePath = pathSegments.join("/");

    // Security: prevent directory traversal
    if (relativePath.includes("..") || relativePath.startsWith("/")) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid path",
        },
        { status: 403 }
      );
    }

    // Resolve full file path
    const dataDir = path.join(process.cwd(), "storage");
    const fullPath = path.resolve(path.join(dataDir, relativePath));

    // Ensure resolved path is still within storage directory
    if (!fullPath.startsWith(dataDir)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid path",
        },
        { status: 403 }
      );
    }

    // Security: resolve symlinks to prevent symlink-based traversal
    let resolvedPath = fullPath;
    try {
      resolvedPath = await fs.realpath(fullPath);
      if (!resolvedPath.startsWith(dataDir)) {
        return NextResponse.json(
          { success: false, error: "Invalid path" },
          { status: 403 }
        );
      }
    } catch {
      // realpath fails if file doesn't exist — handled below
    }

    // Check if file exists
    try {
      const stats = await fs.stat(resolvedPath);
      if (!stats.isFile()) {
        return NextResponse.json(
          {
            success: false,
            error: "Not a file",
          },
          { status: 404 }
        );
      }
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "File not found",
        },
        { status: 404 }
      );
    }

    // Get file extension
    const ext = path.extname(fullPath).toLowerCase().slice(1);

    // Check if extension is supported
    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported file type",
        },
        { status: 415 }
      );
    }

    // Read file (use resolved path to follow symlinks safely)
    const fileBuffer = await fs.readFile(resolvedPath);

    // Get MIME type
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    // Create response with file content
    const response = new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable", // 1 year for immutable assets
        "Content-Length": fileBuffer.length.toString(),
      },
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to serve media file",
      },
      { status: 500 }
    );
  }
}
