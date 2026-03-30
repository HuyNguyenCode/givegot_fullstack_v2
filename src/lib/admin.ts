import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * Check if the current user is an admin
 * Returns true if user is authenticated and has ADMIN role
 */
export async function isAdmin(): Promise<boolean> {
  try {
    const session = await auth()
    
    if (!session?.user?.email) {
      return false
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true }
    })

    return user?.role === 'ADMIN'
  } catch (error) {
    console.error('Failed to check admin status:', error)
    return false
  }
}

/**
 * Check if a user is suspended
 */
export async function isUserSuspended(email: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { isSuspended: true }
    })

    return user?.isSuspended || false
  } catch (error) {
    console.error('Failed to check suspension status:', error)
    return false
  }
}
