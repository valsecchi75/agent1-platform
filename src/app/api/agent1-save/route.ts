import { writeFileSync } from "fs";
import { NextRequest, NextResponse } from "next/server";
import { getNextFilename, ensureStorageDirs } from "@/lib/storage/fileNaming";
import { isDbAvailable } from "@/lib/db-guard";
import { insertGeneration } from "@/lib/db";
import { PRICING } from "@/utils/costCalculator";
import { getRequestUser, AuthError } from "@/lib/auth/getRequestUser";

/**
 * POST /api/agent1-save
 *
 * Saves generated content (image/video/audio) or uploaded input with
 * progressive naming: agent1_0001.jpg, agent1_0002.png, etc.
 *
 * Body:
 * {
 *   type: "image" | "video" | "audio" | "input",
 *   data: string,         // base64 data URL or raw base64
 *   extension?: string,   // "jpg", "png", "mp4", "wav" — auto-detected from data URL if not provided
 * }
 *
 * Returns:
 * {
 *   success: true,
 *   filename: "agent1_0042.jpg",
 *   publicUrl: "/api/output-browser?path=images/agent1_0042.jpg",
 *   fullPath: "C:\\...\\app\\output\\images\\agent1_0042.jpg"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const body = await req.json();
    const {
      type,
      data,
      extension: extOverride,
      model,
      provider,
      prompt,
      aspectRatio,
      resolution,
      costUsd: requestCostUsd,
      workflowId: reqWorkflowId,
      workflowName: reqWorkflowName,
    } = body;

    if (!type || !data) {
      return NextResponse.json(
        { success: false, error: "Missing type or data" },
        { status: 400 }
      );
    }

    if (!["image", "video", "audio", "input"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "Invalid type. Use: image, video, audio, input" },
        { status: 400 }
      );
    }

    // Ensure directories exist
    ensureStorageDirs();

    // Parse data URL or raw base64
    let base64Data: string;
    let detectedExt: string;

    if (data.startsWith("data:")) {
      // data:image/jpeg;base64,/9j/4AAQ...
      const match = data.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return NextResponse.json(
          { success: false, error: "Invalid data URL format" },
          { status: 400 }
        );
      }
      const mimeType = match[1];
      base64Data = match[2];

      // Detect extension from MIME
      const mimeMap: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "video/mp4": "mp4",
        "video/webm": "webm",
        "video/quicktime": "mov",
        "audio/mpeg": "mp3",
        "audio/wav": "wav",
        "audio/webm": "webm",
      };
      detectedExt = mimeMap[mimeType] || (type === "video" ? "mp4" : type === "audio" ? "mp3" : "jpg");
    } else {
      // Raw base64
      base64Data = data;
      detectedExt = type === "video" ? "mp4" : type === "audio" ? "mp3" : "jpg";
    }

    const ext = extOverride || detectedExt;

    // Get next filename with user scope
    const { filename, fullPath, publicUrl } = getNextFilename(type, ext, user.userId);

    // Write file
    const buffer = Buffer.from(base64Data, "base64");
    writeFileSync(fullPath, buffer);

    // Insert DB record for gallery (only for image/video types)
    if (isDbAvailable() && (type === "image" || type === "video")) {
      const relPath = type === "image" ? `users/${user.userId}/output/images/${filename}`
        : type === "video" ? `users/${user.userId}/output/videos/${filename}`
        : `users/${user.userId}/output/audio/${filename}`;

      const mimeMap: Record<string, string> = {
        jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
        webp: "image/webp", gif: "image/gif",
        mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
      };
      const mimeType = mimeMap[ext] || (type === "video" ? "video/mp4" : "image/jpeg");

      // Use cost from request if provided (executor already calculated it),
      // otherwise calculate from model + resolution for Gemini models
      let costUsd = typeof requestCostUsd === "number" ? requestCostUsd : 0;
      if (costUsd === 0 && (provider === "gemini" || !provider)) {
        const pricingKey = model as keyof typeof PRICING;
        if (PRICING[pricingKey]) {
          const res = (resolution || "1K") as keyof (typeof PRICING)[typeof pricingKey];
          costUsd = PRICING[pricingKey][res] ?? PRICING[pricingKey]["1K"] ?? 0;
        }
      }

      // Note: "Last Workflow" feature now uses session files on disk
      // (storage/workflows/__session/last_generation.json) saved by the executor.
      // No need to store workflow JSON in the generation DB record.

      insertGeneration({
        userId: user.userId,
        filePath: relPath,
        fileType: type as "image" | "video",
        mimeType,
        prompt: prompt || "",
        model: model || "unknown",
        provider: provider || "unknown",
        aspectRatio: aspectRatio || "1:1",
        resolution: resolution || "unknown",
        costUsd,
        workflowId: reqWorkflowId || undefined,
        workflowName: reqWorkflowName || undefined,
      }).catch((err: unknown) => {
        console.warn("[agent1-save] DB insert failed:", err);
      });
    }

    return NextResponse.json({
      success: true,
      filename,
      publicUrl,
      fullPath,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Error saving file:", err);
    return NextResponse.json(
      { success: false, error: "Failed to save file" },
      { status: 500 }
    );
  }
}
