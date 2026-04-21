/**
 * Trust Score Algorithm for GiveGot
 *
 * Final score (0–100) is a weighted average of four pillars:
 *
 *  ┌──────────────────────────────────────┬────────┐
 *  │ Pillar                               │ Weight │
 *  ├──────────────────────────────────────┼────────┤
 *  │ 1. Completion Rate                   │  40 %  │
 *  │ 2. Average Rating                    │  30 %  │
 *  │ 3. Response Time                     │  20 %  │
 *  │ 4. Cancellation / Decline Rate       │  10 %  │
 *  └──────────────────────────────────────┴────────┘
 *
 * Each pillar produces a sub-score in [0, 100].
 * New users start at a neutral 50 before any activity is recorded.
 */

import { prisma } from '@/lib/prisma'
import { BookingStatus, TransactionType } from '@prisma/client'

// ── Public types ─────────────────────────────────────────────────────────────

export interface TrustScoreBreakdown {
  completionRate: number        // raw ratio, e.g. 0.87
  completionScore: number       // pillar sub-score 0–100
  avgRating: number             // raw avg, e.g. 4.2
  ratingScore: number           // pillar sub-score 0–100
  avgResponseHours: number | null  // null when not measurable
  responseTimeScore: number     // pillar sub-score 0–100
  cancellationRate: number      // raw ratio, e.g. 0.12
  cancellationScore: number     // pillar sub-score 0–100
  finalScore: number            // weighted sum, rounded to integer
  sampleSizes: {
    totalBookings: number
    confirmedOrCompletedBookings: number
    completedBookings: number
    cancelledOrDeclinedBookings: number
    reviews: number
    measurableResponses: number
  }
}

export interface TrustScoreResult {
  userId: string
  previousScore: number
  newScore: number
  changed: boolean
  breakdown: TrustScoreBreakdown
}

// ── Weights ───────────────────────────────────────────────────────────────────

const WEIGHTS = {
  completionRate: 0.40,
  avgRating: 0.30,
  responseTime: 0.20,
  cancellationRate: 0.10,
} as const

// ── Defaults when there is insufficient data ──────────────────────────────────

const DEFAULTS = {
  completionScore: 70,    // New mentor — benefit of the doubt
  ratingScore: 70,        // No reviews yet — neutral
  responseTimeScore: 80,  // No measurable responses — assume prompt
  cancellationScore: 100, // No cancellations on record
} as const

// ── Helper: clamp a number to [min, max] ─────────────────────────────────────

const clamp = (value: number, min = 0, max = 100): number =>
  Math.min(max, Math.max(min, value))

// ── Pillar 1: Completion Rate ─────────────────────────────────────────────────
//
// Numerator  : bookings with status COMPLETED
// Denominator: bookings that were ever CONFIRMED (i.e. CONFIRMED, COMPLETED, or
//              CANCELLED — cancelled slots were at minimum accepted by the mentor)
//
// If denominator is 0 → return the neutral default.

function calcCompletionScore(bookings: { status: BookingStatus }[]): {
  completionRate: number
  completionScore: number
  confirmedOrCompletedCount: number
  completedCount: number
} {
  const confirmedOrCompleted = bookings.filter((b) =>
    b.status === BookingStatus.CONFIRMED ||
    b.status === BookingStatus.COMPLETED ||
    b.status === BookingStatus.CANCELLED
  )
  const completed = bookings.filter((b) => b.status === BookingStatus.COMPLETED)

  if (confirmedOrCompleted.length === 0) {
    return {
      completionRate: 0,
      completionScore: DEFAULTS.completionScore,
      confirmedOrCompletedCount: 0,
      completedCount: 0,
    }
  }

  const rate = completed.length / confirmedOrCompleted.length
  return {
    completionRate: rate,
    completionScore: clamp(Math.round(rate * 100)),
    confirmedOrCompletedCount: confirmedOrCompleted.length,
    completedCount: completed.length,
  }
}

// ── Pillar 2: Average Rating ──────────────────────────────────────────────────
//
// Uses ALL reviews received (hidden + visible) because this is an internal
// quality signal, not a public display.
//
// Normalises the 1–5 star scale to 0–100:
//   score = ((avg − 1) / 4) × 100
//
// A 5-star average → 100 pts.  A 1-star average → 0 pts.

function calcRatingScore(reviews: { rating: number }[]): {
  avgRating: number
  ratingScore: number
} {
  if (reviews.length === 0) {
    return { avgRating: 0, ratingScore: DEFAULTS.ratingScore }
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
  const score = clamp(Math.round(((avg - 1) / 4) * 100))
  return { avgRating: avg, ratingScore: score }
}

// ── Pillar 3: Response Time ───────────────────────────────────────────────────
//
// Measured as the delta between booking.createdAt and the moment the mentor
// acted (either BOOKING_DECLINED transaction or BOOKING_COMPLETED transaction).
//
// We cannot measure acceptance time directly because the schema has no
// "acceptedAt" timestamp — an explicit TODO for a future migration.
//
// Scoring curve (per spec):
//   < 1 h  → 100 pts
//   1–12 h → linear interpolation from 100 → 50
//   12–24h → linear interpolation from 50 → 0
//   > 24 h → 0 pts
//
// If there are no measurable responses, default to 80.

function responseHoursToScore(hours: number): number {
  if (hours < 1)  return 100
  if (hours < 12) return Math.round(100 - ((hours - 1) / 11) * 50)
  if (hours < 24) return Math.round(50  - ((hours - 12) / 12) * 50)
  return 0
}

function calcResponseTimeScore(
  responseTimes: Array<{ bookingCreatedAt: Date; respondedAt: Date }>
): {
  avgResponseHours: number | null
  responseTimeScore: number
  measurableCount: number
} {
  if (responseTimes.length === 0) {
    return {
      avgResponseHours: null,
      responseTimeScore: DEFAULTS.responseTimeScore,
      measurableCount: 0,
    }
  }

  const hoursPerResponse = responseTimes.map(({ bookingCreatedAt, respondedAt }) => {
    const ms = respondedAt.getTime() - bookingCreatedAt.getTime()
    return ms / (1000 * 60 * 60)
  })

  const avgHours = hoursPerResponse.reduce((a, b) => a + b, 0) / hoursPerResponse.length
  return {
    avgResponseHours: avgHours,
    responseTimeScore: responseHoursToScore(avgHours),
    measurableCount: responseTimes.length,
  }
}

// ── Pillar 4: Cancellation / Decline Rate ────────────────────────────────────
//
// Counts bookings the mentor cancelled (after confirmation) or declined.
// We treat a post-confirm CANCELLED as more damaging than a DECLINED (which
// happens before the mentee prepares). Both are included here for simplicity.
//
// Scoring formula:
//   - Under 10 % → no penalty (100 pts)
//   - 10–50 %    → linear drop from 100 → 0
//   - Above 50 % → 0 pts
//
// With zero bookings, default to 100 (no negative signal).

function calcCancellationScore(bookings: { status: BookingStatus }[]): {
  cancellationRate: number
  cancellationScore: number
  cancelledOrDeclinedCount: number
} {
  const total = bookings.length
  if (total === 0) {
    return {
      cancellationRate: 0,
      cancellationScore: DEFAULTS.cancellationScore,
      cancelledOrDeclinedCount: 0,
    }
  }

  // CANCELLED covers mentor-triggered cancellations after confirmation.
  // We do not have a DECLINED status on Booking directly, but the
  // TransactionType enum uses BOOKING_DECLINED — we approximate by checking
  // if a non-COMPLETED, non-CONFIRMED final state existed.
  const cancelled = bookings.filter(
    (b) => b.status === BookingStatus.CANCELLED
  ).length

  const rate = cancelled / total

  // Grace threshold: first 10 % is free; each point above costs 2.5 pts
  const excessPct = Math.max(0, rate * 100 - 10)
  const score = clamp(Math.round(100 - excessPct * 2.5))

  return {
    cancellationRate: rate,
    cancellationScore: score,
    cancelledOrDeclinedCount: cancelled,
  }
}

// ── Build human-readable audit reason ────────────────────────────────────────

function buildReason(
  bd: TrustScoreBreakdown,
  delta: number
): string {
  const direction = delta > 0 ? '+' : ''
  const parts: string[] = [
    `Score ${direction}${delta} pts.`,
    `Completion ${Math.round(bd.completionRate * 100)}%,`,
    `Rating ${bd.avgRating > 0 ? bd.avgRating.toFixed(1) : 'n/a'}★,`,
    `Response ${bd.avgResponseHours != null ? bd.avgResponseHours.toFixed(1) + 'h avg' : 'default'},`,
    `Cancellation ${Math.round(bd.cancellationRate * 100)}%.`,
  ]
  return parts.join(' ')
}

// ── Main exported function ────────────────────────────────────────────────────

/**
 * Recalculates the Trust Score for `userId`, persists any change, and logs
 * it to `TrustHistory`.
 *
 * Safe to call in any server-side context (Server Action, API route, cron).
 * Returns the full breakdown so callers can surface it in admin UIs.
 */
export async function calculateAndUpdateTrustScore(
  userId: string
): Promise<TrustScoreResult> {
  // ── 1. Fetch all data in parallel ────────────────────────────────────────

  const [user, mentorBookings, reviews, declineTransactions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { trustScore: true },
    }),

    // All bookings where this user acted as the MENTOR
    prisma.booking.findMany({
      where: { mentorId: userId },
      select: { status: true, createdAt: true },
    }),

    // All reviews received (hidden or visible — internal signal)
    prisma.review.findMany({
      where: { receiverId: userId },
      select: { rating: true },
    }),

    // TransactionLogs for BOOKING_DECLINED — gives us a "respondedAt" proxy.
    // BOOKING_DECLINED is created at the moment the mentor declines, so:
    //   responseTime ≈ transaction.createdAt − booking.createdAt
    prisma.transactionLog.findMany({
      where: {
        type: TransactionType.BOOKING_DECLINED,
        booking: { mentorId: userId },
      },
      select: {
        createdAt: true,
        booking: { select: { createdAt: true } },
      },
    }),
  ])

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  // ── 2. Run each pillar ───────────────────────────────────────────────────

  const completion = calcCompletionScore(mentorBookings)
  const rating = calcRatingScore(reviews)

  const responsePairs = declineTransactions
    .filter((t) => t.booking !== null)
    .map((t) => ({
      bookingCreatedAt: t.booking!.createdAt,
      respondedAt: t.createdAt,
    }))
  const responseTime = calcResponseTimeScore(responsePairs)

  const cancellation = calcCancellationScore(mentorBookings)

  // ── 3. Weighted final score ──────────────────────────────────────────────

  const raw =
    completion.completionScore  * WEIGHTS.completionRate  +
    rating.ratingScore          * WEIGHTS.avgRating       +
    responseTime.responseTimeScore * WEIGHTS.responseTime +
    cancellation.cancellationScore * WEIGHTS.cancellationRate

  const finalScore = clamp(Math.round(raw))

  // ── 4. Assemble breakdown ────────────────────────────────────────────────

  const breakdown: TrustScoreBreakdown = {
    completionRate: completion.completionRate,
    completionScore: completion.completionScore,
    avgRating: rating.avgRating,
    ratingScore: rating.ratingScore,
    avgResponseHours: responseTime.avgResponseHours,
    responseTimeScore: responseTime.responseTimeScore,
    cancellationRate: cancellation.cancellationRate,
    cancellationScore: cancellation.cancellationScore,
    finalScore,
    sampleSizes: {
      totalBookings: mentorBookings.length,
      confirmedOrCompletedBookings: completion.confirmedOrCompletedCount,
      completedBookings: completion.completedCount,
      cancelledOrDeclinedBookings: cancellation.cancelledOrDeclinedCount,
      reviews: reviews.length,
      measurableResponses: responseTime.measurableCount,
    },
  }

  const previousScore = user.trustScore

  // ── 5. Persist only when score changes ──────────────────────────────────

  if (finalScore !== previousScore) {
    const reason = buildReason(breakdown, finalScore - previousScore)

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { trustScore: finalScore },
      }),
      prisma.trustHistory.create({
        data: {
          userId,
          previousScore,
          newScore: finalScore,
          reason,
        },
      }),
    ])
  }

  return {
    userId,
    previousScore,
    newScore: finalScore,
    changed: finalScore !== previousScore,
    breakdown,
  }
}

// ── Convenience: recalculate for multiple users (e.g. nightly cron) ─────────

export async function recalculateTrustScoresForAll(): Promise<{
  processed: number
  changed: number
  errors: number
}> {
  const users = await prisma.user.findMany({ select: { id: true } })

  let changed = 0
  let errors = 0

  for (const { id } of users) {
    try {
      const result = await calculateAndUpdateTrustScore(id)
      if (result.changed) changed++
    } catch {
      errors++
    }
  }

  return { processed: users.length, changed, errors }
}
