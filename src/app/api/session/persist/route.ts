import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { saveUserSession, getDb } from "@/lib/db";
import {
  saveSessionWorkflow,
  cleanupOldSessionFiles,
} from "@/lib/sessionPersistence";

export const maxDuration = 300; // 5 min — large snapshots with images

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
 * POST /api/session/persist
 *
 * Saves all tab workflow snapshots to disk (extracting base64 images to files)
 * and stores lightweight metadata in the DB.
 *
 * Body: { tabs: WorkflowTab[], activeTabId: string }
 * Each tab must have a `snapshot` object with nodes/edges/etc.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tabs, activeTabId } = body;

    if (!Array.isArray(tabs) || !activeTabId) {
      return NextResponse.json(
        { success: false, error: "Missing tabs or activeTabId" },
        { status: 400 }
      );
    }

    // Save each tab's workflow to a session file (with image extraction)
    const tabMeta: Array<{
      id: string;
      label: string;
      hasUnsavedChanges: boolean;
    }> = [];

    // Resolve userId first
    const userId = resolveAdminId();

    for (const tab of tabs) {
      if (tab.snapshot) {
        saveSessionWorkflow(userId, tab.id, tab.snapshot);
      }
      tabMeta.push({
        id: tab.id,
        label: tab.label || "Unsaved Workflow",
        hasUnsavedChanges: tab.hasUnsavedChanges || false,
      });
    }

    // Clean up old session files that no longer correspond to open tabs
    cleanupOldSessionFiles(userId, tabs.map((t: { id: string }) => t.id));

    // Store lightweight metadata in DB (no base64, just tab IDs + labels)
    if (isDbAvailable()) {
      saveUserSession(userId, {
        tabs: tabMeta,
        activeTabId,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[session/persist] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to persist session",
      },
      { status: 500 }
    );
  }
}
