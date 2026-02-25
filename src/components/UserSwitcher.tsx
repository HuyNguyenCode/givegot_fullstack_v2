'use client'

import { useUser } from '@/contexts/UserContext'
import Image from 'next/image'

export function UserSwitcher() {
  const { currentUser, allUsers, switchUser, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="bg-yellow-100 border-b-2 border-yellow-400 px-4 py-2">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm text-yellow-800">Loading users...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-r from-purple-600 to-blue-600 border-b-2 border-purple-700 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-white bg-black/20 px-2 py-1 rounded">
            DEV MODE
          </span>
          <span className="text-sm font-medium text-white">
            Logged in as:
          </span>
          {currentUser && (
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-lg">
              {currentUser.avatarUrl && (
                <Image
                  src={currentUser.avatarUrl}
                  alt={currentUser.name || 'User'}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span className="font-semibold text-white">
                {currentUser.name || currentUser.email}
              </span>
              <span className="text-xs text-white/70">
                ({currentUser.givePoints} pts)
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/profile"
            className="text-white/90 hover:text-white transition flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg"
            title="Edit Profile"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-sm font-medium hidden sm:inline">Profile</span>
          </a>
          
          <label htmlFor="user-select" className="text-sm font-medium text-white">
            Switch User:
          </label>
          <select
            id="user-select"
            value={currentUser?.id || ''}
            onChange={(e) => switchUser(e.target.value)}
            className="px-3 py-1.5 rounded-lg border-2 border-white/20 bg-white/10 text-white font-medium focus:outline-none focus:ring-2 focus:ring-white/50 cursor-pointer"
          >
            {allUsers.map((user) => (
              <option key={user.id} value={user.id} className="text-black">
                {user.name || user.email} - {user.givePoints} pts
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  )
}
