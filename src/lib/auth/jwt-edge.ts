/**
 * Edge Runtime-compatible JWT verification.
 *
 * Uses only `jose` (Web Crypto) and process.env.
 * No Node.js APIs (fs, path, crypto, process.cwd) — safe for Next.js middleware.
 *
 * Used by: src/proxy.ts
 * Server-side signing still uses: src/lib/auth/jwt.ts
 */
import * as jose from 'jose';

/**
 * Verify a JWT token using JWT_SECRET from environment.
 * Returns the decoded payload, or null if invalid/missing secret.
 */
export async function verifyTokenEdge(
  token: string
): Promise<Record<string, unknown> | null> {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    console.warn('[jwt-edge] JWT_SECRET missing or too short — treating as unauthenticated');
    return null;
  }

  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jose.jwtVerify(token, key);
    return payload as Record<string, unknown>;
  } catch (e) {
    console.error('[jwt-edge] Token verification failed:', e instanceof Error ? e.message : 'unknown');
    return null;
  }
}
