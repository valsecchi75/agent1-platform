import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { listUserApiKeys, setUserApiKey, deleteUserApiKey } from '@/lib/db';

const ALLOWED_KEYS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'REPLICATE_API_KEY',
  'FAL_API_KEY',
  'KIE_API_KEY',
  'WAVESPEED_API_KEY',
];

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const keys = listUserApiKeys(user.userId);
    // Build response: all allowed keys, masked value or empty
    const result: Record<string, string> = {};
    for (const keyName of ALLOWED_KEYS) {
      const found = keys.find(k => k.keyName === keyName);
      result[keyName] = found ? found.masked : '';
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const body = await req.json();
    const { key, value } = body;

    if (!key || !ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
    }
    if (!value || typeof value !== 'string') {
      return NextResponse.json({ error: 'Value required' }, { status: 400 });
    }
    setUserApiKey(user.userId, key, value.trim());
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const body = await req.json();
    const { key } = body;

    if (!key || !ALLOWED_KEYS.includes(key)) {
      return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
    }
    deleteUserApiKey(user.userId, key);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
