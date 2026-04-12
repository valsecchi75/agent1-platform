import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentMembers } from '@/lib/departments';

/**
 * GET /api/admin/departments/[id]/members
 * List department members with stats (admin or dept_admin of that dept)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);

    const members = getDepartmentMembers(id);

    return NextResponse.json({ members });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
