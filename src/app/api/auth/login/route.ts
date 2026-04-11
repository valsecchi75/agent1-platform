import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth/jwt';

// Dynamic import of db module — better-sqlite3 is a native C++ module
// that may fail if not compiled for this platform. Login must still
// work via .env fallback even if the database is unavailable.
let dbModule: typeof import('@/lib/db') | null = null;
try {
  dbModule = require('@/lib/db');
} catch {
  console.warn('[auth] SQLite module not available — using .env auth only. Run: npm rebuild better-sqlite3');
}

// In-memory rate limiting (resets on server restart)
const failedAttempts = new Map<string, { count: number; firstAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIP(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const record = failedAttempts.get(ip);
  if (!record) return false;
  if (Date.now() - record.firstAttempt > WINDOW_MS) {
    failedAttempts.delete(ip);
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string): void {
  const record = failedAttempts.get(ip);
  if (!record || Date.now() - record.firstAttempt > WINDOW_MS) {
    failedAttempts.set(ip, { count: 1, firstAttempt: Date.now() });
  } else {
    record.count++;
  }
}

/** Parse AUTH_USERS env var: "user1:pass1,user2:pass2" */
function getAuthUsers(): Map<string, string> {
  const raw = process.env.AUTH_USERS || '';
  const users = new Map<string, string>();
  for (const pair of raw.split(',')) {
    const [user, pass] = pair.split(':');
    if (user && pass) users.set(user.trim(), pass.trim());
  }
  return users;
}

/** Timing-safe string comparison */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export async function POST(req: NextRequest) {
  const ip = getClientIP(req);

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Try again later.' },
      { status: 429 }
    );
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { username, password } = body;

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Username and password are required' },
      { status: 400 }
    );
  }

  // Try database authentication first (if SQLite is available)
  if (dbModule) {
    try {
      await dbModule.seedAdminIfEmpty();
      const dbUser = await dbModule.authenticateUser(username, password);

      if (dbUser) {
        failedAttempts.delete(ip);

        // Look up department info for JWT payload
        let departmentId: string | null = null;
        let departmentName: string | null = null;
        if (dbUser.department_id) {
          try {
            const { getDepartmentById } = await import('@/lib/departments');
            const dept = getDepartmentById(dbUser.department_id);
            if (dept) {
              departmentId = dept.id;
              departmentName = dept.name;
            }
          } catch {
            // departments module may not be available yet
          }
        }

        const token = await signToken({ authenticated: true, username: dbUser.username, userId: dbUser.id, role: dbUser.role, departmentId, departmentName });

        const response = NextResponse.json({ success: true });
        response.cookies.set('agent1_session', token, {
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          secure: false,
          maxAge: 60 * 60 * 24 * 7,
        });

        return response;
      }

      // DB is available but credentials are wrong — do NOT fall through to .env
      recordFailure(ip);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    } catch (dbError) {
      // DB module loaded but threw (e.g. corrupt DB) — fall through to .env
      console.warn('[auth] DB unavailable, falling back to .env:', dbError);
    }
  }

  // Fall back to .env-based authentication ONLY when DB is unavailable
  const authUsers = getAuthUsers();

  if (authUsers.size === 0) {
    return NextResponse.json(
      { error: 'Server not configured. Set AUTH_USERS in .env' },
      { status: 500 }
    );
  }

  // Find user and verify credentials (timing-safe)
  const storedPassword = authUsers.get(username);
  const isValid = storedPassword !== undefined && safeCompare(password, storedPassword);

  if (!isValid) {
    recordFailure(ip);
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  // Clear failed attempts on success
  failedAttempts.delete(ip);

  // Env-auth: create or retrieve DB user record
  let envUser: { id: string; username: string; role: string } | null = null;
  if (dbModule) {
    try {
      envUser = dbModule.getUserByUsername(username) || null;
      if (!envUser) {
        const userId = await dbModule.createUser({
          username,
          password,
          displayName: username,
          role: username === 'admin' ? 'admin' : 'user',
        });
        envUser = dbModule.getUserById(userId);
      }
    } catch (err) {
      console.warn('[auth] Could not create/get DB user for env auth:', err);
    }
  }

  // Look up department info for env-auth users too
  let envDepartmentId: string | null = null;
  let envDepartmentName: string | null = null;
  if (envUser && (envUser as Record<string, unknown>).department_id) {
    try {
      const { getDepartmentById } = await import('@/lib/departments');
      const dept = getDepartmentById((envUser as Record<string, unknown>).department_id as string);
      if (dept) {
        envDepartmentId = dept.id;
        envDepartmentName = dept.name;
      }
    } catch {
      // departments module may not be available yet
    }
  }

  const token = await signToken({
    authenticated: true,
    username,
    ...(envUser ? { userId: envUser.id, role: envUser.role } : {}),
    departmentId: envDepartmentId,
    departmentName: envDepartmentName,
  });

  const response = NextResponse.json({ success: true });
  response.cookies.set('agent1_session', token, {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: false,
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
