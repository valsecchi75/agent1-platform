import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { getDb } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin(req);
    const { id } = await params;
    const db = getDb();

    const generationCount = (db.prepare(
      'SELECT COUNT(*) as count FROM generations WHERE user_id = ?'
    ).get(id) as { count: number }).count;

    const totalCost = (db.prepare(
      'SELECT COALESCE(SUM(cost_usd), 0) as total FROM api_calls WHERE user_id = ?'
    ).get(id) as { total: number }).total;

    const costByProvider = db.prepare(
      'SELECT provider, SUM(cost_usd) as cost, COUNT(*) as calls FROM api_calls WHERE user_id = ? GROUP BY provider'
    ).all(id);

    return NextResponse.json({
      userId: id,
      generationCount,
      totalCost,
      costByProvider,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
