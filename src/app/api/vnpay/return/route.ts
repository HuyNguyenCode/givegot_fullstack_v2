/**
 * GET /api/vnpay/return
 *
 * Browser-facing return URL — VNPay redirects the user here after the payment
 * flow completes (success, failure, or cancellation).
 *
 * This route performs the full atomic ledger update so the wallet page reflects
 * the correct balance immediately when the user lands back on the site.
 * The IPN webhook (`/api/vnpay/ipn`) acts as a safety net: its idempotency
 * guard (`status !== 'PENDING'`) silently skips transactions already processed
 * here, preventing any double-credit.
 *
 * Redirect targets consumed by the wallet page:
 *   /wallet?status=success          — payment confirmed, points credited
 *   /wallet?error=invalid_signature — tampered callback, nothing changed
 *   /wallet?error=payment_failed    — VNPay declined or user cancelled
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyVNPaySignature } from '@/lib/vnpay'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

const BASE_URL = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'

function redirect(path: string) {
  return NextResponse.redirect(`${BASE_URL}${path}`)
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Collect every query param into a plain string record for signature verification
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => { params[key] = value })

  const responseCode = params['vnp_ResponseCode']
  const txnRef       = params['vnp_TxnRef']         // = our TransactionLog.id
  const vnpTxnNo     = params['vnp_TransactionNo']  // VNPay's own reference number

  // ── 1. Verify HMAC-SHA512 signature ──────────────────────────────────────
  if (!verifyVNPaySignature(params)) {
    console.warn('[VNPay Return] Invalid signature for TxnRef:', txnRef)
    return redirect('/wallet?error=invalid_signature')
  }

  // ── 2. Route on response code ─────────────────────────────────────────────
  if (responseCode !== '00') {
    // Payment was declined, cancelled (code '24'), or errored — mark FAILED
    // and let the user try again. Only attempt update if the ref exists.
    if (txnRef) {
      try {
        await db.transactionLog.updateMany({
          where: { id: txnRef, status: 'PENDING' }, // safe no-op if already updated
          data:  { status: 'FAILED', referenceId: vnpTxnNo ?? null },
        })
      } catch (err) {
        console.error('[VNPay Return] Error marking transaction FAILED:', err)
      }
    }
    return redirect('/wallet?error=payment_failed')
  }

  // ── 3. responseCode === '00' — payment confirmed ──────────────────────────
  if (!txnRef) {
    console.error('[VNPay Return] Missing vnp_TxnRef on a successful callback')
    return redirect('/wallet?error=payment_failed')
  }

  try {
    const transaction = await db.transactionLog.findUnique({
      where: { id: txnRef },
    })

    if (!transaction) {
      console.error('[VNPay Return] Transaction not found:', txnRef)
      return redirect('/wallet?error=payment_failed')
    }

    // Idempotency: IPN may have already processed this callback
    if (transaction.status === 'SUCCESS') {
      console.info('[VNPay Return] Already confirmed by IPN, skipping:', txnRef)
      return redirect('/wallet?status=success')
    }

    // Atomic ledger write: mark SUCCESS + credit wallet in one Prisma transaction
    await prisma.$transaction([
      db.transactionLog.update({
        where: { id: txnRef },
        data:  { status: 'SUCCESS', referenceId: vnpTxnNo ?? null },
      }),
      prisma.user.update({
        where: { id: transaction.userId },
        data:  { givePoints: { increment: transaction.amount } },
      }),
    ])

    revalidatePath('/wallet')
    revalidatePath('/dashboard')

    console.info(
      '[VNPay Return] Credited',
      transaction.amount,
      'pts to user',
      transaction.userId,
    )

    return redirect('/wallet?status=success')
  } catch (error) {
    console.error('[VNPay Return] Database error for TxnRef:', txnRef, error)
    return redirect('/wallet?error=payment_failed')
  }
}
