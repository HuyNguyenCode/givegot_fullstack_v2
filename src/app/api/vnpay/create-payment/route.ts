/**
 * POST /api/vnpay/create-payment
 *
 * Authenticated endpoint — resolves the caller's identity from the NextAuth
 * session (production) with a dev-mode fallback to an explicit body `userId`.
 *
 * Flow:
 *   1. Resolve userId from session (or body in dev mode).
 *   2. Validate amountVND / pointsToAdd and enforce the canonical exchange rate.
 *   3. Write a PENDING TransactionLog — its UUID becomes vnp_TxnRef so the
 *      return / IPN routes can locate it with a single primary-key lookup.
 *   4. Build and return the signed VNPay checkout URL.
 *
 * The client redirects: `window.location.href = paymentUrl`
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { buildVNPayUrl } from '@/lib/vnpay'
import { POINTS_TO_VND_RATE } from '@/lib/constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

export async function POST(req: NextRequest) {
  try {
    // ── Resolve user identity ─────────────────────────────────────────────────
    const session = await auth()
    const body = await req.json() as {
      userId?: string
      amountVND?: number
      pointsToAdd?: number
    }

    // Production: session.user.id is authoritative.
    // Dev mode (no session): accept explicit userId from the request body.
    const userId = session?.user?.id ?? body.userId

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to top up.' },
        { status: 401 },
      )
    }

    const { amountVND, pointsToAdd } = body

    // ── Validate input ────────────────────────────────────────────────────────
    if (!amountVND || amountVND <= 0) {
      return NextResponse.json(
        { error: 'amountVND must be a positive number.' },
        { status: 400 },
      )
    }
    if (!pointsToAdd || pointsToAdd <= 0) {
      return NextResponse.json(
        { error: 'pointsToAdd must be a positive number.' },
        { status: 400 },
      )
    }

    // Guard: enforce the canonical exchange rate so the client cannot tamper
    // with the price (e.g. requesting 100 pts for 10,000 VND).
    const expectedVND = pointsToAdd * POINTS_TO_VND_RATE
    if (amountVND !== expectedVND) {
      return NextResponse.json(
        {
          error: `Amount mismatch. ${pointsToAdd} GivePoints should cost ${expectedVND.toLocaleString('vi-VN')} ₫, but received ${amountVND.toLocaleString('vi-VN')} ₫.`,
        },
        { status: 400 },
      )
    }

    // ── Verify user exists ────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where:  { id: userId },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 })
    }

    // ── Write PENDING transaction ─────────────────────────────────────────────
    // Points are NOT credited yet — that happens atomically in the return /
    // IPN route once VNPay confirms payment.
    const transaction = await db.transactionLog.create({
      data: {
        userId,
        amount:      pointsToAdd,
        type:        'TOPUP',
        status:      'PENDING',
        referenceId: null, // Populated by the return/IPN route with vnp_TransactionNo
      },
    })

    // ── Build signed VNPay checkout URL ───────────────────────────────────────
    const paymentUrl = buildVNPayUrl({
      userId,
      txnRef:    transaction.id,
      amountVND,
      orderInfo: `GiveGot +${pointsToAdd}pts - ${user.name ?? user.email}`,
      clientIp:  '127.0.0.1',
    })

    return NextResponse.json({ paymentUrl, transactionId: transaction.id })
  } catch (error) {
    console.error('[VNPay] create-payment error:', error)
    return NextResponse.json(
      { error: 'Failed to create payment. Please try again.' },
      { status: 500 },
    )
  }
}
