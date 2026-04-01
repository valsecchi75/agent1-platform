import { NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { loadUserSession, getDb } from "@/lib/db";
import { loadSessionWorkflow } from "@/lib/sessionPersistence";

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
 * GET /api/session/restore
 *
 * Loads all tab workflow snapshots from session files on disk,
 * hydrating base64 images from extracted files.
 *
 * Returns: {
 *   success: true,
 *   session: {
 *     tabs: [{ id, label, hasUnsavedChanges, snapshot: {...} }],
 *     activeTabId: string
 *   }
 * }
 */
export async function GET() {
  if (!isDbAvailable()) return dbUnavailableResponse();

  try {
    const userId = resolveAdminId();
    const meta = loadUserSession(userId) as {
      tabs?: Array<{ id: string; label: string; hasUnsavedChanges: boolean }>;
      activeTabId?: string;
    } | null;

    if (!meta || !meta.tabs || meta.tabs.length === 0) {
      return NextResponse.json({
        success: true,
        session: null,
        message: "No saved session found",
      });
    }

    // Load each tab's workflow from disk (with image hydration)
    const hydratedTabs = meta.tabs.map((tabMeta) => {
      const snapshot = loadSessionWorkflow(tabMeta.id);
      return {
        id: tabMeta.id,
        label: tabMeta.label,
        hasUnsavedChanges: tabMeta.hasUnsavedChanges,
        snapshot,
      };
    });

    // Filter out tabs with no snapshot file (file deleted/missing)
    const validTabs = hydratedTabs.filter((t) => t.snapshot !== null);

    if (validTabs.length === 0) {
      return NextResponse.json({
        success: true,
        session: null,
        message: "Session files not found on disk",
      });
    }

    // Ensure activeTabId points to a valid tab
    let activeTabId = meta.activeTabId;
    if (!validTabs.find((t) => t.id === activeTabId)) {
      activeTabId = validTabs[0].id;
    }

    return NextResponse.json({
      success: true,
      session: {
        tabs: validTabs,
        activeTabId,
      },
    });
  } catch (error) {
    console.error("[session/restore] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to restore session",
      },
      { status: 500 }
    );
  }
}
