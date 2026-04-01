import { NextRequest, NextResponse } from "next/server";
import {
  toggleLoved,
  getGenerationById,
} from "@/lib/db";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";

// PATCH: Toggle loved status for a generation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDbAvailable()) return dbUnavailableResponse();
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation ID is required",
        },
        { status: 400 }
      );
    }

    // Get current generation
    const generation = getGenerationById(id);

    if (!generation) {
      return NextResponse.json(
        {
          success: false,
          error: "Generation not found",
        },
        { status: 404 }
      );
    }

    // Parse request body to determine desired state
    const body = await request.json().catch(() => ({}));
    const isLoved = body.isLoved !== undefined ? body.isLoved : generation.is_loved === 0;

    // Toggle loved status
    toggleLoved(id, isLoved);

    return NextResponse.json(
      {
        success: true,
        isLoved,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to toggle loved status",
      },
      { status: 500 }
    );
  }
}
