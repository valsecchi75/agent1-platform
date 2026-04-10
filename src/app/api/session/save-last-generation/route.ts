import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { getDb } from "@/lib/db";
import { saveLastGenerationWorkflow } from "@/lib/sessionPersistence";

export const maxDuration = 300;

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
 * POST /api/session/save-last-generation
 *
 * Saves the current workflow state as the "last generation" snapshot.
 * Called by executors after a successful image/video generation.
 * The workflow is saved with images extracted to disk so it can be
 * reloaded via the "Last Workflow" button on the quickstart screen.
 *
 * Body: { workflow: WorkflowFile }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow } = body;

    if (!workflow || !Array.isArray(workflow.nodes)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid workflow data" },
        { status: 400 }
      );
    }

    const userId = resolveAdminId();
    const filePath = saveLastGenerationWorkflow(userId, workflow);

    return NextResponse.json({
      success: true,
      filePath,
    });
  } catch (error) {
    console.error("[session/save-last-generation] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save",
      },
      { status: 500 }
    );
  }
}
