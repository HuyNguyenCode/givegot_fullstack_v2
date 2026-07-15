'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@/types'
import { getAllUsers, getUserById } from '@/actions/user'
import { useSession, signIn, signOut } from 'next-auth/react' // 1. Import NextAuth hooks

interface UserContextType {
  currentUser: User | null
  allUsers: User[]
  switchUser: (userId: string) => Promise<void>
  refreshUser: () => Promise<void>
  signOutDev: () => Promise<void>
  isLoading: boolean
  isDevMode: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

export function UserProvider({ children }: { children: React.ReactNode }) {
  // 2. Lấy trạng thái đăng nhập THẬT từ NextAuth
  const { data: session, status } = useSession() 
  
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [allUsers, setAllUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  
  // Dùng biến môi trường mặc định của Node để phân biệt Dev/Prod an toàn nhất
  const isDevMode = process.env.NODE_ENV !== 'production'

  // HIỆU ỨNG 1: Tải danh sách tất cả User (Chỉ dùng cho Dev Mode để hiện Dropdown)
  useEffect(() => {
    const fetchDropdownUsers = async () => {
      if (isDevMode) {
        try {
          const users = await getAllUsers()
          setAllUsers(users)
        } catch (error) {
          console.error('Lỗi khi tải danh sách user:', error)
        }
      }
    }
    fetchDropdownUsers()
  }, [isDevMode])

  // HIỆU ỨNG 2: Đồng bộ currentUser mỗi khi Session của NextAuth thay đổi
  useEffect(() => {
    const syncUserWithSession = async () => {
      if (status === 'loading') return // Đang kiểm tra token thì đợi

      if (session?.user?.id) {
        try {
          // Lấy data mới nhất của user từ DB dựa vào ID trong token
          const user = await getUserById(session.user.id)
          setCurrentUser(user || null)
        } catch (error) {
          console.error('Lỗi đồng bộ user:', error)
        }
      } else {
        // Không có session (chưa đăng nhập hoặc đã đăng xuất)
        setCurrentUser(null)
      }
      setIsLoading(false)
    }

    syncUserWithSession()
  }, [session, status])

  const refreshUser = async () => {
    if (!currentUser?.id) return
    try {
      const user = await getUserById(currentUser.id)
      if (user) setCurrentUser(user)
    } catch (error) {
      console.error('Lỗi làm mới user:', error)
    }
  }

  // 3. HÀM ĐỔI USER BẰNG "CỬA HẬU"
  const switchUser = async (userId: string) => {
    if (!isDevMode) return

    setIsLoading(true)
    try {
      // Gọi "ông bảo vệ dự bị" tên là impersonate
      await signIn('impersonate', {
        userId: userId,
        redirect: true,
        callbackUrl: window.location.pathname // Chuyển đổi xong thì ở yên tại trang hiện tại
      })
    } catch (error) {
      console.error('Lỗi chuyển user:', error)
      setIsLoading(false)
    }
  }

  // 4. HÀM ĐĂNG XUẤT ĐÚNG CHUẨN NEXTAUTH
  const signOutDev = async () => {
    if (!isDevMode) return
    await signOut({ redirect: true, callbackUrl: '/' })
  }

  return (
    <UserContext.Provider 
      value={{ 
        currentUser, 
        allUsers, 
        switchUser, 
        refreshUser, 
        signOutDev, 
        // Đang load nếu context tự load hoặc NextAuth đang check session
        isLoading: isLoading || status === 'loading', 
        isDevMode 
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser phải được bọc bên trong UserProvider')
  }
  return context
}