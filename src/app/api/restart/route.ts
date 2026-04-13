import { NextResponse } from 'next/server';

/**
 * POST /api/restart
 * Triggers a graceful server restart. The external process manager (start.bat/start.sh)
 * wraps the server in a loop and will relaunch after process.exit(0).
 */
export async function POST() {
  try {
    // Schedule exit after response is sent
    setTimeout(() => {
      console.log('[restart] Shutting down for restart...');
      process.exit(0);
    }, 500);

    return NextResponse.json({ success: true, message: 'Restarting...' });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to initiate restart' },
      { status: 500 }
    );
  }
}
