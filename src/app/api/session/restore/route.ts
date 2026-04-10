import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { loadUserSession } from "@/lib/db";
import { getRequestUser, AuthError } from "@/lib/auth/getRequestUser";
import { loadSessionWorkflow } from "@/lib/sessionPersistence";

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
export async function GET(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();

  try {
    const user = await getRequestUser(request);
    const meta = loadUserSession(user.userId) as {
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
      const snapshot = loadSessionWorkflow(user.userId, tabMeta.id);
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
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("[session/restore] Error:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to restore session",
      },
      { status: 500 }
    );
  }
}
