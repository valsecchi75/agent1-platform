import { readFileSync, existsSync } from "fs";
import { resolve, join } from "path";
import { NextResponse } from "next/server";

const WORKFLOWS_DIR = resolve(process.cwd(), "public", "workflows");

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET: Load a specific local workflow by ID (filename without .json).
 *
 * Instead of returning a downloadUrl (like the old remote API),
 * we return the full workflow JSON directly since it's local.
 *
 * Returns: { success: true, workflow: {...} }
 * The TemplateExplorerView will need a small adaptation to handle
 * this direct response. For backward compatibility we also support
 * the downloadUrl pattern by serving from a local endpoint.
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Sanitize: only allow alphanumeric, dash, underscore
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
    const filePath = join(WORKFLOWS_DIR, `${safeId}.json`);

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: `Workflow not found: ${id}` },
        { status: 404 }
      );
    }

    const content = readFileSync(filePath, "utf-8");
    const workflow = JSON.parse(content);

    // Return the full workflow directly
    return NextResponse.json({
      success: true,
      workflow,
      // Also provide a downloadUrl that points to the local serve endpoint
      downloadUrl: `/api/community-workflows/${safeId}/download`,
    });
  } catch (error) {
    console.error("Error loading local workflow:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load workflow" },
      { status: 500 }
    );
  }
}
