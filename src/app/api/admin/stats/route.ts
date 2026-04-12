import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { getDb } from '@/lib/db';

/**
 * GET /api/admin/stats
 * System-wide statistics for admin dashboard
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    const db = getDb();

    // Total users
    const usersRow = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };

    // Total departments
    const deptsRow = db.prepare('SELECT COUNT(*) as count FROM departments').get() as { count: number };

    // Total generations (non-deleted)
    const gensRow = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(cost_usd), 0) as totalCost FROM generations WHERE is_deleted = 0').get() as { count: number; totalCost: number };

    // Total API calls
    const callsRow = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(cost_usd), 0) as totalCost FROM api_calls').get() as { count: number; totalCost: number };

    // Spend by department (this month)
    const deptSpend = db.prepare(`
      SELECT
        d.id,
        d.name,
        d.budget_monthly as budgetMonthly,
        d.budget_used as budgetUsed,
        COUNT(DISTINCT u.id) as memberCount,
        COUNT(g.id) as generationCount
      FROM departments d
      LEFT JOIN users u ON u.department_id = d.id
      LEFT JOIN generations g ON g.user_id = u.id AND g.is_deleted = 0
      GROUP BY d.id
      ORDER BY d.name
    `).all() as Array<{
      id: string;
      name: string;
      budgetMonthly: number;
      budgetUsed: number;
      memberCount: number;
      generationCount: number;
    }>;

    // Top spenders (users with highest cost)
    const topSpenders = db.prepare(`
      SELECT
        u.id as userId,
        u.username,
        u.display_name as displayName,
        d.name as departmentName,
        COALESCE(SUM(g.cost_usd), 0) as totalCost,
        COUNT(g.id) as generationCount
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN generations g ON g.user_id = u.id AND g.is_deleted = 0
      GROUP BY u.id
      ORDER BY totalCost DESC
      LIMIT 10
    `).all() as Array<{
      userId: string;
      username: string;
      displayName: string | null;
      departmentName: string | null;
      totalCost: number;
      generationCount: number;
    }>;

    // Cost by provider
    const costByProvider = db.prepare(`
      SELECT provider, COUNT(*) as count, COALESCE(SUM(cost_usd), 0) as totalCost
      FROM api_calls
      GROUP BY provider
      ORDER BY totalCost DESC
    `).all() as Array<{ provider: string; count: number; totalCost: number }>;

    // Cost by model (top 10)
    const costByModel = db.prepare(`
      SELECT model, provider, COUNT(*) as count, COALESCE(SUM(cost_usd), 0) as totalCost
      FROM api_calls
      GROUP BY model, provider
      ORDER BY totalCost DESC
      LIMIT 10
    `).all() as Array<{ model: string; provider: string; count: number; totalCost: number }>;

    return NextResponse.json({
      totalUsers: usersRow.count,
      totalDepartments: deptsRow.count,
      totalGenerations: gensRow.count,
      totalSpend: callsRow.totalCost,
      averageCostPerGeneration: gensRow.count > 0 ? callsRow.totalCost / gensRow.count : 0,
      departmentSpend: deptSpend,
      topSpenders,
      costByProvider,
      costByModel,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Stats error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
