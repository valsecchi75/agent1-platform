import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireDeptAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { createUser, getDb } from '@/lib/db';
import type { CreateUserInput } from '@/lib/db-types';

interface UserWithDept {
  userId: string;
  username: string;
  displayName: string | null;
  role: 'admin' | 'dept_admin' | 'user';
  departmentId: string | null;
  departmentName: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  totalCost: number;
  generationCount: number;
}

/**
 * GET /api/admin/users
 * List users with department names and spending stats
 * Admin: all users; dept_admin: own department only
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireDeptAdmin(req);
    const db = getDb();

    let query = `
      SELECT
        u.id as userId,
        u.username,
        u.display_name as displayName,
        u.role,
        u.department_id as departmentId,
        d.name as departmentName,
        u.created_at as createdAt,
        u.last_login_at as lastLoginAt,
        COALESCE(SUM(g.cost_usd), 0) as totalCost,
        COUNT(g.id) as generationCount
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN generations g ON g.user_id = u.id AND g.is_deleted = 0
    `;

    const params: unknown[] = [];

    // If dept_admin, filter to own department only
    if (user.role === 'dept_admin') {
      query += ' WHERE u.department_id = ?';
      params.push(user.departmentId);
    }

    query += ' GROUP BY u.id, u.username, u.display_name, u.role, u.department_id, d.name, u.created_at, u.last_login_at';
    query += ' ORDER BY u.created_at DESC';

    const users = db.prepare(query).all(...params) as UserWithDept[];

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Create user with optional departmentId (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    let body: CreateUserInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.username || typeof body.username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    if (!body.password || typeof body.password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    const userId = await createUser(body);
    return NextResponse.json({ id: userId, success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
