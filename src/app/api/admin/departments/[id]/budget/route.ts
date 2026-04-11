import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentBudgetStatus } from '@/lib/departments';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);
    const status = getDepartmentBudgetStatus(id);
    if (!status)
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    return NextResponse.json({ budget: status });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
