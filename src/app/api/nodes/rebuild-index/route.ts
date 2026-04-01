/**
 * Node Index API Routes
 *
 * GET  /api/nodes/rebuild-index — Returns the cached node index
 * POST /api/nodes/rebuild-index — Rebuilds and returns the node index
 */

import { NextResponse } from "next/server";
import { buildNodeIndex, getNodeIndex } from "@/lib/nodeIndex";

/**
 * GET /api/nodes/rebuild-index
 * Returns the cached node index
 */
export async function GET() {
  try {
    const index = await getNodeIndex();
    return NextResponse.json({
      success: true,
      index,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load node index";
    console.error("[api/nodes/rebuild-index] GET error:", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/nodes/rebuild-index
 * Rebuilds and returns the node index
 */
export async function POST() {
  try {
    const index = await buildNodeIndex();
    return NextResponse.json({
      success: true,
      index,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build node index";
    console.error("[api/nodes/rebuild-index] POST error:", error);
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
