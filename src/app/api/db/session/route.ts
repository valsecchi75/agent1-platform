import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { saveUserSession, loadUserSession, getDb } from "@/lib/db";

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
  } catch { /* DB unavailable */ }
  return "admin";
}

/**
 * GET /api/db/session — Load the user's last saved editor session.
 */
export async function GET() {
  if (!isDbAvailable()) return dbUnavailableResponse();

  try {
    const userId = resolveAdminId();
    const session = loadUserSession(userId);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to load session",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/db/session — Save the user's editor session (tab state).
 *
 * Body: { tabs: WorkflowTab[], activeTabId: string }
 */
export async function POST(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();

  try {
    const body = await request.json();
    const userId = resolveAdminId();

    saveUserSession(userId, body);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to save session",
      },
      { status: 500 }
    );
  }
}
