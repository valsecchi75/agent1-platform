import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

/**
 * MIME type map for binary and text assets served from custom_nodes configs.
 */
const MIME_TYPES: Record<string, string> = {
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/plain",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

/** Extensions that should be read as binary (not utf-8 text) */
const BINARY_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico",
  ".mp3", ".wav", ".mp4", ".webm",
]);

/**
 * Legacy pack-ID → actual directory-name aliases.
 * Older components and saved workflows may reference the original ComfyUI-style
 * directory names; this map resolves them to the current directory names so both
 * old and new URLs work without breaking existing workflows.
 */
const PACK_ALIASES: Record<string, string> = {
  comfyui_morpheus_model_management: "morpheus-model-management",
  comfyui_neural_atelier: "agent1_neural_atelier",
};

/**
 * GET /api/custom-nodes/[packId]/configs/[...path]
 * Serves config files AND assets (images, audio, etc.) from a custom node pack.
 *
 * Examples:
 *   /api/custom-nodes/morpheus-model-management/configs/morpheus_model_management/catalog.json
 *   /api/custom-nodes/morpheus-model-management/configs/morpheus_model_management/images/model_01.png
 *   /api/custom-nodes/agent1_neural_atelier/configs/NA_Recolor/colors.json
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ packId: string; path: string[] }> }
) {
  const { packId: rawPackId, path: pathSegments } = await params;

  if (rawPackId.includes("..") || rawPackId.includes("/")) {
    return NextResponse.json({ error: "Invalid pack ID" }, { status: 400 });
  }

  // Resolve legacy aliases for backward compatibility
  const packId = PACK_ALIASES[rawPackId] || rawPackId;

  const configPath = path.join(
    process.cwd(),
    "custom_nodes",
    packId,
    "configs",
    ...pathSegments
  );

  // Security: ensure resolved path is within custom_nodes
  const customNodesRoot = path.join(process.cwd(), "custom_nodes");
  if (!configPath.startsWith(customNodesRoot)) {
    return NextResponse.json({ error: "Path traversal detected" }, { status: 403 });
  }

  // Directory request → list JSON files
  if (fs.existsSync(configPath) && fs.statSync(configPath).isDirectory()) {
    const files = fs.readdirSync(configPath)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""))
      .sort();
    return NextResponse.json({ files });
  }

  // File request → try exact path, then with .json extension
  let filePath = configPath;
  if (!fs.existsSync(filePath) && !filePath.endsWith(".json")) {
    filePath = filePath + ".json";
  }

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Config not found" }, { status: 404 });
  }

  try {
    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || "application/octet-stream";

    // Binary files (images, audio, video) → serve as raw buffer with proper content-type
    if (BINARY_EXTENSIONS.has(ext)) {
      const buffer = fs.readFileSync(filePath);
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": String(buffer.length),
          "Cache-Control": "public, max-age=86400, immutable",
        },
      });
    }

    // Text-based files
    const content = fs.readFileSync(filePath, "utf-8");

    if (ext === ".json") {
      const parsed = JSON.parse(content);
      return NextResponse.json(parsed);
    }

    // Non-JSON text files (e.g. .txt prompt profiles)
    return new NextResponse(content, {
      headers: { "Content-Type": mimeType },
    });
  } catch (error) {
    console.error(`[custom-nodes] Failed to read ${filePath}:`, error);
    return NextResponse.json({ error: "Failed to read config" }, { status: 500 });
  }
}
