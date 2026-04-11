import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import {
  createDepartment,
  listDepartments,
  getDepartmentById,
  getDepartmentMemberCount,
} from '@/lib/departments';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);

    if (user.role === 'admin') {
      const departments = listDepartments();
      const withCounts = departments.map((d) => ({
        ...d,
        memberCount: getDepartmentMemberCount(d.id),
      }));
      return NextResponse.json({ departments: withCounts });
    }

    if (user.role === 'dept_admin' && user.departmentId) {
      const dept = getDepartmentById(user.departmentId);
      if (!dept) return NextResponse.json({ departments: [] });
      return NextResponse.json({
        departments: [
          {
            ...dept,
            memberCount: getDepartmentMemberCount(dept.id),
          },
        ],
      });
    }

    return NextResponse.json({ departments: [] });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only global admin can create departments' },
        { status: 403 }
      );
    }

    const { name, description, budgetMonthly, budgetWarningThreshold, budgetSoftLimit } =
      await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    try {
      const id = createDepartment({
        name: name.trim(),
        description,
        budgetMonthly,
        budgetWarningThreshold,
        budgetSoftLimit,
      });
      return NextResponse.json({ departmentId: id }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
