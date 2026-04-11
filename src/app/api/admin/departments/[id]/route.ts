import { NextRequest, NextResponse } from 'next/server';
import { requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import {
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  getDepartmentMemberCount,
} from '@/lib/departments';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);
    const dept = getDepartmentById(id);
    if (!dept)
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    return NextResponse.json({
      department: { ...dept, memberCount: getDepartmentMemberCount(id) },
    });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireDepartmentAccess(req, id);
    if (user.role !== 'admin' && user.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    const body = await req.json();
    updateDepartment(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await requireDepartmentAccess(req, id);
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only global admin can delete departments' },
        { status: 403 }
      );
    }
    deleteDepartment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof Error && error.message.includes('active members')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
