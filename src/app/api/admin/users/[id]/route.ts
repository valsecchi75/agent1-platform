import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { updateUser, updateUserPassword, deleteUser, getUserById } from '@/lib/db';
import { hash } from 'bcryptjs';
import { rmSync } from 'fs';
import { join, resolve } from 'path';

const STORAGE_DIR = resolve(process.cwd(), 'storage');

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const body = await req.json();

    if (body.displayName !== undefined || body.role !== undefined) {
      updateUser(id, {
        display_name: body.displayName,
        role: body.role,
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
    const admin = await requireAdmin(req);
    const { id } = await params;

    if (id === admin.userId) {
      return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
    }

    const user = getUserById(id);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
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
