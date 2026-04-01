import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * POST /api/morpheus/patreon/logout
 *
 * Removes the local Patreon auth file (logs out).
 */

const AUTH_FILE = path.join(process.cwd(), "..", "custom_nodes", "comfyui_morpheus_model_management", ".patreon_auth.json");

export async function POST() {
  try {
    if (fs.existsSync(AUTH_FILE)) {
      fs.unlinkSync(AUTH_FILE);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Morpheus Patreon] Logout error:", err);
    return NextResponse.json({ ok: false, error: "Failed to logout" }, { status: 500 });
  }
}

// Also support GET for simplicity
export async function GET() {
  return POST();
}
