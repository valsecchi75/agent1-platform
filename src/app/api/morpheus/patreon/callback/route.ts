import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * GET /api/morpheus/patreon/callback?code=...
 *
 * Patreon redirects here after the user authorizes. We exchange the
 * authorization code for an access token, fetch the user's identity
 * and membership status, and store it locally.
 */

const AUTH_FILE = path.join(process.cwd(), "..", "custom_nodes", "comfyui_morpheus_model_management", ".patreon_auth.json");

interface PatreonAuthData {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  user_name: string;
  user_email: string;
  user_id: string;
  is_active_patron: boolean;
  tier_amount_cents: number;
  authenticated_at: string;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return new NextResponse(errorHtml("No authorization code received from Patreon."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const clientId = process.env.PATREON_CLIENT_ID;
  const clientSecret = process.env.PATREON_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return new NextResponse(errorHtml("PATREON_CLIENT_ID or PATREON_CLIENT_SECRET not configured."), {
      headers: { "Content-Type": "text/html" },
    });
  }

  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/morpheus/patreon/callback`;

  try {
    // 1. Exchange code for access token
    const tokenRes = await fetch("https://www.patreon.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[Morpheus Patreon] Token exchange failed:", errText);
      return new NextResponse(errorHtml("Failed to exchange code for token."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresIn = tokenData.expires_in || 2592000; // default 30 days

    // 2. Fetch user identity + memberships
    const identityRes = await fetch(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships,memberships.currently_entitled_tiers&fields%5Buser%5D=full_name,email&fields%5Bmember%5D=patron_status,currently_entitled_amount_cents",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!identityRes.ok) {
      console.error("[Morpheus Patreon] Identity fetch failed:", await identityRes.text());
      return new NextResponse(errorHtml("Failed to fetch Patreon identity."), {
        headers: { "Content-Type": "text/html" },
      });
    }

    const identity = await identityRes.json();
    const user = identity.data?.attributes || {};
    const userId = identity.data?.id || "unknown";
    const memberships = identity.included?.filter((i: any) => i.type === "member") || [];

    // Check if active patron with sufficient tier
    let isActivePatron = false;
    let tierAmountCents = 0;
    for (const member of memberships) {
      const status = member.attributes?.patron_status;
      const amount = member.attributes?.currently_entitled_amount_cents || 0;
      if (status === "active_patron" && amount > 0) {
        isActivePatron = true;
        tierAmountCents = Math.max(tierAmountCents, amount);
      }
    }

    // Creator bypass: always allow the creator
    const creatorName = process.env.PATREON_CREATOR_NAME || "Sergio Valsecchi";
    if (user.full_name === creatorName || user.email === process.env.PATREON_CREATOR_EMAIL) {
      isActivePatron = true;
      tierAmountCents = 99999;
    }

    // 3. Store auth data locally
    const authData: PatreonAuthData = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
      user_name: user.full_name || "Patron",
      user_email: user.email || "",
      user_id: userId,
      is_active_patron: isActivePatron,
      tier_amount_cents: tierAmountCents,
      authenticated_at: new Date().toISOString(),
    };

    // Ensure directory exists
    const dir = path.dirname(AUTH_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), "utf-8");

    console.log(`[Morpheus Patreon] Authenticated: ${authData.user_name} (active: ${isActivePatron}, tier: ${tierAmountCents}c)`);

    // 4. Return HTML that posts message to opener and closes
    return new NextResponse(
      successHtml(authData.user_name, isActivePatron),
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (err) {
    console.error("[Morpheus Patreon] OAuth error:", err);
    return new NextResponse(errorHtml("Unexpected error during Patreon authentication."), {
      headers: { "Content-Type": "text/html" },
    });
  }
}

function successHtml(userName: string, isActive: boolean): string {
  return `<!DOCTYPE html>
<html><head><title>Morpheus - Patreon Connected</title></head>
<body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="text-align:center;max-width:400px">
    <div style="font-size:48px;margin-bottom:16px">${isActive ? "✅" : "⚠️"}</div>
    <h2>${isActive ? `Welcome, ${userName}!` : "Connected but no active membership"}</h2>
    <p style="color:#aaa">${isActive ? "Your Patreon membership is verified. Closing this window..." : "You need an active Patreon membership to access the talent catalog."}</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: "patreon_oauth_complete",
        success: ${isActive},
        user_name: ${JSON.stringify(userName)}
      }, "*");
    }
    setTimeout(() => window.close(), 2000);
  </script>
</body></html>`;
}

function errorHtml(message: string): string {
  return `<!DOCTYPE html>
<html><head><title>Morpheus - Auth Error</title></head>
<body style="background:#111;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
  <div style="text-align:center;max-width:400px">
    <div style="font-size:48px;margin-bottom:16px">❌</div>
    <h2>Authentication Failed</h2>
    <p style="color:#f96854">${message}</p>
  </div>
  <script>
    if (window.opener) {
      window.opener.postMessage({
        type: "patreon_oauth_complete",
        success: false,
        error: ${JSON.stringify(message)}
      }, "*");
    }
    setTimeout(() => window.close(), 3000);
  </script>
</body></html>`;
}
