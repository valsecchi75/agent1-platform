import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, AuthError } from '@/lib/auth/getRequestUser';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * GET /api/admin/system
 * System information (admin only)
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);

    // Read build info if available
    let buildInfo: Record<string, string> = {};
    try {
      const raw = readFileSync(join(process.cwd(), 'build-info.json'), 'utf-8');
      buildInfo = JSON.parse(raw);
    } catch {
      // build-info.json may not exist in dev
    }

    // Read package.json version
    let version = 'unknown';
    try {
      const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));
      version = pkg.version || 'unknown';
    } catch {
      // ignore
    }

    return NextResponse.json({
      version,
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      ...buildInfo,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
