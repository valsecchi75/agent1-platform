import { readdirSync, statSync, existsSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

interface OutputFile {
  filename: string;
  size: number;
  type: "image" | "video" | "audio";
  timestamp: number;
  path: string;
}

/**
 * GET /api/output-browser
 * Lists all files in storage/output/images/, storage/output/videos/, storage/output/audio/
 *
 * Query params:
 * ?type=images|videos|audio|all
 *
 * Returns:
 * {
 *   files: [
 *     { filename: "agent1_0001.jpg", size: 12345, type: "image", timestamp: 1234567890, path: "storage/output/images/agent1_0001.jpg" },
 *     ...
 *   ]
 * }
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("type") || "all";

    if (!["images", "videos", "audio", "all"].includes(filterType)) {
      return NextResponse.json(
        { files: [], error: "Invalid type parameter. Use: images, videos, audio, or all" },
        { status: 400 }
      );
    }

    const outputBaseDir = path.resolve(process.cwd(), "storage", "output");
    const files: OutputFile[] = [];

    // Helper function to scan a directory
    const scanDir = (dirPath: string, fileType: "image" | "video" | "audio") => {
      if (!existsSync(dirPath)) {
        return;
      }

      try {
        const entries = readdirSync(dirPath);
        for (const entry of entries) {
          if (entry === ".gitkeep") continue; // Skip .gitkeep marker

          const fullPath = path.join(dirPath, entry);
          const stat = statSync(fullPath);

          if (stat.isFile()) {
            files.push({
              filename: entry,
              size: stat.size,
              type: fileType,
              timestamp: Math.floor(stat.mtimeMs / 1000),
              path: `storage/output/${fileType === "image" ? "images" : fileType === "video" ? "videos" : "audio"}/${entry}`,
            });
          }
        }
      } catch (error) {
        console.warn(`[output-browser] Failed to scan ${dirPath}:`, error);
      }
    };

    // Scan requested directories
    if (filterType === "images" || filterType === "all") {
      scanDir(path.join(outputBaseDir, "images"), "image");
    }
    if (filterType === "videos" || filterType === "all") {
      scanDir(path.join(outputBaseDir, "videos"), "video");
    }
    if (filterType === "audio" || filterType === "all") {
      scanDir(path.join(outputBaseDir, "audio"), "audio");
    }

    // Sort by timestamp (newest first)
    files.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ files });
  } catch (error) {
    console.error("[output-browser GET] Error:", error);
    return NextResponse.json(
      { files: [], error: "Failed to list output files" },
      { status: 500 }
    );
  }
}
