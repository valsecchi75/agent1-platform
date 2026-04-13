import { writeFileSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { getNextFilename, ensureStorageDirs } from "@/lib/storage/fileNaming";

/**
 * POST /api/input-image-save
 *
 * Copies an uploaded image (base64 data URL) to storage/input/ with
 * progressive naming (agent1_XXXX.ext). Returns the storage path so
 * the ImageInputNode can store it for cross-session persistence.
 *
 * Body: { data: string (base64 data URL) }
 *
 * Returns: { success: true, storagePath: string, filename: string }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { data } = body;

    if (!data) {
      return NextResponse.json(
        { success: false, error: "Missing data" },
        { status: 400 }
      );
    }

    ensureStorageDirs();

    // Detect extension from data URL
    let ext = "png";
    if (data.startsWith("data:")) {
      const match = data.match(/^data:image\/(\w+);base64,/);
      if (match) {
        ext = match[1] === "jpeg" ? "jpg" : match[1];
      }
    }

    // Get next progressive filename in storage/input/
    const { filename, fullPath } = getNextFilename("input", ext);

    // Decode and write
    const base64Data = data.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    writeFileSync(fullPath, buffer);

    return NextResponse.json({
      success: true,
      storagePath: fullPath,
      filename,
    });
  } catch (error) {
    console.error("[input-image-save] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save input image" },
      { status: 500 }
    );
  }
}
