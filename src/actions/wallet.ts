'use server'

/**
 * Wallet Actions — Fiat Payment Ledger
 *
 * Covers three operations for the GiveGot fiat integration:
 *   1. createTopupIntent  — initiates a PENDING top-up before the gateway redirect
 *   2. confirmTopup       — webhook handler: marks SUCCESS and credits the wallet
 *   3. createWithdrawRequest — debits points immediately and queues a cash-out for admin review
 *
 * NOTE ON TYPES: `TransactionStatus`, `TOPUP`, `CASHOUT`, `WithdrawRequest` were
 * added to the schema via `prisma db push`. The generated Prisma client types will
 * be updated after restarting the dev server (which re-runs `prisma generate`).
 * Until then the new fields are accessed via `as any` casts — the runtime behaviour
 * is correct because the DB columns exist.
 */

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { POINTS_TO_VND_RATE } from '@/lib/constants'
import type { WalletResult, TopupIntentResult } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shorthand prisma accessor typed as `any` for fields not yet in generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

// ── 1. createTopupIntent ─────────────────────────────────────────────────────

/**
 * Creates a PENDING `TransactionLog` entry of type `TOPUP` BEFORE the user is
 * redirected to the payment gateway. The returned `transactionId` should be used
 * as the order reference ID sent to VNPay / Momo / Stripe so the IPN webhook can
 * reference it when calling `confirmTopup`.
 *
 * Points are NOT credited yet — only on confirmed payment via `confirmTopup`.
 */
export async function createTopupIntent(
  userId: string,
  amountVND: number,
  pointsToAdd: number
): Promise<TopupIntentResult> {
  if (amountVND <= 0 || pointsToAdd <= 0) {
    return { success: false, message: 'Top-up amount must be greater than zero.' }
  }

  // Sanity-check: enforce that the VND ↔ points ratio is consistent
  const expectedVND = pointsToAdd * POINTS_TO_VND_RATE
  if (amountVND !== expectedVND) {
    return {
      success: false,
      message: `Amount mismatch. ${pointsToAdd} GivePoints should cost ${expectedVND.toLocaleString('vi-VN')} VND, but received ${amountVND.toLocaleString('vi-VN')} VND.`,
    }
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
    if (!user) return { success: false, message: 'User not found.' }

    const transaction = await db.transactionLog.create({
      data: {
        userId,
        amount: pointsToAdd,   // positive: will be credited on confirmation
        type: 'TOPUP',
        status: 'PENDING',
        // referenceId is set later by confirmTopup when the gateway responds
      },
    })

    return {
      success: true,
      message: `Top-up intent created for ${pointsToAdd} GivePoints (${amountVND.toLocaleString('vi-VN')} VND). Redirect user to payment gateway.`,
      transactionId: transaction.id,
      data: { transactionId: transaction.id, amountVND, pointsToAdd },
    }
  } catch (error) {
    console.error('[Wallet] createTopupIntent error:', error)
    return { success: false, message: 'Failed to create top-up intent. Please try again.' }
  }
}

// ── 2. confirmTopup ───────────────────────────────────────────────────────────

/**
 * Called by the payment gateway's IPN / webhook after a successful payment.
 * Atomically:
 *   a) Marks the `TransactionLog` as SUCCESS and records the gateway reference ID.
 *   b) Increments the user's `givePoints`.
 *
 * Idempotent: duplicate webhook calls for an already-SUCCESS transaction are
 * silently ignored.
 */
export async function confirmTopup(
  transactionId: string,
  referenceId: string
): Promise<WalletResult> {
  if (!transactionId || !referenceId) {
    return { success: false, message: 'transactionId and referenceId are required.' }
  }

  try {
    const txn = await db.transactionLog.findUnique({
      where: { id: transactionId },
    })

    if (!txn) {
      return { success: false, message: `Transaction ${transactionId} not found.` }
    }
    if (txn.type !== 'TOPUP') {
      return { success: false, message: 'Transaction is not a top-up — cannot confirm.' }
    }
    if (txn.status === 'SUCCESS') {
      // Idempotent: already processed, safe to return success
      return {
        success: true,
        message: `Top-up ${transactionId} was already confirmed. Duplicate webhook ignored.`,
      }
    }
    if (txn.status === 'FAILED') {
      return { success: false, message: `Top-up ${transactionId} was previously marked as FAILED and cannot be re-confirmed.` }
    }

    // Atomic: update transaction + credit wallet together
    await prisma.$transaction([
      db.transactionLog.update({
        where: { id: transactionId },
        data: {
          status: 'SUCCESS',
          referenceId,
        },
      }),
      prisma.user.update({
        where: { id: txn.userId },
        data: { givePoints: { increment: txn.amount } },
      }),
    ])

    revalidatePath('/dashboard')

    return {
      success: true,
      message: `Successfully topped up ${txn.amount} GivePoints. Gateway ref: ${referenceId}`,
      data: { pointsAdded: txn.amount, referenceId },
    }
  } catch (error) {
    console.error('[Wallet] confirmTopup error:', error)
    return { success: false, message: 'Failed to confirm top-up. Check server logs.' }
  }
}

// ── 2b. failTopup ────────────────────────────────────────────────────────────

/**
 * Called when the payment gateway reports a failed / cancelled payment.
 * Marks the pending intent as FAILED. No points are ever credited.
 */
export async function failTopup(
  transactionId: string,
  referenceId?: string
): Promise<WalletResult> {
  try {
    const txn = await db.transactionLog.findUnique({ where: { id: transactionId } })
    if (!txn) return { success: false, message: `Transaction ${transactionId} not found.` }
    if (txn.status !== 'PENDING') {
      return { success: false, message: `Transaction is already ${txn.status}. Cannot mark as FAILED.` }
    }

    await db.transactionLog.update({
      where: { id: transactionId },
      data: { status: 'FAILED', ...(referenceId ? { referenceId } : {}) },
    })

    return { success: true, message: `Top-up ${transactionId} marked as FAILED.` }
  } catch (error) {
    console.error('[Wallet] failTopup error:', error)
    return { success: false, message: 'Failed to update transaction status.' }
  }
}

// ── 3. createWithdrawRequest ──────────────────────────────────────────────────

/**
 * Submits a cash-out / withdrawal request. Atomically:
 *   a) Validates the user has sufficient balance.
 *   b) Debits `points` from the user's wallet IMMEDIATELY (funds held).
 *   c) Creates a CASHOUT `TransactionLog` (status: SUCCESS — deduction is final).
 *   d) Creates a `WithdrawRequest` (status: PENDING) for admin review & bank transfer.
 *
 * Points are held until the admin APPROVES (transfer sent) or REJECTS (points
 * should be refunded separately by the admin action — not handled here).
 *
 * @param bankDetails  Human-readable bank info, e.g. "VCB – 0123456789 – Nguyen Van A"
 */
export async function createWithdrawRequest(
  userId: string,
  points: number,
  bankDetails: string
): Promise<WalletResult> {
  if (points <= 0) {
    return { success: false, message: 'Withdrawal must be greater than 0 GivePoints.' }
  }
  if (!bankDetails.trim()) {
    return { success: false, message: 'Bank details (bank name + account number + account holder) are required.' }
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { givePoints: true, name: true },
    })

    if (!user) return { success: false, message: 'User not found.' }

    if (user.givePoints < points) {
      return {
        success: false,
        message: `Insufficient balance. You have ${user.givePoints} GivePoints but requested ${points}. Please top up first.`,
      }
    }

    const fiatAmount = points * POINTS_TO_VND_RATE

    // Atomic 3-step ledger write — all succeed or all roll back
    await prisma.$transaction([
      // Step 1: Debit the user's wallet (hold funds)
      prisma.user.update({
        where: { id: userId },
        data: { givePoints: { decrement: points } },
      }),

      // Step 2: Write CASHOUT audit entry (negative amount = debit)
      db.transactionLog.create({
        data: {
          userId,
          amount: -points,
          type: 'CASHOUT',
          status: 'SUCCESS', // Deduction is definitive; payout handled by admin
        },
      }),

      // Step 3: Queue cash-out for admin review
      db.withdrawRequest.create({
        data: {
          mentorId: userId,
          pointsRequested: points,
          fiatAmount,
          bankDetails: bankDetails.trim(),
          status: 'PENDING',
        },
      }),
    ])

    revalidatePath('/dashboard')
    revalidatePath('/profile')

    return {
      success: true,
      message: `Withdrawal request submitted. ${points} GivePoints (${fiatAmount.toLocaleString('vi-VN')} VND) will be transferred after admin approval.`,
      data: { pointsRequested: points, fiatAmount },
    }
  } catch (error) {
    console.error('[Wallet] createWithdrawRequest error:', error)
    return { success: false, message: 'Failed to submit withdrawal request. Please try again.' }
  }
}

// ── 4. getWalletBalance ───────────────────────────────────────────────────────

/**
 * Returns the user's current balance and a summary of fiat transactions
 * (top-ups and cash-outs) for display in a wallet UI.
 */
export async function getWalletBalance(userId: string) {
  try {
    const [user, fiatTxns, pendingWithdrawals] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { givePoints: true },
      }),
      db.transactionLog.findMany({
        where: {
          userId,
          type: { in: ['TOPUP', 'CASHOUT'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.withdrawRequest.findMany({
        where: { mentorId: userId, status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return {
      givePoints: user?.givePoints ?? 0,
      fiatTransactions: fiatTxns,
      pendingWithdrawals,
    }
  } catch (error) {
    console.error('[Wallet] getWalletBalance error:', error)
    return { givePoints: 0, fiatTransactions: [], pendingWithdrawals: [] }
  }
}
