import { NextRequest } from 'next/server';
import { verifyToken } from './jwt';

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

export interface RequestUser {
  userId: string;
  username: string;
  role: 'admin' | 'dept_admin' | 'user';
  departmentId: string | null;
  departmentName: string | null;
}

export async function getRequestUser(req: NextRequest): Promise<RequestUser> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) {
    throw new AuthError(401, 'Not authenticated');
  }

  const payload = await verifyToken(token);
  if (!payload || !payload.authenticated || !payload.userId) {
    throw new AuthError(401, 'Invalid or incomplete token');
  }

  return {
    userId: payload.userId as string,
    username: (payload.username as string) || '',
    role: (payload.role as RequestUser['role']) || 'user',
    departmentId: (payload.departmentId as string) || null,
    departmentName: (payload.departmentName as string) || null,
  };
}

export async function requireAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin') {
    throw new AuthError(403, 'Admin access required');
  }
  return user;
}

export async function requireDeptAdmin(req: NextRequest): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role !== 'admin' && user.role !== 'dept_admin') {
    throw new AuthError(403, 'Department admin access required');
  }
  return user;
}

export async function requireDepartmentAccess(req: NextRequest, departmentId: string): Promise<RequestUser> {
  const user = await getRequestUser(req);
  if (user.role === 'admin') return user; // Admin sees all
  if (user.departmentId === departmentId) return user; // Same department
  throw new AuthError(403, 'Access denied to this department');
}
