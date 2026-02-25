'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@/types'
import { getAllUsers, getUserById } from '@/actions/user'

interface UserContextType {
  currentUser: User | null
  allUsers: User[]
  switchUser: (userId: string) => void
  refreshUser: () => Promise<void>
  isLoading: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const users = await getAllUsers()
        setAllUsers(users)
        
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

  return (
    <UserContext.Provider value={{ currentUser, allUsers, switchUser, refreshUser, isLoading }}>
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
