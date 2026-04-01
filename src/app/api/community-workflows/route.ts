import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, join } from "path";
import { NextResponse } from "next/server";

const WORKFLOWS_DIR = resolve(process.cwd(), "public", "workflows");

/**
 * GET: List all local workflows from the /workflows/ folder.
 *
 * Reads all .json files from the workflows directory.
 * Each file should be a valid workflow JSON with at minimum:
 * { name, description, nodes, edges }
 *
 * Returns the same shape the TemplateExplorerView expects:
 * { success: true, workflows: [...] }
 */
export async function GET() {
  try {
    if (!existsSync(WORKFLOWS_DIR)) {
      return NextResponse.json({
        success: true,
        workflows: [],
      });
    }

    const files = readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".json"));

    const workflows = files.map((filename) => {
      try {
        const filePath = join(WORKFLOWS_DIR, filename);
        const content = readFileSync(filePath, "utf-8");
        const data = JSON.parse(content);

        // Extract metadata for the listing
        const id = filename.replace(".json", "");
        return {
          id,
          name: data.name || id,
          description: data.description || "",
          thumbnailUrl: data.thumbnailUrl || null,
          nodeCount: data.nodes?.length || 0,
          edgeCount: data.edges?.length || 0,
          category: data.category || "custom",
          tags: data.tags || [],
          createdAt: data.createdAt || null,
          author: data.author || "local",
        };
      } catch (err) {
        console.error(`Error reading workflow ${filename}:`, err);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json({
      success: true,
      workflows,
    });
  } catch (error) {
    console.error("Error listing local workflows:", error);
    return NextResponse.json(
      { success: false, error: "Failed to list workflows" },
      { status: 500 }
    );
  }
}
