import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { listUserApiKeys, setUserApiKey } from '@/lib/db';

const ALLOWED_KEYS = [
  'GEMINI_API_KEY', 'OPENAI_API_KEY', 'ANTHROPIC_API_KEY',
  'REPLICATE_API_KEY', 'FAL_API_KEY', 'KIE_API_KEY', 'WAVESPEED_API_KEY',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const keys = listUserApiKeys(user.userId);
    return NextResponse.json({ keys });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const { keyName, value } = await req.json();
    if (!ALLOWED_KEYS.includes(keyName)) {
      return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
    }
    if (!value || typeof value !== 'string') {
      return NextResponse.json({ error: 'Value required' }, { status: 400 });
    }
    setUserApiKey(user.userId, keyName, value.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
