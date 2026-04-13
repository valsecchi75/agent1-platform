import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireDeptAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { getUserById, updateUser, deleteUser } from '@/lib/db';

/**
 * GET /api/admin/users/[id]
 * Get user details (admin or dept_admin of same dept)
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestUser = await requireDeptAdmin(req);

    const targetUser = getUserById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Dept admin can only view users in their department
    if (requestUser.role === 'dept_admin' && targetUser.department_id !== requestUser.departmentId) {
      throw new AuthError('Access denied', 403);
    }

    return NextResponse.json(targetUser);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/users/[id]
 * Update user (admin: full access, dept_admin: own dept users only, no role escalation)
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const requestUser = await requireDeptAdmin(req);

    const targetUser = getUserById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Dept admin can only update users in their department
    if (requestUser.role === 'dept_admin' && targetUser.department_id !== requestUser.departmentId) {
      throw new AuthError('Access denied', 403);
    }

    let body: { displayName?: string | null; role?: string; departmentId?: string | null };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Dept admin cannot escalate roles or change departments
    if (requestUser.role === 'dept_admin') {
      if (body.role !== undefined) {
        throw new AuthError('Cannot change user role as dept_admin', 403);
      }
      if (body.departmentId !== undefined) {
        throw new AuthError('Cannot change department assignment as dept_admin', 403);
      }
    }

    // Admin cannot escalate someone to admin role if trying via API (safety check)
    if (body.role === 'admin' && requestUser.role !== 'admin') {
      throw new AuthError('Only admins can create other admins', 403);
    }

    updateUser(id, body);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete user (admin only)
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await requireAdmin(req);

    const targetUser = getUserById(id);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    deleteUser(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
