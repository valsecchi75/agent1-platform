import { NextResponse } from 'next/server';
import { getAppVersion } from '@/lib/nodePacks/appVersion';

/**
 * GET /api/health
 * Simple health check endpoint. Used by frontend to detect server restart completion.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    version: getAppVersion(),
    timestamp: new Date().toISOString(),
  });
}
