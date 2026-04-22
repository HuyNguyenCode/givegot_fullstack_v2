/**
 * GET /api/vnpay/ipn
 *
 * Instant Payment Notification — server-to-server callback from VNPay.
 *
 * CRITICAL rules enforced here:
 *   1. Verify HMAC-SHA512 signature BEFORE touching the database.
 *   2. Idempotent: skip transactions already in SUCCESS or FAILED state.
 *   3. Atomic ledger write: status update + givePoints increment in one
 *      Prisma $transaction so a crash cannot partially credit a user.
 *   4. Always return the VNPay-specified JSON shape within 5 s:
 *        { RspCode: '00', Message: 'Confirm Success' }  — acknowledged
 *        { RspCode: '97', Message: 'Invalid Signature' } — bad hash
 *        { RspCode: '01', Message: 'Order Not Found' }   — unknown txnRef
 *        { RspCode: '02', Message: 'Order Already Confirmed' } — duplicate
 *        { RspCode: '04', Message: 'Invalid Amount' }    — amount mismatch
 *        { RspCode: '99', Message: 'Unknown Error' }     — unexpected
 *
 * VNPay retries delivery up to 3 times if it does not receive RspCode '00'.
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyVNPaySignature } from '@/lib/vnpay'
import { POINTS_TO_VND_RATE } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function ipnResponse(RspCode: string, Message: string) {
  return NextResponse.json({ RspCode, Message })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  // Collect all query params into a plain string record
  const params: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    params[key] = value
  })

  const receivedHash = params['vnp_SecureHash']
  const responseCode = params['vnp_ResponseCode']
  const txnRef       = params['vnp_TxnRef']          // = our TransactionLog.id
  const vnpAmount    = params['vnp_Amount']           // VND × 100
  const vnpTxnNo     = params['vnp_TransactionNo']    // VNPay's own ref

  // ── 1. Verify signature ───────────────────────────────────────────────────
  if (!verifyVNPaySignature(params)) {
    console.warn('[VNPay IPN] Invalid signature for TxnRef:', txnRef)
    return ipnResponse('97', 'Invalid Signature')
  }

  // ── 2. Locate the pending transaction ────────────────────────────────────
  const transaction = await db.transactionLog.findUnique({
    where: { id: txnRef },
  })

  if (!transaction) {
    console.warn('[VNPay IPN] Transaction not found:', txnRef)
    return ipnResponse('01', 'Order Not Found')
  }

  // ── 3. Idempotency guard ──────────────────────────────────────────────────
  if (transaction.status !== 'PENDING') {
    console.info('[VNPay IPN] Already processed, status:', transaction.status, txnRef)
    return ipnResponse('02', 'Order Already Confirmed')
  }

  // ── 4. Amount integrity check ─────────────────────────────────────────────
  // VNPay sends VND × 100; transaction.amount is in GivePoints.
  const expectedVNDCents = transaction.amount * POINTS_TO_VND_RATE * 100
  if (parseInt(vnpAmount, 10) !== expectedVNDCents) {
    console.error(
      '[VNPay IPN] Amount mismatch. Expected:',
      expectedVNDCents,
      'Received:',
      vnpAmount,
    )
    return ipnResponse('04', 'Invalid Amount')
  }

  // ── 5. Process payment result ─────────────────────────────────────────────
  try {
    if (responseCode === '00') {
      // SUCCESS — atomic: mark transaction SUCCESS + credit wallet
      await prisma.$transaction([
        db.transactionLog.update({
          where: { id: txnRef },
          data: {
            status:      'SUCCESS',
            referenceId: vnpTxnNo ?? null,
          },
        }),
        prisma.user.update({
          where: { id: transaction.userId },
          data:  { givePoints: { increment: transaction.amount } },
        }),
      ])

      revalidatePath('/wallet')
      revalidatePath('/dashboard')

      console.info(
        '[VNPay IPN] SUCCESS — credited',
        transaction.amount,
        'pts to user',
        transaction.userId,
      )
    } else {
      // FAILED — gateway rejected the payment, mark accordingly
      await db.transactionLog.update({
        where: { id: txnRef },
        data: {
          status:      'FAILED',
          referenceId: vnpTxnNo ?? null,
        },
      })

      console.info('[VNPay IPN] Payment FAILED, responseCode:', responseCode, txnRef)
    }

    return ipnResponse('00', 'Confirm Success')
  } catch (error) {
    console.error('[VNPay IPN] Database error for TxnRef:', txnRef, error)
    return ipnResponse('99', 'Unknown Error')
  }
}
