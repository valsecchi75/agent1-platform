import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/auth/jwt-edge';

// Routes that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/credits',
  '/api/auth',
  '/api/login-assets',
  '/api/update-check',
  '/_next',
  '/favicon.ico',
  '/brands/',
  '/login/',
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets
  if (pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|map)$/)) {
    return NextResponse.next();
  }

  // Check auth cookie
  const token = req.cookies.get('agent1_session')?.value;

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const payload = await verifyTokenEdge(token);
  if (!payload || !payload.authenticated) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Exclude all _next/* paths (static, images, HMR websocket) from middleware.
    // This prevents 404s on /_next/webpack-hmr and avoids unnecessary middleware
    // processing on internal Next.js infrastructure routes.
    '/((?!_next).*)',
  ],
};
