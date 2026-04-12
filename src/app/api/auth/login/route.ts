import { NextRequest, NextResponse } from "next/server";
import { signToken } from "@/lib/auth/jwt";

/**
 * POST /api/auth/login
 *
 * Two authentication paths:
 * 1. DB-first: validate username/password against SQLite users table (bcrypt)
 * 2. Env fallback: if no DB users exist, accept credentials from .env
 *    (ADMIN_USERNAME / ADMIN_PASSWORD, defaults: admin/admin)
 *
 * On success, sets `agent1_session` HttpOnly cookie with JWT.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    // ── Path 1: DB authentication ──────────────────────────────────
    let dbUser = null;
    let useEnvAuth = false;

    try {
      const { authenticateUser, getUserCount } = await import("@/lib/db");

      const userCount = getUserCount();

      if (userCount > 0) {
        // DB has users — authenticate against DB
        dbUser = await authenticateUser(username, password);

        if (!dbUser) {
          return NextResponse.json(
            { error: "Invalid credentials" },
            { status: 401 }
          );
        }
      } else {
        // No DB users — fall through to env auth
        useEnvAuth = true;
      }
    } catch {
      // DB not available — fall through to env auth
      useEnvAuth = true;
    }

    // ── Path 2: Env-based authentication (fallback) ────────────────
    if (useEnvAuth) {
      const envUsername = process.env.ADMIN_USERNAME || "admin";
      const envPassword = process.env.ADMIN_PASSWORD || "admin";

      if (username !== envUsername || password !== envPassword) {
        return NextResponse.json(
          { error: "Invalid credentials" },
          { status: 401 }
        );
      }

      // Env-auth user gets admin role with a deterministic ID
      const token = await signToken({
        authenticated: true,
        userId: `env-${username}`,
        username,
        role: "admin",
        departmentId: null,
      });

      const response = NextResponse.json({
        success: true,
        user: { username, role: "admin", displayName: username },
      });

      response.cookies.set("agent1_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    }

    // ── DB user authenticated — issue JWT ──────────────────────────
    if (dbUser) {
      const token = await signToken({
        authenticated: true,
        userId: dbUser.id,
        username: dbUser.username,
        role: dbUser.role,
        departmentId: dbUser.department_id || null,
      });

      const response = NextResponse.json({
        success: true,
        user: {
          username: dbUser.username,
          role: dbUser.role,
          displayName: dbUser.display_name || dbUser.username,
        },
      });

      response.cookies.set("agent1_session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });

      return response;
    }

    // Should not reach here
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 }
    );
  } catch (error) {
    console.error("[auth/login] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
