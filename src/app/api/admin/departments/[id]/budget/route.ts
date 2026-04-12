import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentBudgetStatus } from '@/lib/departments';

/**
 * GET /api/admin/departments/[id]/budget
 * Get department budget status (admin or dept_admin of that dept)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);

    const budgetStatus = getDepartmentBudgetStatus(id);

    return NextResponse.json(budgetStatus);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes('Department not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
