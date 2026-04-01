import { NextRequest, NextResponse } from "next/server";
import {
  getGenerations,
  insertGeneration,
} from "@/lib/db";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import type {
  GenerationFilters,
  InsertGenerationInput,
} from "@/lib/db-types";

// GET: List generations with optional filters
// Query params: provider, model, fileType, isLoved, dateFrom, dateTo, limit, offset
export async function GET(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters into GenerationFilters
    const filters: GenerationFilters = {};

    if (searchParams.has("provider")) {
      filters.provider = searchParams.get("provider") || undefined;
    }

    if (searchParams.has("model")) {
      filters.model = searchParams.get("model") || undefined;
    }

    if (searchParams.has("fileType")) {
      const fileType = searchParams.get("fileType");
      if (fileType === "image" || fileType === "video") {
        filters.fileType = fileType;
      }
    }

    if (searchParams.has("isLoved")) {
      filters.isLoved = searchParams.get("isLoved") === "true";
    }

    if (searchParams.has("dateFrom")) {
      filters.dateFrom = searchParams.get("dateFrom") || undefined;
    }

    if (searchParams.has("dateTo")) {
      filters.dateTo = searchParams.get("dateTo") || undefined;
    }

    if (searchParams.has("limit")) {
      const limit = parseInt(searchParams.get("limit") || "50", 10);
      if (!isNaN(limit) && limit > 0) {
        filters.limit = limit;
      }
    }

    if (searchParams.has("offset")) {
      const offset = parseInt(searchParams.get("offset") || "0", 10);
      if (!isNaN(offset) && offset >= 0) {
        filters.offset = offset;
      }
    }

    // Fetch generations
    const result = getGenerations(filters);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch generations",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new generation record
export async function POST(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const body = await request.json();

    // Validate required fields
    const {
      userId,
      filePath,
      fileType,
      mimeType,
      prompt,
      model,
      provider,
      aspectRatio,
      resolution,
      costUsd,
    } = body;

    if (!userId || !filePath || !fileType || !model || !provider) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, filePath, fileType, model, provider",
        },
        { status: 400 }
      );
    }

    // Validate fileType
    if (fileType !== "image" && fileType !== "video") {
      return NextResponse.json(
        {
          success: false,
          error: 'fileType must be either "image" or "video"',
        },
        { status: 400 }
      );
    }

    // Build input object
    const input: InsertGenerationInput = {
      userId,
      filePath,
      fileType,
      mimeType: mimeType || "application/octet-stream",
      prompt: prompt || "",
      model,
      provider,
      aspectRatio: aspectRatio || "16:9",
      resolution: resolution || "1K",
      costUsd: costUsd ?? 0,
      workflowName: body.workflowName,
      workflowId: body.workflowId,
      nodeId: body.nodeId,
      seed: body.seed,
      workflowJson: body.workflowJson,
      metadata: body.metadata,
    };

    // Insert and return ID
    const id = await insertGeneration(input);

    return NextResponse.json(
      {
        success: true,
        id,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create generation",
      },
      { status: 500 }
    );
  }
}
