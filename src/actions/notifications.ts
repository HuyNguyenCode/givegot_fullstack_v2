'use server'

import { prisma } from '@/lib/prisma'
import { NotificationType } from '@prisma/client'
import { revalidatePath } from 'next/cache'

// ==========================================
// NOTIFICATION CREATION (Internal utility)
// ==========================================

/**
 * Creates a notification for a user.
 * Called internally by other server actions — not a direct client call.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  link?: string
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type, link },
    })
  } catch (error) {
    // Non-fatal: notification failure must never break the primary action
    console.error('[Notification] Failed to create notification:', error)
  }
}

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
    return await prisma.notification.findMany({
      where: { userId },
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
    return await prisma.notification.count({
      where: { userId, isRead: false },
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
    await prisma.notification.updateMany({
      where: { id: notificationId, userId },
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
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('[Notification] Failed to mark all as read:', error)
    return { success: false }
  }
}
