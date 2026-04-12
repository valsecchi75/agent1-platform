import { NextResponse } from "next/server";

/**
 * POST /api/auth/logout
 *
 * Clears the `agent1_session` cookie, effectively logging the user out.
 */
export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set("agent1_session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Immediately expire the cookie
  });

  return response;
}
