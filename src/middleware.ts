import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const isDevMode = process.env.NEXT_PUBLIC_SHOW_DEV_BAR === 'true'

export default auth(async (req) => {
  // DevMode: Skip all auth checks
  if (isDevMode) {
    return NextResponse.next()
  }

  const { pathname } = req.nextUrl

  // Allow public access to sign-in page and NextAuth API routes
  if (pathname === '/auth/signin' || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  // If authenticated user visits root, redirect to homepage
  if (pathname === '/' && req.auth) {
    return NextResponse.redirect(new URL('/homepage', req.url))
  }

  // Allow public access to landing page
  if (pathname === '/') {
    return NextResponse.next()
  }

  // No session and not on auth/public routes -> redirect to sign-in
  if (!req.auth) {
    const signInUrl = new URL('/auth/signin', req.url)
    signInUrl.searchParams.set('callbackUrl', pathname || '/homepage')
    return NextResponse.redirect(signInUrl)
  }

  // Check if user is suspended (except for admin routes)
  if (req.auth?.user?.email && !pathname.startsWith('/admin')) {
    try {
      const user = await prisma.user.findUnique({
        where: { email: req.auth.user.email },
        select: { isSuspended: true }
      })

      if (user?.isSuspended) {
        // Redirect suspended users to a suspended page or sign-in
        return NextResponse.redirect(new URL('/auth/signin?error=suspended', req.url))
      }
    } catch (error) {
      console.error('Failed to check suspension status:', error)
    }
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
