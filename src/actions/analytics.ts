'use server'

import { prisma } from '@/lib/prisma'
import { SkillType, BookingStatus } from '@prisma/client'
import { subDays, format, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns'

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
 * Returns the top 5 mentors ranked by completed sessions and average rating.
 */
export async function getPopularMentors(): Promise<PopularMentor[]> {
  try {
    // Group completed bookings by mentorId
    const sessionCounts = await prisma.booking.groupBy({
      by: ['mentorId'],
      where: { status: BookingStatus.COMPLETED },
      _count: { mentorId: true },
      orderBy: { _count: { mentorId: 'desc' } },
      take: 5,
    })

    if (sessionCounts.length === 0) return []

    const topMentorIds = sessionCounts.map((s) => s.mentorId)

    // Average ratings per mentor
    const avgRatings = await prisma.review.groupBy({
      by: ['receiverId'],
      where: { receiverId: { in: topMentorIds } },
      _avg: { rating: true },
    })
    const ratingMap = new Map(
      avgRatings.map((r) => [r.receiverId, r._avg.rating ?? 0])
    )

    // Mentor profiles
    const mentors = await prisma.user.findMany({
      where: { id: { in: topMentorIds } },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        skills: {
          where: { type: SkillType.GIVE },
          include: { skill: { select: { name: true } } },
          take: 1,
        },
      },
    })
    const mentorMap = new Map(mentors.map((m) => [m.id, m]))

    return sessionCounts.map((s, idx) => {
      const mentor = mentorMap.get(s.mentorId)
      return {
        id: s.mentorId,
        name: mentor?.name ?? 'Unknown',
        avatarUrl: mentor?.avatarUrl ?? null,
        totalSessions: s._count.mentorId,
        avgRating: Number((ratingMap.get(s.mentorId) ?? 0).toFixed(1)),
        topSkill: mentor?.skills[0]?.skill.name ?? null,
      }
    })
  } catch (error) {
    console.error('Error fetching popular mentors:', error)
    return []
  }
}
