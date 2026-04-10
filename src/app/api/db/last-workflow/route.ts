import { NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { getDb } from "@/lib/db";
import { loadLastGenerationWorkflow } from "@/lib/sessionPersistence";

/**
 * Resolve "admin" username → actual UUID (cached).
 */
let cachedAdminId: string | null = null;
function resolveAdminId(): string {
  if (cachedAdminId) return cachedAdminId;
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT id FROM users WHERE username = 'admin' LIMIT 1")
      .get() as { id: string } | undefined;
    if (row) {
      cachedAdminId = row.id;
      return row.id;
    }
  } catch {
    /* DB unavailable */
  }
  return "admin";
}

/**
 * GET /api/db/last-workflow — Get the last workflow that produced a generation.
 *
 * Loads from the session file on disk (storage/users/{userId}/workflows/__session/last_generation.json)
 * which was saved by the executor after each successful generation.
 * Images are hydrated from extracted files automatically.
 */
export async function GET() {
  try {
    const userId = resolveAdminId();
    const workflow = loadLastGenerationWorkflow(userId);

    if (!workflow) {
      return NextResponse.json({
        success: true,
        workflow: null,
        message: "No last generation workflow found",
      });
    }

    return NextResponse.json({
      success: true,
      workflow,
      workflowName: workflow.name || null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get last workflow",
      },
      { status: 500 }
    );
  }
}
