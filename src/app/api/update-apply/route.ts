import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { applyUpdate, getIsUpdating, isAllowedDownloadUrl, type UpdateProgress } from '@/lib/update/updateEngine';

export const maxDuration = 600; // 10 minute timeout for long updates

/** Verify JWT session cookie — returns false if not authenticated */
async function checkAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload !== null && payload.authenticated === true;
}

function sseError(error: string, status: number) {
  return new Response(
    `data: ${JSON.stringify({ done: true, success: false, error })}\n\n`,
    { status, headers: { 'Content-Type': 'text/event-stream' } }
  );
}

export async function POST(req: NextRequest) {
  // Auth check — update-apply requires authenticated user
  if (!(await checkAuth(req))) {
    return sseError('Unauthorized', 401);
  }

  // Mutex check
  if (getIsUpdating()) {
    return sseError('Update already in progress', 409);
  }

  let body: { downloadUrl?: string };
  try {
    body = await req.json();
  } catch {
    return sseError('Invalid request body', 400);
  }

  const { downloadUrl } = body;
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    return sseError('Missing downloadUrl', 400);
  }

  // Security: validate download URL against allowed hosts (GitHub only)
  if (!isAllowedDownloadUrl(downloadUrl)) {
    return sseError('URL di download non autorizzato. Solo GitHub è consentito.', 400);
  }

  // SSE stream with heartbeat to keep connection alive
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Heartbeat every 15s to prevent proxy/load-balancer timeout
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      const sendProgress = (progress: UpdateProgress) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
          );
        } catch { /* stream may be closed */ }
      };

      try {
        await applyUpdate(downloadUrl, sendProgress);
      } finally {
        clearInterval(heartbeat);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
