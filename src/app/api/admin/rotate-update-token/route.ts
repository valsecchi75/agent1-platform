import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { verifyToken } from '@/lib/auth/jwt';
import { isDbAvailable, setSetting } from '@/lib/db-guard';
import { clearUpdateCache } from '@/lib/update/versionCheck';

const SALT = 'agent1-from-vision-to-form::agent1-update-salt::2026';

function xorEncode(token: string): string {
  const key = createHash('sha256').update(SALT).digest();
  const tokenBytes = Buffer.from(token, 'utf-8');
  const encoded = Buffer.alloc(tokenBytes.length);
  for (let i = 0; i < tokenBytes.length; i++) {
    encoded[i] = tokenBytes[i] ^ key[i % key.length];
  }
  return encoded.toString('base64');
}

/** Verify JWT session cookie — admin-only endpoint */
async function checkAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload !== null && payload.authenticated === true;
}

export async function POST(req: NextRequest) {
  // Admin-only: verify authentication
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!isDbAvailable()) {
    return NextResponse.json({ error: 'Database not available' }, { status: 503 });
  }

  let body: { newToken?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { newToken } = body;
  const isValidTokenFormat =
    newToken &&
    typeof newToken === 'string' &&
    (newToken.startsWith('ghp_') || newToken.startsWith('github_pat_'));
  if (!isValidTokenFormat) {
    return NextResponse.json(
      { error: 'Invalid token. Must start with ghp_ or github_pat_' },
      { status: 400 }
    );
  }

  try {
    const encoded = xorEncode(newToken);
    const success = setSetting('update_token', encoded);
    if (!success) {
      return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });
    }

    clearUpdateCache();

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to store token' }, { status: 500 });
  }
}
