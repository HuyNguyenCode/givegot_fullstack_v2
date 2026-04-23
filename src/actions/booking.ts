'use server'

import { BookingStatus, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notifications'
import { calculateAndUpdateTrustScore } from '@/lib/trust-algorithm'
import { createGoogleMeetLink, verifyMeetingAttendance } from '@/lib/google-meet'

// ── Cancellation Policy Constants ─────────────────────────────────────────────
const CANCELLATION_THRESHOLD_HOURS = 12

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingResult {
  success: boolean
  message: string
  bookingId?: string
}

export interface ReviewGateStatus {
  blocked: boolean
  pendingCount: number
  sessions: Array<{
    bookingId: string
    mentorName: string
    sessionDate: Date
  }>
}

// ── Review Gate ───────────────────────────────────────────────────────────────
//
// A mentee must review any session that ended > 24 h ago before they can book
// a new one. This keeps the review dataset healthy and enforces community norms.

export async function checkReviewGate(menteeId: string): Promise<ReviewGateStatus> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // CONFIRMED + endTime in the past by > 24 h means: the session happened but
  // the mentee never submitted their review to mark it COMPLETED.
  const overdueConfirmed = await prisma.booking.findMany({
    where: {
      menteeId,
      status: BookingStatus.CONFIRMED,
      endTime: { lt: twentyFourHoursAgo },
    },
    select: {
      id: true,
      endTime: true,
      mentor: { select: { name: true, email: true } },
    },
  })

  const sessions = overdueConfirmed.map((b) => ({
    bookingId: b.id,
    mentorName: b.mentor.name ?? b.mentor.email,
    sessionDate: b.endTime,
  }))

  return {
    blocked: sessions.length > 0,
    pendingCount: sessions.length,
    sessions,
  }
}

export async function bookAvailableSlot(
  slotId: string,
  menteeId: string,
  note?: string
): Promise<BookingResult> {
  try {
    // ── Layer 1 — Balance guard (pre-transaction fast-path) ───────────────────
    // Read the balance before acquiring any DB locks so we can reject immediately
    // without paying the cost of a full transaction. Layer 2 (inside the tx)
    // re-validates under a SELECT FOR UPDATE to close the race-condition window.
    const menteeSnapshot = await prisma.user.findUnique({
      where:  { id: menteeId },
      select: { givePoints: true },
    })
    if (!menteeSnapshot || menteeSnapshot.givePoints < 1) {
      return { success: false, message: 'INSUFFICIENT_POINTS' }
    }

    // ── Review Gate: block new bookings if overdue reviews exist ─────────────
    const gate = await checkReviewGate(menteeId)
    if (gate.blocked) {
      return {
        success: false,
        message: `REVIEW_GATE_BLOCKED:${gate.pendingCount}`,
      }
    }

    console.log('Attempting atomic slot booking:', { slotId, menteeId })

    // This ensures that concurrent transactions see consistent data
    const result = await prisma.$transaction(
      async (tx) => {
        // Step 1: Lock the slot row with SELECT FOR UPDATE
        // This prevents race conditions by locking the row until transaction completes
        const slot = await tx.$queryRaw<Array<{
          id: string
          mentorId: string
          startTime: Date
          endTime: Date
          isBooked: boolean
        }>>`
          SELECT id, "mentorId", "startTime", "endTime", "isBooked"
          FROM "AvailableSlot"
          WHERE id = ${slotId}
          FOR UPDATE
        `

        if (slot.length === 0) {
          throw new Error('Slot not found')
        }

        const lockedSlot = slot[0]

        // Step 2: Check if slot is already booked (CRITICAL for concurrency)
        if (lockedSlot.isBooked) {
          throw new Error('SLOT_TAKEN') // Special error code for UI handling
        }

        // Step 3: Re-verify balance under lock (Layer 2 — closes race-condition window)
        const mentee = await tx.user.findUnique({
          where:  { id: menteeId },
          select: { givePoints: true },
        })

        if (!mentee) {
          throw new Error('Mentee not found')
        }

        if (mentee.givePoints < 1) {
          throw new Error('INSUFFICIENT_POINTS')
        }

        // Step 4: Deduct 1 point from mentee
        await tx.user.update({
          where: { id: menteeId },
          data: { givePoints: { decrement: 1 } },
        })

        // Step 5: Create booking
        const booking = await tx.booking.create({
          data: {
            mentorId: lockedSlot.mentorId,
            menteeId,
            slotId: lockedSlot.id,
            startTime: lockedSlot.startTime,
            endTime: lockedSlot.endTime,
            status: BookingStatus.PENDING,
            note: note || null,
          },
        })

        // Step 6a: Log transaction (AUDIT TRAIL)
        await tx.transactionLog.create({
          data: {
            userId: menteeId,
            amount: -1,
            type: 'BOOKING_CREATED',
            bookingId: booking.id,
          },
        })

        // Step 6b: Mark slot as booked (link booking ID)
        await tx.availableSlot.update({
          where: { id: slotId },
          data: { isBooked: true },
        })

        console.log('Slot booked successfully:', booking.id)
        console.log('Transaction logged: -1 point (BOOKING_CREATED)')

        return booking
      },
      {
        isolationLevel: 'ReadCommitted', // Ensures consistent reads
        maxWait: 5000, // Wait up to 5 seconds for lock
        timeout: 10000, // Transaction timeout
      }
    )

    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath('/dashboard')
    revalidatePath('/history')
    revalidatePath(`/profile/${result.mentorId}`)
    revalidatePath(`/book/${result.mentorId}`)

    // Notify the mentor about the new booking request
    const mentee = await prisma.user.findUnique({ where: { id: menteeId }, select: { name: true, email: true } })
    const menteeName = mentee?.name || mentee?.email || 'A mentee'
    await createNotification(
      result.mentorId,
      'New Booking Request',
      `${menteeName} has requested a session with you. Review it in your dashboard.`,
      'BOOKING',
      '/dashboard'
    )

    // Notify the mentee that their booking is pending
    await createNotification(
      menteeId,
      'Booking Submitted',
      'Your booking request has been sent. 1 GivePoint is held until the mentor responds.',
      'POINTS',
      '/dashboard'
    )

    return {
      success: true,
      message: 'Slot booked! 1 GivePoint held. Waiting for mentor to accept.',
      bookingId: result.id,
    }
  } catch (error: any) {
    console.error('Error booking slot:', error)

    if (error.message === 'INSUFFICIENT_POINTS') {
      return { success: false, message: 'INSUFFICIENT_POINTS' }
    }

    if (error.message === 'SLOT_TAKEN') {
      return {
        success: false,
        message: 'Oops! Someone just booked this slot. Please choose another time.',
      }
    }

    if (error.message?.startsWith('REVIEW_GATE_BLOCKED')) {
      return { success: false, message: error.message }
    }

    return {
      success: false,
      message: 'Failed to book slot. Please try again.',
    }
  }
}

// Backward compatibility alias
export const bookSlot = bookAvailableSlot

export async function createBooking(
  mentorId: string,
  menteeId: string,
  startTime: Date,
  endTime: Date,
  note?: string
): Promise<BookingResult> {
  try {
    // ── Time-gate: reject bookings in the past ────────────────────────────────
    if (new Date(startTime) <= new Date()) {
      return { success: false, message: 'Cannot book a session that starts in the past.' }
    }

    // ── Review Gate ──────────────────────────────────────────────────────────
    const gate = await checkReviewGate(menteeId)
    if (gate.blocked) {
      return {
        success: false,
        message: `REVIEW_GATE_BLOCKED:${gate.pendingCount}`,
      }
    }

    console.log('Creating booking:', { mentorId, menteeId, startTime, endTime, note })

    const mentee = await prisma.user.findUnique({ where: { id: menteeId } })
    const mentor = await prisma.user.findUnique({ where: { id: mentorId } })

    if (!mentee || !mentor) {
      return { success: false, message: 'User not found' }
    }

    if (mentee.givePoints < 1) {
      return { success: false, message: 'INSUFFICIENT_POINTS' }
    }

    // Atomic: deduct point + create booking + write audit log — all or nothing
    const booking = await prisma.$transaction(async (tx) => {
      // Escrow: deduct 1 point upfront before the mentor accepts
      await tx.user.update({
        where: { id: menteeId },
        data: { givePoints: { decrement: 1 } },
      })

      const newBooking = await tx.booking.create({
        data: {
          mentorId,
          menteeId,
          startTime,
          endTime,
          status: BookingStatus.PENDING,
          note,
        },
      })

      // Audit trail — keeps wallet ledger in sync with bookAvailableSlot's pattern
      await tx.transactionLog.create({
        data: {
          userId:    menteeId,
          amount:    -1,
          type:      TransactionType.BOOKING_CREATED,
          bookingId: newBooking.id,
        },
      })

      return newBooking
    })

    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath('/dashboard')

    // Notify mentor about new booking request
    const menteeUser = await prisma.user.findUnique({ where: { id: menteeId }, select: { name: true, email: true } })
    const menteeName = menteeUser?.name || menteeUser?.email || 'A mentee'
    await createNotification(
      mentorId,
      'New Booking Request',
      `${menteeName} has requested a session with you.`,
      'BOOKING',
      '/dashboard'
    )

    return {
      success: true,
      message: '1 GivePoint held. Waiting for mentor to accept.',
      bookingId: booking.id,
    }
  } catch (error) {
    console.error('Error creating booking:', error)
    return { success: false, message: 'Failed to create booking. Please try again.' }
  }
}

export async function acceptBooking(bookingId: string, mentorId: string): Promise<BookingResult> {
  try {
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })

    if (!booking) {
      return { success: false, message: 'Booking not found' }
    }

    if (booking.mentorId !== mentorId) {
      return { success: false, message: 'Unauthorized: You are not the mentor for this session' }
    }

    if (booking.status !== BookingStatus.PENDING) {
      return { success: false, message: `Cannot accept booking with status: ${booking.status}` }
    }

    if (booking.startTime <= new Date()) {
      return {
        success: false,
        message: 'Cannot accept a booking that has already started or passed.',
      }
    }

    // Fetch both participants in parallel — needed for Meet link and notification
    const [mentor, mentee] = await Promise.all([
      prisma.user.findUnique({ where: { id: mentorId }, select: { name: true, email: true } }),
      prisma.user.findUnique({ where: { id: booking.menteeId }, select: { name: true, email: true } }),
    ])

    // Attempt Google Meet creation. Non-fatal: booking proceeds even if this fails.
    let meetingUrl: string | null = null
    if (mentor?.email && mentee?.email) {
      meetingUrl = await createGoogleMeetLink(
        booking.startTime,
        booking.endTime,
        mentee.email,
        mentor.email
      )
    }

    // Persist CONFIRMED status and Meet URL atomically
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.booking.update({
      where: { id: bookingId },
      // meetingUrl is valid after `prisma db push`; cast needed until `prisma generate` re-runs
      data: { status: BookingStatus.CONFIRMED, meetingUrl } as any,
    })

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/history')

    const mentorName = mentor?.name || mentor?.email || 'Your mentor'
    const meetMessage = meetingUrl
      ? ` Your Google Meet link is ready: ${meetingUrl}`
      : ' Check your dashboard to join the session.'

    await createNotification(
      booking.menteeId,
      'Booking Accepted!',
      `${mentorName} has accepted your booking request. Your session is confirmed!${meetMessage}`,
      'BOOKING',
      '/dashboard'
    )

    return {
      success: true,
      message: meetingUrl
        ? 'Booking confirmed! Google Meet link created and sent to both participants.'
        : 'Booking confirmed! Session is scheduled.',
      bookingId,
    }
  } catch (error) {
    console.error('Error accepting booking:', error)
    return { success: false, message: 'Failed to accept booking. Please try again.' }
  }
}

export async function declineBooking(bookingId: string, mentorId: string): Promise<BookingResult> {
  try {
    const booking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      include: { slot: true }
    })

    if (!booking) {
      return { success: false, message: 'Booking not found' }
    }

    if (booking.mentorId !== mentorId) {
      return { success: false, message: 'Unauthorized: You are not the mentor for this session' }
    }

    if (booking.status !== BookingStatus.PENDING) {
      return { success: false, message: `Cannot decline booking with status: ${booking.status}` }
    }

    // Use transaction for refund and slot removal
    await prisma.$transaction(async (tx) => {
      // Cancel the booking and sever the FK before touching the slot row
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED, slotId: null },
      })

      // Mentor declined → they are still busy at that time, so permanently
      // remove the slot instead of making it available to other mentees.
      if (booking.slotId) {
        await tx.availableSlot.delete({ where: { id: booking.slotId } })
        console.log(`Slot ${booking.slotId} deleted (mentor declined)`)
      }

      // Refund 1 point to mentee
      await tx.user.update({
        where: { id: booking.menteeId },
        data: { givePoints: { increment: 1 } },
      })


      await tx.transactionLog.create({
        data: {
          userId: booking.menteeId,
          amount: 1,
          type: 'BOOKING_DECLINED',
          bookingId,
        },
      })
      console.log('Transaction logged: +1 point refund (BOOKING_DECLINED)')
    })

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/history')
    revalidatePath(`/profile/${mentorId}`)
    revalidatePath(`/book/${mentorId}`)

    // Notify mentee that their booking was declined and point refunded
    const decliningMentor = await prisma.user.findUnique({ where: { id: mentorId }, select: { name: true, email: true } })
    const decliningMentorName = decliningMentor?.name || decliningMentor?.email || 'Your mentor'
    await createNotification(
      booking.menteeId,
      'Booking Declined',
      `${decliningMentorName} has declined your booking request. Your GivePoint has been refunded.`,
      'BOOKING',
      '/discover'
    )

    // Points refund notification
    await createNotification(
      booking.menteeId,
      'GivePoint Refunded',
      '+1 GivePoint has been returned to your balance.',
      'POINTS',
      '/history'
    )

    return {
      success: true,
      message: 'Booking declined. Point refunded to mentee.',
      bookingId,
    }
  } catch (error) {
    console.error('Error declining booking:', error)
    return { success: false, message: 'Failed to decline booking. Please try again.' }
  }
}

export async function completeSessionWithReview(
  bookingId: string,
  menteeId: string,
  rating: number,
  comment?: string
): Promise<BookingResult> {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { mentor: true, mentee: true },
    })

    if (!booking) return { success: false, message: 'Booking not found' }
    if (booking.menteeId !== menteeId) {
      return { success: false, message: 'Unauthorized: You are not the mentee for this session' }
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        message: `Cannot complete booking with status: ${booking.status}. Booking must be confirmed first.`,
      }
    }
    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5' }
    }

    const existingReview = await prisma.review.findUnique({ where: { bookingId } })
    if (existingReview) {
      return { success: false, message: 'Review already submitted for this session' }
    }

    // ── Phase 2 — Review Reveal ───────────────────────────────────────────────
    //
    // In the current one-directional system (only mentee → mentor), we reveal
    // the review immediately on submission (isHidden = false).
    //
    // When bi-directional reviews are introduced, this check becomes:
    //   const counterReviewExists = !!(await prisma.review.findFirst({
    //     where: { bookingId, authorId: booking.mentorId }
    //   }))
    //   const shouldReveal = counterReviewExists
    // And then also unhide the counter-review if shouldReveal is true.
    const shouldReveal = true

    // ── Core atomic transaction ───────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      // 1. Create review (visible immediately in current one-sided system)
      await tx.review.create({
        data: {
          bookingId,
          receiverId: booking.mentorId,
          authorId: booking.menteeId,
          rating,
          comment: comment ?? null,
          isHidden: !shouldReveal,
        },
      })

      // 2. Mark booking COMPLETED
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.COMPLETED },
      })

      // 3. Transfer 1 GivePoint to mentor
      await tx.user.update({
        where: { id: booking.mentorId },
        data: { givePoints: { increment: 1 } },
      })

      // 4. Audit log
      await tx.transactionLog.create({
        data: {
          userId: booking.mentorId,
          amount: 1,
          type: 'BOOKING_COMPLETED',
          bookingId,
        },
      })
    })

    // ── Phase 2 — Active Reviewer Bonus ──────────────────────────────────────
    //
    // The first time a mentee's total review count crosses 3 (i.e. reaches
    // exactly 4), they earn a one-time +5 Trust Score bonus.
    // We detect this by counting AFTER the new review was committed.
    const totalReviews = await prisma.review.count({ where: { authorId: menteeId } })

    if (totalReviews === 4) {
      const menteeData = await prisma.user.findUnique({
        where: { id: menteeId },
        select: { trustScore: true },
      })
      if (menteeData) {
        const previousScore = menteeData.trustScore
        const newScore = Math.min(100, previousScore + 5)
        await prisma.$transaction([
          prisma.user.update({
            where: { id: menteeId },
            data: { trustScore: newScore },
          }),
          prisma.trustHistory.create({
            data: {
              userId: menteeId,
              previousScore,
              newScore,
              reason: 'Active Reviewer Bonus: Reached 4+ submitted reviews (+5 Trust Score)',
            },
          }),
        ])
        // Notify the mentee about their bonus
        await createNotification(
          menteeId,
          '🏅 Active Reviewer Bonus!',
          'You\'ve submitted 4+ reviews — your Trust Score just increased by 5 points!',
          'POINTS',
          '/dashboard'
        )
      }
    }

    // ── Phase 2 — Recalculate mentor's Trust Score ────────────────────────────
    //
    // Run after the transaction so the new review and completed-booking status
    // are visible to the algorithm's DB reads.
    try {
      await calculateAndUpdateTrustScore(booking.mentorId)
    } catch (trustErr) {
      // Trust score failure must never break the primary booking flow
      console.error('Trust score recalculation failed (non-fatal):', trustErr)
    }

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/discover')
    revalidatePath('/history')
    revalidatePath(`/profile/${booking.mentorId}`)

    // Notify mentor
    const completingMentee = await prisma.user.findUnique({
      where: { id: menteeId },
      select: { name: true, email: true },
    })
    const completingMenteeName =
      completingMentee?.name ?? completingMentee?.email ?? 'Your mentee'

    await createNotification(
      booking.mentorId,
      'Session Completed — +1 GivePoint!',
      `${completingMenteeName} marked your session as complete and left a ${rating}-star review. +1 GivePoint added to your balance.`,
      'POINTS',
      '/history'
    )

    return {
      success: true,
      message: 'Session completed and review submitted! 1 GivePoint transferred to mentor.',
      bookingId,
    }
  } catch (error) {
    console.error('Error completing session with review:', error)
    return { success: false, message: 'Failed to complete session. Please try again.' }
  }
}

// ── Cancellation payload sent via Pusher to the other party ──────────────────
interface CancellationPusherPayload {
  bookingId: string
  cancelledBy: 'mentee' | 'mentor'
  cancellerName: string
  timing: 'early' | 'late' | 'pending'
  pointsChange: { userId: string; delta: number }[]
  trustChange: { userId: string; delta: number } | null
  message: string
}

export async function cancelBooking(bookingId: string, canceledByUserId: string): Promise<BookingResult> {
  try {
    // ── 1. Fetch booking with both parties ───────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        slot: true,
        mentor: { select: { id: true, name: true, email: true, trustScore: true } },
        mentee: { select: { id: true, name: true, email: true, trustScore: true } },
      },
    })

    if (!booking) return { success: false, message: 'Booking not found' }

    if (booking.mentorId !== canceledByUserId && booking.menteeId !== canceledByUserId) {
      return { success: false, message: 'Unauthorized: You are not part of this booking' }
    }

    if (booking.status === BookingStatus.COMPLETED) {
      return { success: false, message: 'Cannot cancel a completed booking' }
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return { success: false, message: 'Booking is already cancelled' }
    }

    // ── 2. Determine context ─────────────────────────────────────────────────
    const isMenteeCancelling = canceledByUserId === booking.menteeId
    const isConfirmed        = booking.status === BookingStatus.CONFIRMED
    const hoursUntilSession  = (booking.startTime.getTime() - Date.now()) / (1000 * 60 * 60)
    const isLateCancel       = hoursUntilSession < CANCELLATION_THRESHOLD_HOURS

    const cancellerName = isMenteeCancelling
      ? (booking.mentee.name ?? booking.mentee.email ?? 'Mentee')
      : (booking.mentor.name ?? booking.mentor.email ?? 'Mentor')
    const notifyRecipientId = isMenteeCancelling ? booking.mentorId : booking.menteeId

    // ── 3. Atomic transaction ────────────────────────────────────────────────
    // All point moves, trust deductions, and status updates succeed or fail together.
    const summary = await prisma.$transaction(async (tx) => {
      // a) Cancel the booking and sever the FK before touching the slot row
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED, slotId: null },
      })

      // b) Slot handling depends on who is cancelling:
      //    • Mentee cancels → mentor is still free at that time, restore the slot.
      //    • Mentor cancels → they are busy at that time, permanently remove the slot.
      if (booking.slotId) {
        if (isMenteeCancelling) {
          await tx.availableSlot.update({
            where: { id: booking.slotId },
            data: { isBooked: false },
          })
        } else {
          await tx.availableSlot.delete({ where: { id: booking.slotId } })
        }
      }

      // c) PENDING booking: simple full refund, no trust penalty
      if (!isConfirmed) {
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: { userId: booking.menteeId, amount: 1, type: TransactionType.BOOKING_CANCELLED, bookingId },
        })
        return { timing: 'pending' as const, trustDelta: 0, penalisedUserId: null, pointsNote: 'Refunded to mentee' }
      }

      // d) CONFIRMED booking: re-read trust scores inside the transaction to avoid stale reads
      const [latestMentor, latestMentee] = await Promise.all([
        tx.user.findUnique({ where: { id: booking.mentorId }, select: { trustScore: true } }),
        tx.user.findUnique({ where: { id: booking.menteeId }, select: { trustScore: true } }),
      ])

      if (!latestMentor || !latestMentee) throw new Error('User records missing inside transaction')

      let timing: 'early' | 'late'    = isLateCancel ? 'late' : 'early'
      let trustDelta: number
      let penalisedUserId: string

      if (isMenteeCancelling) {
        penalisedUserId = booking.menteeId

        if (!isLateCancel) {
          // ── Early cancel by mentee (> 12 h) ───────────────────────────────
          // Refund 1 point; deduct 2 Trust Score
          trustDelta = -2
          const newTrust = Math.max(0, latestMentee.trustScore + trustDelta)

          await tx.user.update({
            where: { id: booking.menteeId },
            data: { givePoints: { increment: 1 }, trustScore: newTrust },
          })
          await tx.transactionLog.create({
            data: { userId: booking.menteeId, amount: 1, type: TransactionType.BOOKING_CANCELLED, bookingId },
          })
          await tx.trustHistory.create({
            data: {
              userId: booking.menteeId,
              previousScore: latestMentee.trustScore,
              newScore: newTrust,
              reason: `Early cancellation by mentee (>${CANCELLATION_THRESHOLD_HOURS}h notice) for booking ${bookingId}`,
            },
          })
        } else {
          // ── Late cancel by mentee (< 12 h) ────────────────────────────────
          // Forfeit: 1 point transferred to mentor as compensation; deduct 10 Trust Score
          trustDelta = -10
          const newTrust = Math.max(0, latestMentee.trustScore + trustDelta)

          await tx.user.update({
            where: { id: booking.mentorId },
            data: { givePoints: { increment: 1 } },
          })
          await tx.transactionLog.create({
            // @ts-expect-error CANCELLATION_COMPENSATION is valid in DB; run `npm run db:generate` after restarting dev server
            data: { userId: booking.mentorId, amount: 1, type: 'CANCELLATION_COMPENSATION', bookingId },
          })
          await tx.user.update({
            where: { id: booking.menteeId },
            data: { trustScore: newTrust },
          })
          await tx.trustHistory.create({
            data: {
              userId: booking.menteeId,
              previousScore: latestMentee.trustScore,
              newScore: newTrust,
              reason: `Late cancellation by mentee (<${CANCELLATION_THRESHOLD_HOURS}h notice) for booking ${bookingId} — 1 GivePoint forfeited to mentor`,
            },
          })
        }
      } else {
        // ── Mentor cancels ────────────────────────────────────────────────────
        // Always refund the mentee their 1 point
        penalisedUserId = booking.mentorId
        trustDelta      = isLateCancel ? -20 : -5
        const newTrust  = Math.max(0, latestMentor.trustScore + trustDelta)

        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: { userId: booking.menteeId, amount: 1, type: TransactionType.BOOKING_CANCELLED, bookingId },
        })
        await tx.user.update({
          where: { id: booking.mentorId },
          data: { trustScore: newTrust },
        })
        await tx.trustHistory.create({
          data: {
            userId: booking.mentorId,
            previousScore: latestMentor.trustScore,
            newScore: newTrust,
            reason: `${isLateCancel ? 'Late' : 'Early'} cancellation by mentor (${isLateCancel ? '<' : '>'}${CANCELLATION_THRESHOLD_HOURS}h notice) for booking ${bookingId}`,
          },
        })
      }

      return { timing, trustDelta, penalisedUserId }
    })

    // ── 4. Revalidate pages ──────────────────────────────────────────────────
    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/history')
    revalidatePath(`/profile/${booking.mentorId}`)
    revalidatePath(`/book/${booking.mentorId}`)

    // ── 5. Build human-readable outcome messages ─────────────────────────────
    let cancellerNotifTitle   = ''
    let cancellerNotifMessage = ''
    let recipientNotifTitle   = ''
    let recipientNotifMessage = ''

    if (summary.timing === 'pending') {
      cancellerNotifTitle   = 'Booking Cancelled'
      cancellerNotifMessage = 'Your booking has been cancelled. 1 GivePoint has been refunded to your balance.'
      recipientNotifTitle   = 'Booking Cancelled'
      recipientNotifMessage = isMenteeCancelling
        ? `${cancellerName} has cancelled their booking request.`
        : `${cancellerName} has cancelled your session. 1 GivePoint has been refunded.`
    } else if (isMenteeCancelling) {
      if (summary.timing === 'early') {
        cancellerNotifTitle   = 'Booking Cancelled — Early'
        cancellerNotifMessage = `You cancelled with more than ${CANCELLATION_THRESHOLD_HOURS}h notice. 1 GivePoint refunded. −2 Trust Score applied.`
        recipientNotifTitle   = 'Session Cancelled by Mentee'
        recipientNotifMessage = `${cancellerName} cancelled your upcoming session with more than ${CANCELLATION_THRESHOLD_HOURS}h notice.`
      } else {
        cancellerNotifTitle   = 'Booking Cancelled — Late'
        cancellerNotifMessage = `You cancelled with less than ${CANCELLATION_THRESHOLD_HOURS}h notice. Your GivePoint was sent to the mentor as compensation. −10 Trust Score applied.`
        recipientNotifTitle   = 'Late Cancellation — +1 GivePoint Compensation'
        recipientNotifMessage = `${cancellerName} cancelled your session with less than ${CANCELLATION_THRESHOLD_HOURS}h notice. 1 GivePoint has been added to your balance as compensation.`
      }
    } else {
      if (summary.timing === 'early') {
        cancellerNotifTitle   = 'Session Cancelled — Early'
        cancellerNotifMessage = `You cancelled with more than ${CANCELLATION_THRESHOLD_HOURS}h notice. −5 Trust Score applied.`
        recipientNotifTitle   = 'Session Cancelled by Mentor'
        recipientNotifMessage = `${cancellerName} cancelled your upcoming session. 1 GivePoint has been refunded.`
      } else {
        cancellerNotifTitle   = 'Session Cancelled — Late'
        cancellerNotifMessage = `You cancelled with less than ${CANCELLATION_THRESHOLD_HOURS}h notice. −20 Trust Score applied.`
        recipientNotifTitle   = 'Session Cancelled Last-Minute'
        recipientNotifMessage = `${cancellerName} cancelled your session with less than ${CANCELLATION_THRESHOLD_HOURS}h notice. 1 GivePoint has been refunded.`
      }
    }

    // ── 6. In-app DB notifications ───────────────────────────────────────────
    await Promise.all([
      createNotification(canceledByUserId, cancellerNotifTitle, cancellerNotifMessage, 'BOOKING', '/history'),
      createNotification(notifyRecipientId, recipientNotifTitle, recipientNotifMessage, 'BOOKING', '/history'),
    ])

    // ── 7. Pusher real-time event — instant delivery to both parties ─────────
    const pusherPayload: CancellationPusherPayload = {
      bookingId,
      cancelledBy: isMenteeCancelling ? 'mentee' : 'mentor',
      cancellerName,
      timing: summary.timing,
      pointsChange: buildPointsChange(summary.timing, isMenteeCancelling, booking.mentorId, booking.menteeId),
      trustChange: summary.timing !== 'pending' && summary.penalisedUserId
        ? { userId: summary.penalisedUserId, delta: summary.trustDelta }
        : null,
      message: recipientNotifMessage,
    }

    await Promise.allSettled([
      pusherServer.trigger(`user-${canceledByUserId}`, 'booking-cancelled', {
        ...pusherPayload,
        message: cancellerNotifMessage,
      }),
      pusherServer.trigger(`user-${notifyRecipientId}`, 'booking-cancelled', pusherPayload),
    ])

    const successMessage = summary.timing === 'late' && isMenteeCancelling
      ? 'Booking cancelled. 1 GivePoint forfeited to mentor. −10 Trust Score.'
      : summary.timing === 'late' && !isMenteeCancelling
      ? 'Session cancelled. Mentee refunded. −20 Trust Score.'
      : 'Booking cancelled.'

    return { success: true, message: successMessage, bookingId }
  } catch (error) {
    console.error('[cancelBooking] Error:', error)
    return { success: false, message: 'Failed to cancel booking. Please try again.' }
  }
}

function buildPointsChange(
  timing: 'pending' | 'early' | 'late',
  isMenteeCancelling: boolean,
  mentorId: string,
  menteeId: string
): CancellationPusherPayload['pointsChange'] {
  if (timing === 'pending' || timing === 'early' || !isMenteeCancelling) {
    return [{ userId: menteeId, delta: 1 }]
  }
  // Late cancel by mentee: point goes to mentor
  return [{ userId: mentorId, delta: 1 }]
}

export async function getMyBookings(userId: string) {
  try {
    console.log('Getting bookings for user:', userId)
    
    const bookings = await prisma.booking.findMany({
      where: {
        OR: [
          { mentorId: userId },
          { menteeId: userId },
        ],
      },
      include: {
        mentor: true,
        mentee: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    
    const asMentor = bookings.filter(b => b.mentorId === userId)
    const asMentee = bookings.filter(b => b.menteeId === userId)
    
    console.log('As mentor:', asMentor.length, 'As mentee:', asMentee.length)
    
    return {
      asMentor,
      asMentee,
    }
  } catch (error) {
    console.error('Error fetching bookings:', error)
    return {
      asMentor: [],
      asMentee: [],
    }
  }
}

export async function getAllBookings() {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        mentor: true,
        mentee: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return bookings
  } catch (error) {
    console.error('Error fetching all bookings:', error)
    return []
  }
}

export async function getReviewsByMentorId(mentorId: string) {
  try {
    const reviews = await prisma.review.findMany({
      where: { receiverId: mentorId },
      orderBy: { createdAt: 'desc' },
    })
    return reviews
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return []
  }
}

export async function getReviewsWithReviewerDetails(mentorId: string) {
  try {
    const reviews = await prisma.review.findMany({
      where: { receiverId: mentorId, isHidden: false },
      include: {
        booking: {
          include: {
            mentee: {
              select: {
                id: true,
                name: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
    
    return reviews.map(review => ({
      ...review,
      reviewer: review.booking.mentee,
    }))
  } catch (error) {
    console.error('Error fetching reviews with details:', error)
    return []
  }
}

export async function getMentorRating(mentorId: string) {
  try {
    const reviews = await prisma.review.findMany({
      where: { receiverId: mentorId, isHidden: false },
    })
    
    if (reviews.length === 0) {
      return { average: 0, count: 0 }
    }

    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0)
    const average = totalRating / reviews.length
    
    return {
      average: Math.round(average * 10) / 10,
      count: reviews.length,
    }
  } catch (error) {
    console.error('Error calculating mentor rating:', error)
    return { average: 0, count: 0 }
  }
}

// ── No-Show Dispute Resolution ────────────────────────────────────────────────

/** How long (in minutes) a participant must be present to be considered "attended". */
const ATTENDANCE_MIN_MINUTES = 5

/** Minimum minutes both parties must share to classify the session as completed (fraud gate). */
const FRAUD_THRESHOLD_MINUTES = 30

/** Mentee may file a no-show report within this many hours of the session end. */
const NO_SHOW_GRACE_PERIOD_HOURS = 48

type NoShowVerdict = 'MENTOR_NO_SHOW' | 'FRAUD_DETECTED' | 'DISPUTED'

interface NoShowResult extends BookingResult {
  verdict?: NoShowVerdict
  attendanceSource?: 'api' | 'mock'
}

/**
 * Allows a mentee to report that their mentor did not show up for a confirmed session.
 *
 * The action calls `verifyMeetingAttendance` to fetch (or mock) attendance data
 * and then applies a three-way Judge Logic inside a single atomic Prisma transaction:
 *
 *   Scenario A — Mentor no-show (valid report):
 *     mentorMinutes < 5 AND menteeMinutes ≥ 5
 *     → Refund mentee +1 GP · Deduct mentor Trust −20 · Status → MISSED
 *
 *   Scenario B — Fraudulent report:
 *     Both parties present > 30 minutes
 *     → Pay mentor +1 GP (escrow release) · Deduct mentee Trust −30 · Status → COMPLETED
 *
 *   Scenario C — Inconclusive / API error:
 *     Anything else, including null attendance data
 *     → Freeze funds · Flag for admin · Status → DISPUTED
 */
export async function reportNoShow(
  bookingId: string,
  menteeId: string,
): Promise<NoShowResult> {
  try {
    // ── 1. Fetch booking with both parties ───────────────────────────────────
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        mentor: { select: { id: true, name: true, email: true, trustScore: true } },
        mentee: { select: { id: true, name: true, email: true, trustScore: true } },
      },
    })

    if (!booking) {
      return { success: false, message: 'Booking not found.' }
    }

    // ── 2. Authorization & eligibility guards ────────────────────────────────
    if (booking.menteeId !== menteeId) {
      return { success: false, message: 'Unauthorized: you are not the mentee for this booking.' }
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return {
        success: false,
        message: `Only CONFIRMED sessions can have a no-show report (current status: ${booking.status}).`,
      }
    }

    const now = Date.now()
    const sessionEndMs = new Date(booking.endTime).getTime()

    if (now <= sessionEndMs) {
      return { success: false, message: 'The session has not ended yet.' }
    }

    const gracePeriodMs = NO_SHOW_GRACE_PERIOD_HOURS * 60 * 60 * 1000
    if (now > sessionEndMs + gracePeriodMs) {
      return {
        success: false,
        message: `The ${NO_SHOW_GRACE_PERIOD_HOURS}-hour reporting window has expired.`,
      }
    }

    // ── 3. Verify meeting attendance ─────────────────────────────────────────
    //
    // When meetingUrl is absent (session booked without a Meet link), we cannot
    // verify attendance — immediately fall into Scenario C (DISPUTED).
    let attendance: Awaited<ReturnType<typeof verifyMeetingAttendance>> = null

    if (booking.meetingUrl) {
      attendance = await verifyMeetingAttendance(
        booking.meetingUrl,
        booking.mentor.email,
        booking.mentee.email,
        new Date(booking.startTime),
        new Date(booking.endTime),
      )
    } else {
      console.warn(`[reportNoShow] Booking ${bookingId} has no meetingUrl — defaulting to DISPUTED`)
    }

    // ── 4. Determine verdict ─────────────────────────────────────────────────
    let verdict: NoShowVerdict

    if (!attendance) {
      verdict = 'DISPUTED'
    } else {
      const { mentorMinutes, menteeMinutes } = attendance

      if (mentorMinutes < ATTENDANCE_MIN_MINUTES && menteeMinutes >= ATTENDANCE_MIN_MINUTES) {
        verdict = 'MENTOR_NO_SHOW'
      } else if (
        mentorMinutes > FRAUD_THRESHOLD_MINUTES &&
        menteeMinutes > FRAUD_THRESHOLD_MINUTES
      ) {
        verdict = 'FRAUD_DETECTED'
      } else {
        // Covers: both absent, mentor partial, mentee partial, or edge combinations
        verdict = 'DISPUTED'
      }
    }

    console.log(
      `[reportNoShow] Booking ${bookingId} → verdict=${verdict} ` +
        `mentor=${attendance?.mentorMinutes ?? '?'}m mentee=${attendance?.menteeMinutes ?? '?'}m ` +
        `source=${attendance?.source ?? 'none'}`
    )

    // ── 5. Atomic transaction — execute verdict ──────────────────────────────
    await prisma.$transaction(async (tx) => {
      // Re-read trust scores inside the transaction to avoid stale reads
      const [latestMentor, latestMentee] = await Promise.all([
        tx.user.findUnique({ where: { id: booking.mentorId }, select: { trustScore: true } }),
        tx.user.findUnique({ where: { id: booking.menteeId }, select: { trustScore: true } }),
      ])
      if (!latestMentor || !latestMentee) throw new Error('User records missing inside transaction')

      if (verdict === 'MENTOR_NO_SHOW') {
        // ── Scenario A: Valid no-show report ──────────────────────────────
        // a) Update booking status
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'MISSED' as BookingStatus },
        })

        // b) Refund mentee +1 GivePoint
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: {
            userId:    booking.menteeId,
            amount:    1,
            // @ts-expect-error REFUND_NO_SHOW added to schema; run `npm run db:generate` after `prisma db push`
            type:      'REFUND_NO_SHOW',
            bookingId,
          },
        })

        // c) Penalise mentor Trust Score −20
        const newMentorTrust = Math.max(0, latestMentor.trustScore - 20)
        await tx.user.update({
          where: { id: booking.mentorId },
          data: { trustScore: newMentorTrust },
        })
        await tx.trustHistory.create({
          data: {
            userId:        booking.mentorId,
            previousScore: latestMentor.trustScore,
            newScore:      newMentorTrust,
            reason:        `No-show penalty: mentor absent from confirmed session ${bookingId} (verified by attendance API)`,
          },
        })
      } else if (verdict === 'FRAUD_DETECTED') {
        // ── Scenario B: Fraudulent no-show report ─────────────────────────
        // a) Mark booking COMPLETED (session did happen)
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: BookingStatus.COMPLETED },
        })

        // b) Release escrowed GivePoint to mentor
        await tx.user.update({
          where: { id: booking.mentorId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: {
            userId:    booking.mentorId,
            amount:    1,
            // @ts-expect-error FRAUD_DETECTION added to schema; run `npm run db:generate` after `prisma db push`
            type:      'FRAUD_DETECTION',
            bookingId,
          },
        })

        // c) Penalise mentee Trust Score −30 (severe: fraudulent report)
        const newMenteeTrust = Math.max(0, latestMentee.trustScore - 30)
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { trustScore: newMenteeTrust },
        })
        await tx.trustHistory.create({
          data: {
            userId:        booking.menteeId,
            previousScore: latestMentee.trustScore,
            newScore:      newMenteeTrust,
            reason:        `Fraud penalty: mentee filed a false no-show report for booking ${bookingId} (both parties confirmed present > ${FRAUD_THRESHOLD_MINUTES} min)`,
          },
        })
      } else {
        // ── Scenario C: Inconclusive — freeze funds ───────────────────────
        // Update booking status; no GivePoint movement, no trust change.
        // An admin Report is created outside the transaction (after commit).
        await tx.booking.update({
          where: { id: bookingId },
          data: { status: 'DISPUTED' as BookingStatus },
        })
      }
    })

    // ── 6. Post-transaction side-effects ─────────────────────────────────────

    // For DISPUTED cases, create an admin Report so it surfaces in the review queue.
    if (verdict === 'DISPUTED') {
      await prisma.report.create({
        data: {
          reporterId:     booking.menteeId,
          reportedUserId: booking.mentorId,
          reason:
            `[AUTO] No-show dispute for booking ${bookingId}. ` +
            `Attendance data was inconclusive ` +
            `(mentor=${attendance?.mentorMinutes ?? '?'}m mentee=${attendance?.menteeMinutes ?? '?'}m source=${attendance?.source ?? 'none'}). ` +
            `Funds are frozen pending manual review.`,
        },
      })
    }

    // ── 7. Revalidate pages ──────────────────────────────────────────────────
    revalidatePath('/dashboard')
    revalidatePath('/history')
    revalidatePath(`/profile/${booking.mentorId}`)

    // ── 8. Notifications ─────────────────────────────────────────────────────
    const menteeName = booking.mentee.name ?? booking.mentee.email ?? 'Mentee'
    const mentorName = booking.mentor.name ?? booking.mentor.email ?? 'Mentor'

    if (verdict === 'MENTOR_NO_SHOW') {
      await Promise.all([
        createNotification(
          booking.menteeId,
          'No-Show Confirmed — Refunded',
          `Your report was verified. ${mentorName} was absent from your session. ` +
            `1 GivePoint has been refunded to your balance.`,
          'POINTS',
          '/dashboard',
        ),
        createNotification(
          booking.mentorId,
          'No-Show Penalty Applied',
          `${menteeName} reported that you did not attend your scheduled session on ` +
            `${new Date(booking.startTime).toLocaleDateString()}. ` +
            `Attendance was verified. −20 Trust Score applied.`,
          'SYSTEM',
          '/dashboard',
        ),
      ])
    } else if (verdict === 'FRAUD_DETECTED') {
      await Promise.all([
        createNotification(
          booking.menteeId,
          'Fraudulent Report Detected',
          `Your no-show report for the session on ` +
            `${new Date(booking.startTime).toLocaleDateString()} was found to be inaccurate. ` +
            `Both parties were confirmed present. −30 Trust Score applied.`,
          'SYSTEM',
          '/dashboard',
        ),
        createNotification(
          booking.mentorId,
          'Session Dispute Resolved — +1 GivePoint',
          `A no-show report filed against you was found to be fraudulent. ` +
            `Your attendance was confirmed and 1 GivePoint has been credited to your balance.`,
          'POINTS',
          '/dashboard',
        ),
      ])
    } else {
      await Promise.all([
        createNotification(
          booking.menteeId,
          'Dispute Under Review',
          `Your no-show report for the session on ` +
            `${new Date(booking.startTime).toLocaleDateString()} could not be automatically resolved. ` +
            `Funds are frozen and an admin will review within 48 hours.`,
          'SYSTEM',
          '/dashboard',
        ),
        createNotification(
          booking.mentorId,
          'Session Dispute Filed',
          `${menteeName} has filed a no-show dispute for your session on ` +
            `${new Date(booking.startTime).toLocaleDateString()}. ` +
            `Attendance data was inconclusive — an admin will review.`,
          'SYSTEM',
          '/dashboard',
        ),
      ])
    }

    // ── 9. Build user-facing result ──────────────────────────────────────────
    const messages: Record<NoShowVerdict, string> = {
      MENTOR_NO_SHOW:
        'Your report has been verified. Mentor was absent — 1 GivePoint refunded and −20 Trust Score applied to the mentor.',
      FRAUD_DETECTED:
        'Dispute resolved: attendance records show both parties were present. Session marked complete, mentor paid. −30 Trust Score applied to your account.',
      DISPUTED:
        'Attendance data was inconclusive. Funds have been frozen and the case has been escalated for admin review.',
    }

    return {
      success:          true,
      message:          messages[verdict],
      verdict,
      bookingId,
      attendanceSource: attendance?.source,
    }
  } catch (error) {
    console.error('[reportNoShow] Error:', error)
    return { success: false, message: 'Failed to process no-show report. Please try again.' }
  }
}
