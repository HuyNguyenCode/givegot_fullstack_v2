'use server'

import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireAuthenticatedUser } from '@/lib/server-authorization'

// ==========================================
// NOTIFICATION QUERIES
// ==========================================

export type NotificationItem = {
  id: string
  title: string
  message: string
  type: NotificationType
  isRead: boolean
  link: string | null
  createdAt: Date
}

export async function getUserNotifications(userId: string): Promise<NotificationItem[]> {
  try {
    void userId
    const actor = await requireAuthenticatedUser()
    return await prisma.notification.findMany({
      where: { userId: actor.id },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        link: true,
        createdAt: true,
      },
    })
  } catch (error) {
    console.error('[Notification] Failed to fetch notifications:', error)
    return []
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  try {
    void userId
    const actor = await requireAuthenticatedUser()
    return await prisma.notification.count({
      where: { userId: actor.id, isRead: false },
    })
  } catch (error) {
    console.error('[Notification] Failed to count unread notifications:', error)
    return 0
  }
}

// ==========================================
// MARK AS READ
// ==========================================

export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<{ success: boolean }> {
  try {
    void userId
    const actor = await requireAuthenticatedUser()
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: actor.id },
      data: { isRead: true },
    })
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('[Notification] Failed to mark as read:', error)
    return { success: false }
  }
}

export async function markAllNotificationsAsRead(
  userId: string
): Promise<{ success: boolean }> {
  try {
    void userId
    const actor = await requireAuthenticatedUser()
    await prisma.notification.updateMany({
      where: { userId: actor.id, isRead: false },
      data: { isRead: true },
    })
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('[Notification] Failed to mark all as read:', error)
    return { success: false }
  }
}
