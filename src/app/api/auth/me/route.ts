import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    return NextResponse.json({
      userId: user.userId,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
