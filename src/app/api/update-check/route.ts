import { NextRequest, NextResponse } from 'next/server';
import { checkForUpdates } from '@/lib/update/versionCheck';

// Simple in-memory rate limiter: max 10 requests per minute per IP
const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW = 60 * 1000; // 1 minute

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) || []).filter(t => now - t < RATE_WINDOW);
  if (timestamps.length >= RATE_LIMIT) {
    rateMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a minute.' },
      { status: 429 }
    );
  }

  const result = await checkForUpdates();
  return NextResponse.json(result);
}
