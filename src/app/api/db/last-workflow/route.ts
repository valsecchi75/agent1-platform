import { NextResponse } from "next/server";
import { loadLastGenerationWorkflow } from "@/lib/sessionPersistence";

/**
 * GET /api/db/last-workflow — Get the last workflow that produced a generation.
 *
 * Loads from the session file on disk (storage/workflows/__session/last_generation.json)
 * which was saved by the executor after each successful generation.
 * Images are hydrated from extracted files automatically.
 */
export async function GET() {
  try {
    const workflow = loadLastGenerationWorkflow();

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
