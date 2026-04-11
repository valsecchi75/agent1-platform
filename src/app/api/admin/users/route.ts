import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser, AuthError } from '@/lib/auth/getRequestUser';
import { listUsers, createUser } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (user.role !== 'admin' && user.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    let users = listUsers();

    // dept_admin sees only own department
    if (user.role === 'dept_admin' && user.departmentId) {
      users = users.filter(u => u.department_id === user.departmentId);
    }

    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getRequestUser(req);
    if (user.role !== 'admin' && user.role !== 'dept_admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { username, password, displayName, role, departmentId } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    // dept_admin can only create users in own department
    if (user.role === 'dept_admin') {
      if (role === 'admin') {
        return NextResponse.json({ error: 'Cannot create admin users' }, { status: 403 });
      }
      // Force new user into dept_admin's department
      const userId = await createUser({
        username,
        password,
        displayName: displayName || username,
        role: role || 'user',
        departmentId: user.departmentId || undefined,
      });
      return NextResponse.json({ userId }, { status: 201 });
    }

    // Global admin can create in any department
    try {
      const userId = await createUser({
        username,
        password,
        displayName: displayName || username,
        role: role || 'user',
        departmentId,
      });
      return NextResponse.json({ userId }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('UNIQUE')) {
        return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
