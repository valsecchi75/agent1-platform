import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentMembers } from '@/lib/departments';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireDepartmentAccess(req, id);
    if (user.role === 'user') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    const members = getDepartmentMembers(id);
    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
