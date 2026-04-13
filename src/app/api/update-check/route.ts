import { NextRequest, NextResponse } from 'next/server';
import { checkForUpdates, clearUpdateCache } from '@/lib/update/versionCheck';

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
  const { searchParams } = new URL(req.url);
  const mock = searchParams.get('mock');    // available | error | uptodate
  const force = searchParams.get('force'); // bypass cache
  const mockVersion = searchParams.get('version') || '99.0.0-test';

  // ── Mock mode (dev / test) ─────────────────────────────────────────────────
  if (mock) {
    let currentVersion = '0.0.0';
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      currentVersion = (require('../../../../package.json') as { version: string }).version;
    } catch { /* ignore */ }

    if (mock === 'available') {
      return NextResponse.json({
        updateAvailable: true,
        currentVersion,
        latestVersion: mockVersion,
        releaseNotes: `## v${mockVersion}\n\n- Nuove funzionalità di test\n- Fix bug mockato\n- Miglioramenti UI`,
        // downloadUrl: null → "Aggiorna ora" mostrerà errore URL mancante (nessun download reale)
        downloadUrl: null,
        publishedAt: new Date().toISOString(),
        cachedAt: new Date().toISOString(),
        error: null,
        _mock: true,
      });
    }

    if (mock === 'error') {
      return NextResponse.json({
        updateAvailable: false,
        currentVersion,
        latestVersion: null,
        releaseNotes: null,
        downloadUrl: null,
        publishedAt: null,
        cachedAt: new Date().toISOString(),
        error: 'Token di autenticazione non valido (mock)',
        _mock: true,
      });
    }

    // mock=uptodate (default fallthrough)
    return NextResponse.json({
      updateAvailable: false,
      currentVersion,
      latestVersion: currentVersion,
      releaseNotes: null,
      downloadUrl: null,
      publishedAt: new Date().toISOString(),
      cachedAt: new Date().toISOString(),
      error: null,
      _mock: true,
    });
  }
  // ──────────────────────────────────────────────────────────────────────────

  // force=true → bypassa la cache in-memory
  if (force === 'true' || force === '1') {
    clearUpdateCache();
  }

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
