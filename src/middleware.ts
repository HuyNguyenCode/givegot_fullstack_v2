import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

// NOTE: Do NOT import `prisma` here. Middleware runs in the Edge Runtime
// which has no access to Node.js APIs (TCP, crypto, etc.) that Prisma needs.
// Suspension checks are handled in src/app/layout.tsx (Node.js server component).

const isDevMode = process.env.NEXT_PUBLIC_SHOW_DEV_BAR === 'true'

// Paths that must always be accessible without any auth or suspension check
const PUBLIC_PATHS = ['/', '/auth/signin', '/suspended']

function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron')
  )
}

export default auth(async (req) => {
  // ── Dev mode: bypass all checks ──────────────────────────────────────────
  if (isDevMode) {
    return withPathname(req)
  }

  const { pathname } = req.nextUrl

  // ── Public paths: always allow through ───────────────────────────────────
  if (isPublicPath(pathname)) {
    // If an authenticated user hits the root landing page, redirect to app
    if (pathname === '/' && req.auth) {
      return NextResponse.redirect(new URL('/homepage', req.url))
    }
    return withPathname(req)
  }

  // ── Unauthenticated user on a protected route ─────────────────────────────
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(signInUrl)
  }

  // ── Authenticated: proceed to the page ───────────────────────────────────
  // The suspension check (which needs Prisma / Node.js) is done in layout.tsx.
  return withPathname(req)
})

/**
 * Returns a NextResponse.next() with the current pathname injected as a
 * *request* header. Server Component layouts read it via `headers()` from
 * `next/headers` — this is the standard Next.js pattern for passing middleware
 * context downstream without the Edge ↔ Node.js boundary.
 *
 * Note: only call this for next() responses, not for redirects (redirects
 * skip the layout render so the header is irrelevant there).
 */
function withPathname(req: Request): NextResponse {
  const pathname = new URL(req.url).pathname
  const reqHeaders = new Headers(req.headers)
  reqHeaders.set('x-pathname', pathname)
  return NextResponse.next({ request: { headers: reqHeaders } })
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public static assets (svg, png, jpg, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
