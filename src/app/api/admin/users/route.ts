import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { listUsers, createUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const users = listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { username, password, displayName, role } = await req.json();
    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }
    const userId = await createUser({
      username,
      password,
      displayName: displayName || username,
      role: role || 'user',
    });
    return NextResponse.json({ userId }, { status: 201 });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if ((err as Error).message?.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
