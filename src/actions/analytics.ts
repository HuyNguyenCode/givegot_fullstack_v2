'use server'

import { prisma } from '@/lib/prisma'
import { SkillType, BookingStatus, TransactionType } from '@prisma/client'
import { subDays, format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns'
import { getUserBadges, Badge } from '@/lib/badges'

export interface PointHistoryEntry {
  date: string
  balance: number
}

export interface SkillDemandEntry {
  skill: string
  demand: number // WANT count
  supply: number // GIVE count
  gap: number    // demand - supply
}

export interface PopularMentor {
  id: string
  name: string
  avatarUrl: string | null
  trustScore: number
  totalSessions: number
  avgRating: number
  topSkill: string | null
}

/**
 * Returns daily GivePoints balance for a user over the last `days` days.
 * Reconstructed from TransactionLog entries.
 */
export async function getPointHistory(
  userId: string,
  days: number = 30
): Promise<PointHistoryEntry[]> {
  try {
    const endDate = new Date()
    const startDate = subDays(endDate, days - 1)

    // Get all transactions for the user up to today
    const allTransactions = await prisma.transactionLog.findMany({
      where: { userId },
      select: { amount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    // Calculate the balance before the window starts
    const transactionsBeforeWindow = allTransactions.filter(
      (t) => t.createdAt < startOfDay(startDate)
    )
    const transactionsInWindow = allTransactions.filter(
      (t) =>
        t.createdAt >= startOfDay(startDate) &&
        t.createdAt <= endOfDay(endDate)
    )

    // Sum up amounts before the window to get the starting balance
    // We'll use the user's current balance and work backwards from the most recent transaction
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { givePoints: true },
    })
    if (!user) return []

    // Starting balance at the beginning of the window
    const windowTransactionsTotal = transactionsInWindow.reduce(
      (sum, t) => sum + t.amount,
      0
    )
    // balance at start of window = current balance - sum of all transactions in window
    const balanceAtWindowStart = user.givePoints - windowTransactionsTotal

    // Build a daily-delta map for transactions within the window
    const dailyDeltas = new Map<string, number>()
    for (const t of transactionsInWindow) {
      const dayKey = format(t.createdAt, 'MMM d')
      dailyDeltas.set(dayKey, (dailyDeltas.get(dayKey) ?? 0) + t.amount)
    }

    // Walk through every day in the window and compute running balance
    const days_arr = eachDayOfInterval({ start: startDate, end: endDate })
    let runningBalance = balanceAtWindowStart
    const result: PointHistoryEntry[] = []

    for (const day of days_arr) {
      const dayKey = format(day, 'MMM d')
      runningBalance += dailyDeltas.get(dayKey) ?? 0
      result.push({ date: dayKey, balance: runningBalance })
    }

    return result
  } catch (error) {
    console.error('Error fetching point history:', error)
    return []
  }
}

/**
 * Returns the top 8 skills ranked by "demand" (WANT count),
 * along with their "supply" (GIVE count) and the gap.
 */
export async function getTopRequestedSkills(): Promise<SkillDemandEntry[]> {
  try {
    // Aggregate WANT counts per skill
    const wantCounts = await prisma.userSkill.groupBy({
      by: ['skillId'],
      where: { type: SkillType.WANT },
      _count: { skillId: true },
      orderBy: { _count: { skillId: 'desc' } },
      take: 8,
    })

    if (wantCounts.length === 0) return []

    const topSkillIds = wantCounts.map((w) => w.skillId)

    // Get GIVE counts for these skills
    const giveCounts = await prisma.userSkill.groupBy({
      by: ['skillId'],
      where: { type: SkillType.GIVE, skillId: { in: topSkillIds } },
      _count: { skillId: true },
    })

    // Fetch skill names
    const skills = await prisma.skill.findMany({
      where: { id: { in: topSkillIds } },
      select: { id: true, name: true },
    })

    const skillMap = new Map(skills.map((s) => [s.id, s.name]))
    const giveMap = new Map(giveCounts.map((g) => [g.skillId, g._count.skillId]))

    return wantCounts.map((w) => {
      const demand = w._count.skillId
      const supply = giveMap.get(w.skillId) ?? 0
      return {
        skill: skillMap.get(w.skillId) ?? 'Unknown',
        demand,
        supply,
        gap: Math.max(0, demand - supply),
      }
    })
  } catch (error) {
    console.error('Error fetching top requested skills:', error)
    return []
  }
}

/**
 * Returns the top 5 mentors ranked by Trust Score (desc), with completed
 * sessions as a tie-breaker. Only mentors who have at least one completed
 * session are included so the list reflects real activity.
 */
export async function getPopularMentors(): Promise<PopularMentor[]> {
  try {
    // Collect all mentor IDs that have at least one completed session
    const completedGroups = await prisma.booking.groupBy({
      by: ['mentorId'],
      where: { status: BookingStatus.COMPLETED },
      _count: { mentorId: true },
    })

    if (completedGroups.length === 0) return []

    const activeMentorIds = completedGroups.map((g) => g.mentorId)
    const sessionMap = new Map(
      completedGroups.map((g) => [g.mentorId, g._count.mentorId])
    )

    // Fetch profiles + trustScore for every active mentor in one query
    const [mentors, avgRatings] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: activeMentorIds } },
        select: {
          id: true,
          name: true,
          avatarUrl: true,
          trustScore: true,
          skills: {
            where: { type: SkillType.GIVE },
            include: { skill: { select: { name: true } } },
            take: 1,
          },
        },
      }),
      prisma.review.groupBy({
        by: ['receiverId'],
        where: { receiverId: { in: activeMentorIds } },
        _avg: { rating: true },
      }),
    ])

    const ratingMap = new Map(
      avgRatings.map((r) => [r.receiverId, r._avg.rating ?? 0])
    )

    return mentors
      .map((m) => ({
        id: m.id,
        name: m.name ?? 'Unknown',
        avatarUrl: m.avatarUrl ?? null,
        trustScore: m.trustScore,
        totalSessions: sessionMap.get(m.id) ?? 0,
        avgRating: Number((ratingMap.get(m.id) ?? 0).toFixed(1)),
        topSkill: m.skills[0]?.skill.name ?? null,
      }))
      .sort((a, b) => {
        // Primary: Trust Score descending
        if (b.trustScore !== a.trustScore) return b.trustScore - a.trustScore
        // Tie-breaker: completed sessions descending
        return b.totalSessions - a.totalSessions
      })
      .slice(0, 5)
  } catch (error) {
    console.error('Error fetching popular mentors:', error)
    return []
  }
}

// ── Trust Dashboard ───────────────────────────────────────────────────────────

export interface TrustBreakdownDisplay {
  completionRate: number      // 0–1 e.g. 0.87
  completionScore: number     // 0–100
  avgRating: number           // 1–5
  ratingScore: number         // 0–100
  avgResponseHours: number | null
  responseTimeScore: number   // 0–100
  cancellationRate: number    // 0–1
  cancellationScore: number   // 0–100
  completedSessions: number
  totalSessions: number
}

export interface TrustDashboardData {
  trustScore: number
  breakdown: TrustBreakdownDisplay
  badges: Badge[]
}

/**
 * Computes a read-only trust dashboard for a user — does NOT update the DB.
 * All computation mirrors the trust-algorithm.ts logic but avoids side-effects.
 */
export async function getUserTrustDashboard(
  userId: string,
): Promise<TrustDashboardData> {
  const fallback: TrustDashboardData = {
    trustScore: 50,
    breakdown: {
      completionRate: 0,
      completionScore: 70,
      avgRating: 0,
      ratingScore: 70,
      avgResponseHours: null,
      responseTimeScore: 80,
      cancellationRate: 0,
      cancellationScore: 100,
      completedSessions: 0,
      totalSessions: 0,
    },
    badges: [],
  }

  try {
    // Use a raw query for trustScore to avoid TypeScript issues when the Prisma
    // client cache hasn't been refreshed after a schema migration.
    const [userRows, bookings, reviews, declineLogs] = await Promise.all([
      prisma.$queryRaw<{ trustScore: number }[]>`
        SELECT "trustScore" FROM "User" WHERE id = ${userId} LIMIT 1
      `,
      prisma.booking.findMany({
        where: { mentorId: userId },
        select: { status: true, createdAt: true, id: true },
      }),
      prisma.review.findMany({
        where: { receiverId: userId },
        select: { rating: true },
      }),
      prisma.transactionLog.findMany({
        where: { userId, type: TransactionType.BOOKING_DECLINED },
        select: { createdAt: true, bookingId: true },
      }),
    ])

    const user = userRows[0]
    if (!user) return fallback

    // Completion
    const confirmedOrCompleted = bookings.filter((b) =>
      b.status === BookingStatus.CONFIRMED ||
      b.status === BookingStatus.COMPLETED ||
      b.status === BookingStatus.CANCELLED,
    )
    const completed = bookings.filter((b) => b.status === BookingStatus.COMPLETED)
    const completionRate =
      confirmedOrCompleted.length > 0
        ? completed.length / confirmedOrCompleted.length
        : 0
    const completionScore =
      confirmedOrCompleted.length > 0
        ? Math.min(100, Math.max(0, Math.round(completionRate * 100)))
        : 70

    // Rating
    const avgRating =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : 0
    const ratingScore =
      reviews.length > 0
        ? Math.min(100, Math.max(0, Math.round(((avgRating - 1) / 4) * 100)))
        : 70

    // Response time
    const declineMap = new Map(declineLogs.map((d) => [d.bookingId, d.createdAt]))
    const measurableDeltas: number[] = []
    for (const b of bookings) {
      const respondedAt = declineMap.get(b.id)
      if (respondedAt) {
        measurableDeltas.push(
          (respondedAt.getTime() - b.createdAt.getTime()) / 3_600_000,
        )
      }
    }
    const avgResponseHours =
      measurableDeltas.length > 0
        ? measurableDeltas.reduce((s, h) => s + h, 0) / measurableDeltas.length
        : null

    const responseTimeScore = (() => {
      if (avgResponseHours === null) return 80
      if (avgResponseHours < 1) return 100
      if (avgResponseHours <= 12)
        return Math.round(100 - ((avgResponseHours - 1) / 11) * 50)
      if (avgResponseHours <= 24)
        return Math.round(50 - ((avgResponseHours - 12) / 12) * 50)
      return 0
    })()

    // Cancellation
    const cancelled = bookings.filter((b) => b.status === BookingStatus.CANCELLED)
    const totalEverBookings = bookings.length
    const cancellationRate =
      totalEverBookings > 0 ? cancelled.length / totalEverBookings : 0
    const cancellationScore = Math.min(
      100,
      Math.max(0, Math.round(100 - cancellationRate * 200)),
    )

    const breakdown: TrustBreakdownDisplay = {
      completionRate,
      completionScore,
      avgRating,
      ratingScore,
      avgResponseHours,
      responseTimeScore,
      cancellationRate,
      cancellationScore,
      completedSessions: completed.length,
      totalSessions: totalEverBookings,
    }

    const avgResponseMinutes = avgResponseHours !== null ? avgResponseHours * 60 : null
    const badges = getUserBadges({
      trustScore: user.trustScore,
      completedSessions: completed.length,
      avgRating,
      avgResponseTimeMinutes: avgResponseMinutes,
    })

    return { trustScore: user.trustScore, breakdown, badges }
  } catch (error) {
    console.error('Error fetching trust dashboard:', error)
    return fallback
  }
}
