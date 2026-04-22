'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// ── Types ─────────────────────────────────────────────────────────────────────

export type WithdrawRequestWithMentor = {
  id: string
  mentorId: string
  pointsRequested: number
  fiatAmount: number
  bankDetails: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: Date
  updatedAt: Date
  mentor: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

/**
 * Fetch all withdrawal requests ordered newest-first.
 * Includes the mentor's profile so the admin table can display name + email.
 */
export async function getWithdrawRequests(): Promise<WithdrawRequestWithMentor[]> {
  try {
    const requests = await db.withdrawRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        mentor: {
          select: {
            id:        true,
            name:      true,
            email:     true,
            avatarUrl: true,
          },
        },
      },
    })
    return requests as WithdrawRequestWithMentor[]
  } catch (error) {
    console.error('[AdminFinance] getWithdrawRequests error:', error)
    return []
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

/**
 * Approve or reject a withdrawal request.
 *
 * For APPROVED: the points were already debited from the mentor's wallet when
 * the request was created (see `createWithdrawRequest` in wallet.ts), so we
 * only need to flip the status here — no additional ledger writes required.
 *
 * For REJECTED: an admin refund action (crediting points back) is a separate
 * concern handled outside this function for explicitness and audit clarity.
 */
export async function updateWithdrawStatus(
  requestId: string,
  newStatus: 'APPROVED' | 'REJECTED',
): Promise<{ success: boolean; message: string }> {
  if (!requestId) {
    return { success: false, message: 'requestId is required.' }
  }

  try {
    const existing = await db.withdrawRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true },
    })

    if (!existing) {
      return { success: false, message: 'Withdrawal request not found.' }
    }

    if (existing.status !== 'PENDING') {
      return {
        success: false,
        message: `Request is already ${existing.status}. Only PENDING requests can be updated.`,
      }
    }

    await db.withdrawRequest.update({
      where: { id: requestId },
      data:  { status: newStatus },
    })

    revalidatePath('/admin/finance')

    return {
      success: true,
      message: `Request ${requestId} has been ${newStatus.toLowerCase()}.`,
    }
  } catch (error) {
    console.error('[AdminFinance] updateWithdrawStatus error:', error)
    return { success: false, message: 'Failed to update status. Please try again.' }
  }
}
