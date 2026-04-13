import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/input-images
 * Lists all images in storage/input/ with filenames and sizes.
 *
 * Returns:
 * {
 *   images: [
 *     { filename: "myimage.jpg", size: 12345, path: "storage/input/myimage.jpg" },
 *     ...
 *   ]
 * }
 */
export async function GET() {
  try {
    const inputDir = path.resolve(process.cwd(), "storage", "input");

    if (!existsSync(inputDir)) {
      return NextResponse.json({ images: [] });
    }

    const files = readdirSync(inputDir);
    const images = files
      .filter((file) => {
        const stat = statSync(path.join(inputDir, file));
        return stat.isFile();
      })
      .map((file) => {
        const fullPath = path.join(inputDir, file);
        const stat = statSync(fullPath);
        return {
          filename: file,
          size: stat.size,
          path: `storage/input/${file}`,
        };
      });

    return NextResponse.json({ images });
  } catch (error) {
    console.error("[input-images GET] Error:", error);
    return NextResponse.json(
      { images: [], error: "Failed to list input images" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/input-images
 * Accepts base64 image data + filename, saves to storage/input/.
 * If filename exists, appends counter suffix.
 *
 * Body:
 * {
 *   filename: "myimage.jpg",   // required
 *   data: "base64string"        // required (no data: prefix needed)
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   filename: "myimage.jpg",
 *   size: 12345
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { filename, data } = body;

    if (!filename || !data) {
      return NextResponse.json(
        { success: false, error: "Missing filename or data" },
        { status: 400 }
      );
    }

    const inputDir = path.resolve(process.cwd(), "storage", "input");

    // Ensure input directory exists
    if (!existsSync(inputDir)) {
      mkdirSync(inputDir, { recursive: true });
    }

    // Handle deduplication
    let finalFilename = filename;
    let counter = 1;
    const baseName = filename.replace(/\.[^.]+$/, ""); // Remove extension
    const ext = filename.match(/\.[^.]+$/)?.[0] || ""; // Get extension with dot

    while (existsSync(path.join(inputDir, finalFilename))) {
      finalFilename = `${baseName}_${counter}${ext}`;
      counter++;
    }

    // Parse base64 (handle data URL or raw base64)
    let base64Data: string;
    if (data.startsWith("data:")) {
      const match = data.match(/^data:[^;]+;base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "Invalid data URL format" },
          { status: 400 }
        );
      }
      base64Data = match[1];
    } else {
      base64Data = data;
    }

    // Write file
    const fullPath = path.join(inputDir, finalFilename);
    const buffer = Buffer.from(base64Data, "base64");
    writeFileSync(fullPath, buffer);

    const stat = statSync(fullPath);

    return NextResponse.json({
      success: true,
      filename: finalFilename,
      size: stat.size,
    });
  } catch (error) {
    console.error("[input-images POST] Error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to save input image" },
      { status: 500 }
    );
  }
}
