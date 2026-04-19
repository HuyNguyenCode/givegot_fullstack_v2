'use client'

import { useUser } from '@/contexts/UserContext'
import Image from 'next/image'
import Link from 'next/link'
import { SignOutButton } from './SignOutButton'
import { NotificationBell } from './NotificationBell'

/**
 * Header shown in production mode (when DevBar is hidden).
 * Displays user info, notification bell, and Sign Out.
 * Renders nothing when no user (e.g. on sign-in page).
 */
export function ProductionHeader() {
  const { currentUser, isDevMode } = useUser()

  if (isDevMode || !currentUser) {
    return null
  }

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <Link href="/homepage" className="font-bold text-purple-600 hover:text-purple-700 text-lg">
          GiveGot
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/dashboard"
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/history"
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            History
          </Link>

          {/* Notification Bell */}
          <NotificationBell userId={currentUser.id} />

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <Link
            href="/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-gray-700 hover:text-gray-900 hover:bg-gray-100 transition-colors"
          >
            {currentUser.avatarUrl ? (
              <Image
                src={currentUser.avatarUrl}
                alt={currentUser.name || 'User'}
                width={26}
                height={26}
                className="rounded-full ring-1 ring-gray-200"
              />
            ) : (
              <span className="w-[26px] h-[26px] rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold">
                {(currentUser.name || currentUser.email || '?')[0].toUpperCase()}
              </span>
            )}
            <span className="text-sm font-medium">{currentUser.name || currentUser.email}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {currentUser.givePoints} pts
            </span>
          </Link>
          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
