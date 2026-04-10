import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { getUserById, updateUser, updateUserPassword, authenticateUser } from '@/lib/db';
import { hash } from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const dbUser = getUserById(user.userId);
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      userId: dbUser.id,
      username: dbUser.username,
      displayName: dbUser.display_name,
      role: dbUser.role,
      createdAt: dbUser.created_at,
      lastLoginAt: dbUser.last_login_at,
    });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    const body = await req.json();

    if (body.displayName !== undefined) {
      updateUser(user.userId, { display_name: body.displayName });
    }

    if (body.newPassword) {
      if (!body.currentPassword) {
        return NextResponse.json({ error: 'Current password required' }, { status: 400 });
      }
      const dbUser = await authenticateUser(user.username, body.currentPassword);
      if (!dbUser) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 403 });
      }
      const hashed = await hash(body.newPassword, 12);
      updateUserPassword(user.userId, hashed);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
