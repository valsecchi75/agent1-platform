import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { CustomNodePackManifest } from "@/types/customNodes";

/**
 * GET /api/custom-nodes
 * Scans custom_nodes/ directory and returns all discovered packs.
 */
export async function GET() {
  try {
    const customNodesDir = path.join(process.cwd(), "custom_nodes");

    if (!fs.existsSync(customNodesDir)) {
      return NextResponse.json({ packs: [] });
    }

    const entries = fs.readdirSync(customNodesDir, { withFileTypes: true });
    const packs: (CustomNodePackManifest & { packId: string })[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(customNodesDir, entry.name, "manifest.json");
      if (!fs.existsSync(manifestPath)) continue;

      try {
        const raw = fs.readFileSync(manifestPath, "utf-8");
        const manifest: CustomNodePackManifest = JSON.parse(raw);
        packs.push({ ...manifest, packId: entry.name });
      } catch {
        console.warn(`[custom-nodes] Invalid manifest in ${entry.name}`);
      }
    }

    return NextResponse.json({ packs });
  } catch (error) {
    console.error("[custom-nodes] Discovery failed:", error);
    return NextResponse.json({ packs: [], error: "Discovery failed" }, { status: 500 });
  }
}
