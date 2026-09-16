import type { NotificationType } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/**
 * Internal notification writer. This module is deliberately not a server
 * action boundary, so clients cannot choose arbitrary recipients or content.
 */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  link?: string,
): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, title, message, type, link },
    })
  } catch (error) {
    // Non-fatal: notification failure must never break the primary action.
    console.error('[Notification] Failed to create notification:', error)
  }
}
