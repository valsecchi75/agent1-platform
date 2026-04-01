import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';
import { applyUpdate, getIsUpdating, type UpdateProgress } from '@/lib/update/updateEngine';

export const maxDuration = 600; // 10 minute timeout for long updates

/** Verify JWT session cookie — returns false if not authenticated */
async function checkAuth(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get('agent1_session')?.value;
  if (!token) return false;
  const payload = await verifyToken(token);
  return payload !== null && payload.authenticated === true;
}

export async function POST(req: NextRequest) {
  // Auth check — update-apply requires authenticated user
  if (!(await checkAuth(req))) {
    return new Response(
      `data: ${JSON.stringify({ done: true, success: false, error: 'Unauthorized' })}\n\n`,
      {
        status: 401,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }

  // Mutex check
  if (getIsUpdating()) {
    return new Response(
      `data: ${JSON.stringify({ done: true, success: false, error: 'Update already in progress' })}\n\n`,
      {
        status: 409,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }

  let body: { downloadUrl?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      `data: ${JSON.stringify({ done: true, success: false, error: 'Invalid request body' })}\n\n`,
      {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }

  const { downloadUrl } = body;
  if (!downloadUrl || typeof downloadUrl !== 'string') {
    return new Response(
      `data: ${JSON.stringify({ done: true, success: false, error: 'Missing downloadUrl' })}\n\n`,
      {
        status: 400,
        headers: { 'Content-Type': 'text/event-stream' },
      }
    );
  }

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendProgress = (progress: UpdateProgress) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(progress)}\n\n`)
          );
        } catch { /* stream may be closed */ }
      };

      await applyUpdate(downloadUrl, sendProgress);
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
