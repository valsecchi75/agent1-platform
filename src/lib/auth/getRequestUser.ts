import { NextRequest } from 'next/server';
import { verifyToken } from './jwt';

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export interface RequestUser {
  userId: string;
  username: string;
  role: 'admin' | 'dept_admin' | 'user';
  departmentId?: string | null;
}

export async function getRequestUser(req: NextRequest): Promise<RequestUser> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) {
    throw new AuthError('Not authenticated', 401);
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.authenticated || !payload.userId) {
    throw new AuthError('Invalid or incomplete token', 401);
  }

  return {
    userId: payload.userId as string,
    username: (payload.username as string) || '',
    role: (payload.role as 'admin' | 'dept_admin' | 'user') || 'user',
    departmentId: (payload.departmentId as string) || null,
  };
}

export async function requireAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin') {
    throw new AuthError('Admin access required', 403);
  }
  return user;
}

export async function requireDeptAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin' && user.role !== 'dept_admin') {
    throw new AuthError('Department admin access required', 403);
  }
  return user;
}

export async function requireDepartmentAccess(req: NextRequest, _departmentId: string): Promise<RequestUser> {
  // For now: any authenticated user has access; admins always have access.
  const user = await getRequestUser(req);
  return user;
}
