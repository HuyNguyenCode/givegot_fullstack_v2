'use client'

import { useUser } from '@/contexts/UserContext'
import Image from 'next/image'
import Link from 'next/link'
import { SignOutButton } from './SignOutButton'

/**
 * Header shown in production mode (when DevBar is hidden).
 * Displays user info and Sign Out. Renders nothing when no user (e.g. on sign-in page).
 */
export function ProductionHeader() {
  const { currentUser, isDevMode } = useUser()

  if (isDevMode || !currentUser) {
    return null
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/" className="font-bold text-purple-600 hover:text-purple-700">
          GiveGot
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            Dashboard
          </Link>
          <Link
            href="/history"
            className="text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            History
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
          >
            {currentUser.avatarUrl && (
              <Image
                src={currentUser.avatarUrl}
                alt={currentUser.name || 'User'}
                width={28}
                height={28}
                className="rounded-full"
              />
            )}
            <span className="text-sm font-medium">{currentUser.name || currentUser.email}</span>
            <span className="text-xs text-gray-500">({currentUser.givePoints} pts)</span>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
