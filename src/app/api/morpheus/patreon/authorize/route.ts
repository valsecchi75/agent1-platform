import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/morpheus/patreon/authorize
 *
 * Starts the Patreon OAuth2 flow. Redirects the user's browser to
 * Patreon's authorization page. On success, Patreon redirects back
 * to /api/morpheus/patreon/callback.
 *
 * Requires PATREON_CLIENT_ID in .env.
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.PATREON_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "PATREON_CLIENT_ID not configured. Add it to Settings → API Keys." },
      { status: 500 }
    );
  }

  // Build redirect URI (same origin as the request)
  const origin = request.nextUrl.origin;
  const redirectUri = `${origin}/api/morpheus/patreon/callback`;

  // Patreon OAuth2 authorize URL
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "identity identity[email] identity.memberships campaigns.members",
  });

  const authorizeUrl = `https://www.patreon.com/oauth2/authorize?${params.toString()}`;
  return NextResponse.redirect(authorizeUrl);
}
