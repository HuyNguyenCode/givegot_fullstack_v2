'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@/types'
import { getAllUsers, getUserById } from '@/actions/user'

interface UserContextType {
  currentUser: User | null
  allUsers: User[]
  switchUser: (userId: string) => void
  refreshUser: () => Promise<void>
  signOutDev: () => void
  isLoading: boolean
  isDevMode: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDevMode, setIsDevMode] = useState(false)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if DevBar is enabled
        const devBarEnabled = process.env.NEXT_PUBLIC_SHOW_DEV_BAR === 'true'
        setIsDevMode(devBarEnabled)

        const users = await getAllUsers()
        setAllUsers(users)
        
        // ✨ DevBar Mode: Use localStorage override
        if (devBarEnabled) {
          const savedUserId = localStorage.getItem('mockUserId')
          
          if (savedUserId) {
            const user = await getUserById(savedUserId)
            if (user) {
              setCurrentUser(user)
            } else if (users.length > 0) {
              setCurrentUser(users[0])
              localStorage.setItem('mockUserId', users[0].id)
            }
          } else if (users.length > 0) {
            setCurrentUser(users[0])
            localStorage.setItem('mockUserId', users[0].id)
          }
        } else {
          // ✨ Production Mode: Use NextAuth session
          // In production, the session will be fetched from NextAuth
          // For now, we'll fetch from server action that reads the session
          const response = await fetch('/api/auth/session')
          const session = await response.json()
          
          if (session?.user?.email) {
            // Find user by email from NextAuth session
            const user = users.find(u => u.email === session.user.email)
            if (user) {
              setCurrentUser(user)
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()
  }, [])

  const refreshUser = async () => {
    if (!currentUser) return
    
    try {
      const user = await getUserById(currentUser.id)
      if (user) {
        setCurrentUser(user)
      }
    } catch (error) {
      console.error('Error refreshing user:', error)
    }
  }

  const switchUser = async (userId: string) => {
    // ✨ DevBar override: Switch user in dev mode
    if (!isDevMode) {
      console.warn('User switching is only available in dev mode')
      return
    }

    setIsLoading(true)
    try {
      const user = await getUserById(userId)
      if (user) {
        setCurrentUser(user)
        localStorage.setItem('mockUserId', userId)
      }
    } catch (error) {
      console.error('Error switching user:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const signOutDev = () => {
    if (!isDevMode) return
    localStorage.removeItem('mockUserId')
    setCurrentUser(null)
  }

  return (
    <UserContext.Provider value={{ currentUser, allUsers, switchUser, refreshUser, signOutDev, isLoading, isDevMode }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}
