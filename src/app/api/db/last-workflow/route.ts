import { NextRequest, NextResponse } from "next/server";
import { loadLastGenerationWorkflow } from "@/lib/sessionPersistence";
import { getRequestUser, AuthError } from "@/lib/auth/getRequestUser";

/**
 * GET /api/db/last-workflow — Get the last workflow that produced a generation.
 *
 * Loads from the session file on disk (storage/users/{userId}/workflows/__session/last_generation.json)
 * which was saved by the executor after each successful generation.
 * Images are hydrated from extracted files automatically.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getRequestUser(request);
    const workflow = loadLastGenerationWorkflow(user.userId);

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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to get last workflow",
      },
      { status: 500 }
    );
  }
}
