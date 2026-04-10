import { NextRequest, NextResponse } from "next/server";
import {
  getGenerations,
  insertGeneration,
} from "@/lib/db";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { getRequestUser, AuthError } from "@/lib/auth/getRequestUser";
import type {
  GenerationFilters,
  InsertGenerationInput,
} from "@/lib/db-types";

// GET: List generations with optional filters
// Query params: provider, model, fileType, isLoved, dateFrom, dateTo, limit, offset, all
export async function GET(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const user = await getRequestUser(request);
    const { searchParams } = new URL(request.url);

    // Parse query parameters into GenerationFilters
    const filters: GenerationFilters = {};

    // User isolation: non-admin always sees only their own
    const isAdminGlobal = user.role === 'admin' && searchParams.get('all') === 'true';
    if (!isAdminGlobal) {
      filters.userId = user.userId;
    }

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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch generations",
      },
      { status: 500 }
    );
  }
}

// POST: Create a new generation record
export async function POST(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const user = await getRequestUser(request);
    const body = await request.json();

    // Validate required fields (but userId will come from JWT, not request body)
    const {
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

    if (!filePath || !fileType || !model || !provider) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: filePath, fileType, model, provider",
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

    // Build input object with userId from JWT
    const input: InsertGenerationInput = {
      userId: user.userId,
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create generation",
      },
      { status: 500 }
    );
  }
}
