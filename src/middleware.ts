import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

const isDevMode = process.env.NEXT_PUBLIC_SHOW_DEV_BAR === 'true'

export default auth((req) => {
  // DevMode: Skip all auth checks
  if (isDevMode) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Allow sign-in page and NextAuth API routes
  if (pathname === '/auth/signin' || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // No session and not on auth routes -> redirect to sign-in
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname || '/')
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - image/static file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
