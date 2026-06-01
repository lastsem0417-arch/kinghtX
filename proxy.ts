import { NextRequest, NextResponse } from 'next/server';
import { decrypt } from '@/lib/session';

// ─── Route Definitions ────────────────────────────────────────────────────────

// ─── Route Definitions ────────────────────────────────────────────────────────

const AUTH_ROUTES = ['/login', '/register'];
const PROTECTED_PREFIXES = ['/dashboard', '/play', '/settings', '/puzzles'];

// ─── Proxy (replaces middleware in Next.js 16) ────────────────────────────────

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = request.cookies.get('knightx_session')?.value;
  const session = await decrypt(sessionCookie);
  const isAuthenticated = !!session;

  // If user is on an auth page but already logged in → send to dashboard
  if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // If user is on a protected route but NOT logged in → send to login
  const isProtectedRoute = PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix));
  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     * - API routes
     * - sounds folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public|api|sounds).*)',
  ],
};
