'use client'

import { useUser } from '@/contexts/UserContext'
import Image from 'next/image'
import Link from 'next/link'
import { Wallet } from 'lucide-react'
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
          <Link
            href="/chat"
            className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Messages
          </Link>

          {/* Notification Bell */}
          <NotificationBell userId={currentUser.id} />

          <div className="w-px h-5 bg-gray-200 mx-2" />

          {/* Balance pill — primary entry point to /wallet */}
          <Link
            href="/wallet"
            className="group flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-full text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition-all duration-150"
            title="My Wallet"
          >
            <Wallet className="w-3.5 h-3.5 text-purple-500 group-hover:text-purple-700 transition-colors" />
            <span className="text-xs font-bold tabular-nums">
              {currentUser.givePoints.toLocaleString()} pts
            </span>
          </Link>

          {/* Avatar + name → profile */}
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
          </Link>

          <SignOutButton />
        </div>
      </div>
    </header>
  )
}
