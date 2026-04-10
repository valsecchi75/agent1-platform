import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { deleteUserApiKey } from '@/lib/db';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ keyName: string }> }) {
  try {
    const user = await getRequestUser(req);
    const { keyName } = await params;
    deleteUserApiKey(user.userId, keyName);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
