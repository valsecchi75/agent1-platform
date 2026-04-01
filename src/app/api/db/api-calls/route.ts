import { NextRequest, NextResponse } from "next/server";
import { logApiCall, getDb } from "@/lib/db";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import type { InsertApiCallInput } from "@/lib/db-types";

/**
 * Resolve userId: if it's the username "admin", look up the actual UUID.
 * The api_calls table has FK on user_id → users.id.
 */
let cachedAdminId: string | null = null;
function resolveUserId(userId: string): string {
  if (userId && userId !== "admin") return userId;
  if (cachedAdminId) return cachedAdminId;
  try {
    const db = getDb();
    const row = db.prepare("SELECT id FROM users WHERE username = ? LIMIT 1").get(userId) as { id: string } | undefined;
    if (row) {
      cachedAdminId = row.id;
      return row.id;
    }
  } catch { /* DB unavailable */ }
  return userId;
}

// POST: Log an API call
export async function POST(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const body = await request.json();

    // Validate required fields
    const {
      userId,
      callType,
      provider,
      model,
      costUsd,
      durationMs,
      status,
    } = body;

    if (!userId || !callType || !provider || !model) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: userId, callType, provider, model",
        },
        { status: 400 }
      );
    }

    // Validate callType
    const validCallTypes = ["generation", "llm_analysis", "vision", "prompt_compilation"];
    if (!validCallTypes.includes(callType)) {
      return NextResponse.json(
        {
          success: false,
          error: `callType must be one of: ${validCallTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate status
    const validStatuses = ["success", "error"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: `status must be one of: ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Build input object — resolve "admin" username to actual UUID
    const input: InsertApiCallInput = {
      userId: resolveUserId(userId),
      callType,
      provider,
      model,
      costUsd: costUsd ?? 0,
      durationMs: durationMs ?? 0,
      status,
      generationId: body.generationId,
      inputTokens: body.inputTokens,
      outputTokens: body.outputTokens,
      errorMessage: body.errorMessage,
    };

    // Log the API call
    const id = logApiCall(input);

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
        error: error instanceof Error ? error.message : "Failed to log API call",
      },
      { status: 500 }
    );
  }
}
