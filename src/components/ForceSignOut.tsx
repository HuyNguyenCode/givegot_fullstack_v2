'use client'

import { useEffect } from 'react'
import { signOut } from 'next-auth/react'

/**
 * Anti-Scam Auto-Suspension — Force Logout.
 *
 * Renders nothing. On mount, immediately clears the suspended user's
 * NextAuth session (without navigating away) so they can't keep using an
 * authenticated session in another tab while reading the warning message on
 * this page. `redirect: false` is critical here — a redirect would fight
 * with this page itself (which is the intended destination) and could loop.
 *
 * Purely additive: does not touch the existing `<SignOutButton />` already
 * rendered on this page, which remains as a manual fallback.
 */
export function ForceSignOut() {
  useEffect(() => {
    signOut({ redirect: false }).catch((error) => {
      console.error('[ForceSignOut] Failed to clear session:', error)
    })
  }, [])

  return null
}
