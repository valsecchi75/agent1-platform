import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { updateUser, updateUserPassword, deleteUser, getUserById } from '@/lib/db';
import { hash } from 'bcryptjs';
import { rmSync } from 'fs';
import { join, resolve } from 'path';

const STORAGE_DIR = resolve(process.cwd(), 'storage');

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getRequestUser(req);
    if (admin.role !== 'admin' && admin.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    // dept_admin scope checks
    if (admin.role === 'dept_admin') {
      const targetUser = getUserById(id);
      if (!targetUser || targetUser.department_id !== admin.departmentId) {
        return NextResponse.json({ error: 'Can only edit users in your department' }, { status: 403 });
      }
      if (body.role === 'admin') {
        return NextResponse.json({ error: 'Cannot promote to admin' }, { status: 403 });
      }
      // dept_admin cannot move users to other departments
      if (body.departmentId !== undefined && body.departmentId !== admin.departmentId) {
        return NextResponse.json({ error: 'Cannot move users to other departments' }, { status: 403 });
      }
    }

    if (body.displayName !== undefined || body.role !== undefined || body.departmentId !== undefined) {
      updateUser(id, {
        display_name: body.displayName,
        role: body.role,
        department_id: body.departmentId,
      });
    }

    if (body.newPassword) {
      const hashed = await hash(body.newPassword, 12);
      updateUserPassword(id, hashed);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getRequestUser(req);
    if (admin.role !== 'admin' && admin.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { id } = await params;

    if (id === admin.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const user = getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // dept_admin can only delete users in own department
    if (admin.role === 'dept_admin') {
      if (user.department_id !== admin.departmentId) {
        return NextResponse.json({ error: 'Can only delete users in your department' }, { status: 403 });
      }
      if (user.role === 'admin') {
        return NextResponse.json({ error: 'Cannot delete admin users' }, { status: 403 });
      }
    }

    deleteUser(id);

    // Async file cleanup
    setTimeout(() => {
      try {
        const userDir = join(STORAGE_DIR, 'users', id);
        rmSync(userDir, { recursive: true, force: true });
        console.log(`[admin] Cleaned up storage for deleted user ${id}`);
      } catch (err) {
        console.warn(`[admin] Failed to clean up storage for user ${id}:`, err);
      }
    }, 0);

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
