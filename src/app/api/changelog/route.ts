import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';

/**
 * GET /api/changelog
 * Returns the CHANGELOG.md contents. Admin only.
 */
export async function GET(req: NextRequest) {
  try {
    await getRequestUser(req);

    const changelogPath = resolve(process.cwd(), 'CHANGELOG.md');
    if (!existsSync(changelogPath)) {
      return NextResponse.json({ content: 'Changelog file not found.' });
    }

    const content = readFileSync(changelogPath, 'utf-8');
    return NextResponse.json({ content });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
