import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';

/**
 * POST /api/admin/restart
 * Restart the server (admin only)
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);

    // Schedule a graceful restart after response is sent
    setTimeout(() => {
      process.exit(0);
    }, 500);

    return NextResponse.json({ success: true, message: 'Server restarting...' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
