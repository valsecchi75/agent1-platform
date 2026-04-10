import { NextRequest, NextResponse } from "next/server";
import { isDbAvailable, dbUnavailableResponse } from "@/lib/db-guard";
import { saveUserSession, loadUserSession } from "@/lib/db";
import { getRequestUser, AuthError } from "@/lib/auth/getRequestUser";

/**
 * GET /api/db/session — Load the user's last saved editor session.
 */
export async function GET(request: NextRequest) {
  if (!isDbAvailable()) return dbUnavailableResponse();

  try {
    const user = await getRequestUser(request);
    const session = loadUserSession(user.userId);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to load session",
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
    const user = await getRequestUser(request);
    const body = await request.json();

    saveUserSession(user.userId, body);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to save session",
      },
      { status: 500 }
    );
  }
}
