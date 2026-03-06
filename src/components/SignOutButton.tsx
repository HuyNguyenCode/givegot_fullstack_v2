'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

interface SignOutButtonProps {
  variant?: 'default' | 'dev'
}

export function SignOutButton({ variant = 'default' }: SignOutButtonProps) {
  const router = useRouter()
  const { isDevMode, signOutDev } = useUser()
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    try {
      if (isDevMode) {
        signOutDev()
        router.push('/')
      } else {
        await signOut({ callbackUrl: '/auth/signin' })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const baseClasses = 'flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variantClasses =
    variant === 'dev'
      ? 'text-white/90 hover:text-red-200 bg-white/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg'
      : 'text-gray-600 hover:text-red-600'

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isLoading}
      className={`${baseClasses} ${variantClasses}`}
      title="Sign out"
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      <span className="text-sm font-medium">{isLoading ? 'Signing out...' : 'Sign out'}</span>
    </button>
  )
}
