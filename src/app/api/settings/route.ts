import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

const ENV_PATH = resolve(process.cwd(), '.env');

const ALLOWED_KEYS = [
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_API_KEY',
  'REPLICATE_API_KEY',
  'FAL_API_KEY',
  'KIE_API_KEY',
  'WAVESPEED_API_KEY',
  'PATREON_CLIENT_ID',
  'PATREON_CLIENT_SECRET',
];

function maskKey(value: string | undefined): string {
  if (!value || value.trim() === '') return 'not configured';
  if (value.length < 4) return '****';
  return value.substring(0, 4) + '****';
}

/** Verify JWT session cookie — returns false if not authenticated */
async function checkAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload !== null && payload.authenticated === true;
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result: Record<string, string> = {};
  for (const key of ALLOWED_KEYS) {
    result[key] = maskKey(process.env[key]);
  }
  return NextResponse.json(result);
}

export async function PUT(req: NextRequest) {
  if (!(await checkAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { key?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { key, value } = body;

  if (!key || !ALLOWED_KEYS.includes(key)) {
    return NextResponse.json({ error: 'Invalid key name' }, { status: 400 });
  }

  if (typeof value !== 'string' || value.length > 256 || value.includes('\n')) {
    return NextResponse.json({ error: 'Invalid value' }, { status: 400 });
  }

  try {
    let content = '';
    if (existsSync(ENV_PATH)) {
      content = readFileSync(ENV_PATH, 'utf-8');
    }

    // Quote values with special chars
    const needsQuotes = /[\s#"'\\]/.test(value);
    const envValue = needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value;

    // Update or append key
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${envValue}`);
    } else {
      content = content.trimEnd() + `\n${key}=${envValue}\n`;
    }

    writeFileSync(ENV_PATH, content);
    process.env[key] = value;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to update .env:', err);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
