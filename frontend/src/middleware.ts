/**
 * PumpX — Next.js Middleware
 * Reads iron-session cookie and enforces authentication on protected routes.
 *
 * Protected routes:
 *   /dashboard, /markets, /live-markets, /analytics, /intelligence,
 *   /pumpscore, /heatmap, /leaderboard, /gamification, /hedge,
 *   /conditional, /supply, /assistant, /admin
 *
 * Public routes: /, /login, /register, /api/auth/*, /api/health
 */
import { type NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from './server/session';

const PROTECTED_PREFIXES = [
    '/dashboard',
    '/markets',
    '/live-markets',
    '/analytics',
    '/intelligence',
    '/pumpscore',
    '/heatmap',
    '/leaderboard',
    '/gamification',
    '/hedge',
    '/conditional',
    '/supply',
    '/assistant',
    '/admin',
];

const PUBLIC_PATHS = new Set(['/', '/login', '/register', '/markets/explore']);

function isProtected(pathname: string): boolean {
    if (pathname.startsWith('/api/')) return false; // API routes handle their own auth
    if (PUBLIC_PATHS.has(pathname)) return false;
    // Allow single-segment market detail routes like /markets/<id> and the explore page
    const parts = pathname.split('/').filter(Boolean);
    if (parts[0] === 'markets' && parts.length === 2) return false;

    return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

// NOTE: iron-session getIronSession requires Request/Response objects not
// available in Next.js middleware edge runtime directly. We use cookie parsing
// as a lightweight check and defer full verification to the API/page.
// For full edge-compatible session, upgrade to jose-based JWT in a future pass.
export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    if (!isProtected(pathname)) {
        return NextResponse.next();
    }

    // Read session cookie
    const sessionCookie = req.cookies.get('pumpx-session');
    if (!sessionCookie) {
        const loginUrl = new URL('/login', req.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Session cookie exists — allow through.
    // Individual pages / API routes use withAuth for full verification.
    // This prevents unauthenticated users from loading protected page JS bundles.
    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths EXCEPT:
         * - _next/static, _next/image (Next.js internals)
         * - favicon, images, public assets
         * - api routes (handle own auth)
         */
        '/((?!_next/static|_next/image|favicon.ico|public|images|fonts).*)',
    ],
};
