'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { isAdmin } from '@/lib/admin'

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
 * For REJECTED: status change, full point refund and immutable ledger entry
 * are committed in one database transaction. There is no separate refund step.
 */
export async function updateWithdrawStatus(
  requestId: string,
  newStatus: 'APPROVED' | 'REJECTED',
): Promise<{ success: boolean; message: string }> {
  if (!requestId) {
    return { success: false, message: 'requestId is required.' }
  }

  try {
    if (!(await isAdmin())) {
      return { success: false, message: 'Bạn không có quyền xử lý yêu cầu rút tiền.' }
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const request = await tx.withdrawRequest.findUnique({
        where: { id: requestId },
        select: { id: true, mentorId: true, pointsRequested: true, status: true },
      })

      if (!request) return { kind: 'NOT_FOUND' as const }
      if (request.status !== 'PENDING') {
        return { kind: 'ALREADY_PROCESSED' as const, status: request.status }
      }
      if (!Number.isInteger(request.pointsRequested) || request.pointsRequested <= 0) {
        throw new Error('Invalid pointsRequested on withdrawal request')
      }

      // Conditional transition is the idempotency/concurrency gate. If two
      // admins act at once, only the transaction that changes PENDING wins.
      const transitioned = await tx.withdrawRequest.updateMany({
        where: { id: requestId, status: 'PENDING' },
        data: { status: newStatus },
      })
      if (transitioned.count !== 1) {
        return { kind: 'CONCURRENTLY_PROCESSED' as const }
      }

      if (newStatus === 'REJECTED') {
        await tx.user.update({
          where: { id: request.mentorId },
          data: { givePoints: { increment: request.pointsRequested } },
        })
        await tx.transactionLog.create({
          data: {
            userId: request.mentorId,
            amount: request.pointsRequested,
            type: 'REFUND_WITHDRAWAL_REJECTED',
            status: 'SUCCESS',
            referenceId: `withdrawal-rejection:${request.id}`,
          },
        })
      }

      return { kind: 'UPDATED' as const, pointsRefunded: newStatus === 'REJECTED' ? request.pointsRequested : 0 }
    })

    if (outcome.kind === 'NOT_FOUND') {
      return { success: false, message: 'Không tìm thấy yêu cầu rút tiền.' }
    }
    if (outcome.kind === 'ALREADY_PROCESSED') {
      return { success: false, message: `Yêu cầu đã được xử lý với trạng thái ${outcome.status}.` }
    }
    if (outcome.kind === 'CONCURRENTLY_PROCESSED') {
      return { success: false, message: 'Yêu cầu vừa được admin khác xử lý. Không có điểm nào được hoàn lặp.' }
    }

    try {
      revalidatePath('/admin/finance')
      revalidatePath('/profile')
      revalidatePath('/history')
    } catch (error) {
      console.error('[AdminFinance] Post-commit revalidation error:', error)
    }

    return {
      success: true,
      message: newStatus === 'REJECTED'
        ? `Đã từ chối yêu cầu và hoàn ngay ${outcome.pointsRefunded} GivePoints vào ví Mentor.`
        : 'Đã duyệt yêu cầu rút tiền.',
    }
  } catch (error) {
    console.error('[AdminFinance] updateWithdrawStatus error:', error)
    return { success: false, message: 'Failed to update status. Please try again.' }
  }
}
