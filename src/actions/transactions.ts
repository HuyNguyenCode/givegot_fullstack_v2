'use server'

import { prisma } from '@/lib/prisma'

export async function getUserTransactions(userId: string) {
  try {
    const transactions = await prisma.transactionLog.findMany({
      where: { userId },
      include: {
        booking: {
          include: {
            mentor: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
            mentee: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return transactions
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return []
  }
}

export async function getUserBookingHistory(userId: string) {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { mentorId: userId },
          { menteeId: userId },
        ],
      },
      include: {
        mentor: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        mentee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
        slot: true,
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return bookings
  } catch (error) {
    console.error('Error fetching booking history:', error)
    return []
  }
}

export async function getTransactionSummary(userId: string) {
  try {
    const transactions = await prisma.transactionLog.findMany({
      where: { userId },
      select: {
        amount: true,
        type: true,
      },
    })

    const totalEarned = transactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0)

    const totalSpent = transactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0)

    const bookingsCreated = transactions.filter(t => t.type === 'BOOKING_CREATED').length
    const sessionsCompleted = transactions.filter(t => t.type === 'BOOKING_COMPLETED').length
    const refundsReceived = transactions.filter(
      t => t.type === 'BOOKING_CANCELLED' || t.type === 'BOOKING_DECLINED'
    ).length

    return {
      totalEarned,
      totalSpent,
      bookingsCreated,
      sessionsCompleted,
      refundsReceived,
    }
  } catch (error) {
    console.error('Error fetching transaction summary:', error)
    return {
      totalEarned: 0,
      totalSpent: 0,
      bookingsCreated: 0,
      sessionsCompleted: 0,
      refundsReceived: 0,
    }
  }
}
