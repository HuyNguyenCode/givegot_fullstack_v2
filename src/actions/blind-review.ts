'use server'

/**
 * Two-way Blind Review actions.
 *
 * Twin Table Strategy: `MentorReview` lives alongside the existing `Review`
 * model (mentee → mentor) instead of modifying it, so nothing that already
 * depends on `Review` (types, queries, trust algorithm, public profile
 * ratings, etc.) changes behavior.
 *
 * A booking's review pair is "revealed" (`Booking.isReviewRevealed`) only
 * once BOTH sides have submitted their review.
 */

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BlindReviewResult {
  success: boolean
  message: string
}

export interface BlindReviewEntry {
  rating: number
  comment: string | null
}

export interface BlindReviewStatus {
  bookingId: string
  mentorId: string
  menteeId: string
  /** Which side `currentUserId` is on for this booking, or null if neither. */
  myRole: 'mentor' | 'mentee' | null
  /** Whether the current user has already submitted their side of the review. */
  myReviewSubmitted: boolean
  isReviewRevealed: boolean
  menteeReview: BlindReviewEntry | null
  mentorReview: BlindReviewEntry | null
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBlindReviewStatus(
  bookingId: string,
  currentUserId: string
): Promise<BlindReviewStatus | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      mentorId: true,
      menteeId: true,
      isReviewRevealed: true,
      review: { select: { rating: true, comment: true } },
      mentorReview: { select: { rating: true, comment: true } },
    },
  })

  if (!booking) return null

  const myRole: BlindReviewStatus['myRole'] =
    currentUserId === booking.mentorId ? 'mentor' : currentUserId === booking.menteeId ? 'mentee' : null

  const myReviewSubmitted =
    myRole === 'mentor' ? !!booking.mentorReview : myRole === 'mentee' ? !!booking.review : false

  return {
    bookingId,
    mentorId: booking.mentorId,
    menteeId: booking.menteeId,
    myRole,
    myReviewSubmitted,
    isReviewRevealed: booking.isReviewRevealed,
    menteeReview: booking.review
      ? { rating: booking.review.rating, comment: booking.review.comment }
      : null,
    mentorReview: booking.mentorReview
      ? { rating: booking.mentorReview.rating, comment: booking.mentorReview.comment }
      : null,
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function submitMentorReview({
  bookingId,
  rating,
  comment,
}: {
  bookingId: string
  rating: number
  comment?: string
}): Promise<BlindReviewResult> {
  try {
    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5' }
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) return { success: false, message: 'Booking not found' }

    const existingMentorReview = await prisma.mentorReview.findUnique({ where: { bookingId } })
    if (existingMentorReview) {
      return { success: false, message: 'Review already submitted for this session' }
    }

    // 1. Create the mentor's review of the mentee.
    await prisma.mentorReview.create({
      data: {
        bookingId,
        rating,
        comment: comment ?? null,
      },
    })

    // 2. Reveal both reviews once the mentee has already submitted theirs.
    const menteeReview = await prisma.review.findUnique({ where: { bookingId } })
    if (menteeReview) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { isReviewRevealed: true },
      })
    }

    revalidatePath('/dashboard')
    return { success: true, message: 'Review submitted successfully' }
  } catch (error) {
    console.error('Error submitting mentor review:', error)
    return { success: false, message: 'Failed to submit review. Please try again.' }
  }
}

export async function submitMenteeReview({
  bookingId,
  rating,
  comment,
  receiverId,
  authorId,
}: {
  bookingId: string
  rating: number
  comment?: string
  receiverId: string
  authorId: string
}): Promise<BlindReviewResult> {
  console.log("🚀 [DEBUG] submitMenteeReview đã được gọi");
  try {
    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5' }
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })
    if (!booking) return { success: false, message: 'Booking not found' }

    const existingReview = await prisma.review.findUnique({ where: { bookingId } })
    if (existingReview) {
      return { success: false, message: 'Review already submitted for this session' }
    }

    // 1. Create the row in the regular Review table (legacy logic — same shape
    //    used by the existing mentee → mentor review flow).
    await prisma.review.create({
      data: {
        bookingId,
        receiverId,
        authorId,
        rating,
        comment: comment ?? null,
        isHidden: false,
      },
    })

    // 2. Reveal both reviews once the mentor has already submitted theirs.
    const mentorReview = await prisma.mentorReview.findUnique({ where: { bookingId } })
    if (mentorReview) {
      await prisma.booking.update({
        where: { id: bookingId },
        data: { isReviewRevealed: true },
      })
    }

    revalidatePath('/dashboard')
    return { success: true, message: 'Review submitted successfully' }
  } catch (error) {
    console.error('Error submitting mentee review:', error)
    return { success: false, message: 'Failed to submit review. Please try again.' }
  }
}
