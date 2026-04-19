import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { UserProvider } from '@/contexts/UserContext'
import { UserSwitcher } from '@/components/UserSwitcher'
import { ProductionHeader } from '@/components/ProductionHeader'
import { SessionProvider } from '@/components/SessionProvider'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'GiveGot - Time Banking Mentorship',
  description: 'Teach 1 hour, earn 1 point. Learn from experts.',
}

// Paths where the suspension check must be skipped to avoid an infinite
// redirect loop or unnecessary DB queries for unauthenticated routes.
const SUSPENSION_CHECK_EXCLUDED = ['/suspended', '/', '/auth/signin']

function shouldSkipSuspensionCheck(pathname: string): boolean {
  return (
    SUSPENSION_CHECK_EXCLUDED.includes(pathname) ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api')
  )
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // ── Suspension guard (Node.js runtime — Prisma is safe here) ─────────────
  // We skip this in dev mode and for public/auth pages to avoid unnecessary
  // queries and to break the redirect loop on the /suspended page itself.
  const isDevMode = process.env.NEXT_PUBLIC_SHOW_DEV_BAR === 'true'

  if (!isDevMode) {
    // Read the pathname injected by middleware so we know which page is rendering
    const headersList = await headers()
    const pathname = headersList.get('x-pathname') ?? '/'

    if (!shouldSkipSuspensionCheck(pathname)) {
      const session = await auth()

      if (session?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          select: { isSuspended: true },
        })

        if (user?.isSuspended) {
          redirect('/suspended')
        }
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SessionProvider>
          <UserProvider>
            <UserSwitcher />
            <ProductionHeader />
            {children}
          </UserProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
