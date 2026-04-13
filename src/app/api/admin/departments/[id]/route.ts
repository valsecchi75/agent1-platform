import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireDepartmentAccess, AuthError } from '@/lib/auth/getRequestUser';
import { getDepartmentById, updateDepartment, deleteDepartment, getDepartmentMemberCount } from '@/lib/departments';
import type { UpdateDepartmentInput } from '@/lib/db-types';

/**
 * GET /api/admin/departments/[id]
 * Get a department with member count (admin or dept_admin of that dept)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireDepartmentAccess(req, id);

    const dept = getDepartmentById(id);
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    const memberCount = getDepartmentMemberCount(id);

    return NextResponse.json({
      ...dept,
      memberCount,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/departments/[id]
 * Update department (admin only, except dept_admin restricted to name/description only)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireAdmin(req);

    const dept = getDepartmentById(id);
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    let body: UpdateDepartmentInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Convert warningThreshold from percentage (0-100) to ratio (0-1) if needed
    if (body.budgetWarningThreshold !== undefined && body.budgetWarningThreshold > 1) {
      body.budgetWarningThreshold = body.budgetWarningThreshold / 100;
    }

    // AUDIT FIX: dept_admin can only update name/description
    if (user.role === 'dept_admin') {
      const filtered: Record<string, unknown> = {};
      if (body.name !== undefined) filtered.name = body.name;
      if (body.description !== undefined) filtered.description = body.description;
      updateDepartment(id, filtered as UpdateDepartmentInput);
    } else {
      updateDepartment(id, body);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Department name already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/departments/[id]
 * Delete department (admin only)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdmin(req);

    const dept = getDepartmentById(id);
    if (!dept) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    deleteDepartment(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes('Cannot delete department')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
