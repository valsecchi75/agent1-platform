import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, requireDeptAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { createDepartment } from '@/lib/departments';
import { getDb } from '@/lib/db';
import type { CreateDepartmentInput } from '@/lib/db-types';

/**
 * GET /api/admin/departments
 * List all departments with budget status and member counts
 * Admin: all departments; dept_admin: own department only
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireDeptAdmin(req);
    const db = getDb();

    let query = `
      SELECT
        d.*,
        COUNT(DISTINCT u.id) as member_count,
        COALESCE(SUM(CASE WHEN g.is_deleted = 0 THEN g.cost_usd ELSE 0 END), 0) as total_spend
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      LEFT JOIN generations g ON g.user_id = u.id
    `;

    const params: unknown[] = [];

    if (user.role === 'dept_admin') {
      query += ' WHERE d.id = ?';
      params.push(user.departmentId);
    }

    query += ' GROUP BY d.id ORDER BY d.created_at DESC';

    const departments = db.prepare(query).all(...params) as Array<{
      id: string;
      name: string;
      description: string | null;
      budget_monthly: number;
      budget_warning_threshold: number;
      budget_soft_limit: number;
      budget_used: number;
      budget_period_start: string;
      created_at: string;
      updated_at: string;
      member_count: number;
      total_spend: number;
    }>;

    // Format for frontend
    const formatted = departments.map(d => ({
      id: d.id,
      name: d.name,
      description: d.description,
      budgetMonthly: d.budget_monthly,
      budgetUsed: d.budget_used,
      warningThreshold: d.budget_warning_threshold,
      softLimitDollars: d.budget_soft_limit,
      periodStart: d.budget_period_start,
      memberCount: d.member_count,
      totalSpend: d.total_spend,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    return NextResponse.json({ departments: formatted });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

/**
 * POST /api/admin/departments
 * Create a new department (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    let body: CreateDepartmentInput;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    // Convert warningThreshold from percentage (0-100) to ratio (0-1) if needed
    if (body.budgetWarningThreshold !== undefined && body.budgetWarningThreshold > 1) {
      body.budgetWarningThreshold = body.budgetWarningThreshold / 100;
    }

    const id = createDepartment(body);
    return NextResponse.json({ id, success: true }, { status: 201 });
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
