import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/morpheus/patreon/status
 *
 * Returns the local Patreon authentication status.
 * Reads from the locally stored auth file — no external API calls needed.
 */

const AUTH_FILE = path.join(process.cwd(), "custom_nodes", "morpheus-model-management", ".patreon_auth.json");

export async function GET() {
  try {
    if (!fs.existsSync(AUTH_FILE)) {
      return NextResponse.json({ authenticated: false });
    }

    const raw = fs.readFileSync(AUTH_FILE, "utf-8");
    const auth = JSON.parse(raw);

    // Check if token is expired
    const expiresAt = new Date(auth.expires_at);
    const isExpired = expiresAt < new Date();

    if (isExpired) {
      // Try to refresh the token if we have a refresh token and client credentials
      const refreshed = await tryRefreshToken(auth);
      if (refreshed) {
        return NextResponse.json({
          authenticated: true,
          user_name: refreshed.user_name,
          user_email: refreshed.user_email,
          is_active_patron: refreshed.is_active_patron,
          tier_amount_cents: refreshed.tier_amount_cents,
          expired: false,
        });
      }

      return NextResponse.json({
        authenticated: true,
        user_name: auth.user_name,
        user_email: auth.user_email,
        is_active_patron: auth.is_active_patron,
        expired: true,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user_name: auth.user_name,
      user_email: auth.user_email,
      is_active_patron: auth.is_active_patron,
      tier_amount_cents: auth.tier_amount_cents,
      expired: false,
    });
  } catch (err) {
    console.error("[Morpheus Patreon] Status check error:", err);
    return NextResponse.json({ authenticated: false, error: "Failed to read auth status" });
  }
}

async function tryRefreshToken(auth: any): Promise<any | null> {
  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;
  if (!clientId || !clientSecret || !auth.refresh_token) return null;

  try {
    const res = await fetch("https://www.patreon.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refresh_token,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Update stored auth
    const updated = {
      ...auth,
      access_token: data.access_token,
      refresh_token: data.refresh_token || auth.refresh_token,
      expires_at: new Date(Date.now() + (data.expires_in || 2592000) * 1000).toISOString(),
    };

    fs.writeFileSync(AUTH_FILE, JSON.stringify(updated, null, 2), "utf-8");
    console.log("[Morpheus Patreon] Token refreshed successfully");
    return updated;
  } catch {
    return null;
  }
}
