import { NextRequest, NextResponse } from "next/server";
import { saveLastGenerationWorkflow } from "@/lib/sessionPersistence";
import { getRequestUser, AuthError } from "@/lib/auth/getRequestUser";

export const maxDuration = 300;

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
    const user = await getRequestUser(request);
    const body = await request.json();
    const { workflow } = body;

    if (!workflow || !Array.isArray(workflow.nodes)) {
      return NextResponse.json(
        { success: false, error: "Missing or invalid workflow data" },
        { status: 400 }
      );
    }

    const filePath = saveLastGenerationWorkflow(user.userId, workflow);

    return NextResponse.json({
      success: true,
      filePath,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[session/save-last-generation] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save",
      },
      { status: 500 }
    );
  }
}
