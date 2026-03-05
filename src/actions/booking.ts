'use server'

import { BookingStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

interface BookingResult {
  success: boolean
  message: string
  bookingId?: string
}

// ✨ NEW: Atomic slot-based booking with concurrency control
export async function bookAvailableSlot(
  slotId: string,
  menteeId: string,
  note?: string
): Promise<BookingResult> {
  try {
    console.log('🔒 Attempting atomic slot booking:', { slotId, menteeId })

    // ✨ CRITICAL: Use transaction with READ COMMITTED isolation level
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

        // Step 3: Verify mentee has enough points
        const mentee = await tx.user.findUnique({
          where: { id: menteeId },
        })

        if (!mentee) {
          throw new Error('Mentee not found')
        }

        if (mentee.givePoints < 1) {
          throw new Error(`Not enough GivePoints. You have ${mentee.givePoints}, need at least 1.`)
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

        // ✨ Step 6a: Log transaction (AUDIT TRAIL)
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

        console.log('✅ Slot booked successfully:', booking.id)
        console.log('📝 Transaction logged: -1 point (BOOKING_CREATED)')

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
    revalidatePath(`/mentor/${result.mentorId}`)

    return {
      success: true,
      message: '✅ Slot booked! 1 GivePoint held. Waiting for mentor to accept.',
      bookingId: result.id,
    }
  } catch (error: any) {
    console.error('❌ Error booking slot:', error)

    // Handle specific error cases
    if (error.message === 'SLOT_TAKEN') {
      return {
        success: false,
        message: '⚠️ Oops! Someone just booked this slot. Please choose another time.',
      }
    }

    if (error.message?.includes('GivePoints')) {
      return {
        success: false,
        message: error.message,
      }
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
    console.log('🔵 Creating booking:', { mentorId, menteeId, startTime, endTime, note })
    
    const mentee = await prisma.user.findUnique({ where: { id: menteeId } })
    const mentor = await prisma.user.findUnique({ where: { id: mentorId } })

    if (!mentee || !mentor) {
      return { success: false, message: 'User not found' }
    }

    if (mentee.givePoints < 1) {
      return { 
        success: false, 
        message: `Not enough GivePoints. You have ${mentee.givePoints}, need at least 1.` 
      }
    }

    // Use transaction to ensure atomicity
    const booking = await prisma.$transaction(async (tx) => {
      // Deduct 1 point from mentee
      await tx.user.update({
        where: { id: menteeId },
        data: { givePoints: { decrement: 1 } },
      })

      // Create booking
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

      return newBooking
    })

    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath('/dashboard')

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

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CONFIRMED },
    })

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/history')

    return {
      success: true,
      message: 'Booking confirmed! Session is scheduled.',
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

    // Use transaction for refund and slot release
    await prisma.$transaction(async (tx) => {
      // Update booking status to CANCELLED
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      })

      // Release the slot
      if (booking.slotId) {
        await tx.availableSlot.update({
          where: { id: booking.slotId },
          data: { isBooked: false },
        })
        console.log(`🔓 Slot ${booking.slotId} released`)
      }

      // Refund 1 point to mentee
      await tx.user.update({
        where: { id: booking.menteeId },
        data: { givePoints: { increment: 1 } },
      })

      // ✨ Log refund transaction (AUDIT TRAIL)
      await tx.transactionLog.create({
        data: {
          userId: booking.menteeId,
          amount: 1,
          type: 'BOOKING_DECLINED',
          bookingId,
        },
      })
      console.log('📝 Transaction logged: +1 point refund (BOOKING_DECLINED)')
    })

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/history')

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
    console.log('🔵 Complete session with review:', { bookingId, menteeId, rating, comment })
    
    const booking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      include: { mentor: true, mentee: true }
    })

    if (!booking) {
      return { success: false, message: 'Booking not found' }
    }

    if (booking.menteeId !== menteeId) {
      return { success: false, message: 'Unauthorized: You are not the mentee for this session' }
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      return { 
        success: false, 
        message: `Cannot complete booking with status: ${booking.status}. Booking must be confirmed first.` 
      }
    }

    if (rating < 1 || rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5' }
    }

    // Check if review already exists
    const existingReview = await prisma.review.findUnique({
      where: { bookingId },
    })

    if (existingReview) {
      return { success: false, message: 'Review already submitted for this session' }
    }

    // Use transaction for atomic operations
    await prisma.$transaction(async (tx) => {
      // 1. Create review
      await tx.review.create({
        data: {
          bookingId,
          receiverId: booking.mentorId,
          authorId: booking.menteeId,
          rating,
          comment: comment || null,
        },
      })

      // 2. Update booking status
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.COMPLETED },
      })

      // 3. Transfer 1 point to mentor
      await tx.user.update({
        where: { id: booking.mentorId },
        data: { givePoints: { increment: 1 } },
      })

      // ✨ 4. Log transaction (AUDIT TRAIL)
      await tx.transactionLog.create({
        data: {
          userId: booking.mentorId,
          amount: 1,
          type: 'BOOKING_COMPLETED',
          bookingId,
        },
      })
    })

    console.log('📝 Transaction logged: +1 point to mentor (BOOKING_COMPLETED)')

    console.log('🔵 Review added, booking completed, point transferred')

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/discover')
    revalidatePath('/history')
    revalidatePath(`/mentor/${booking.mentorId}`)

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

export async function cancelBooking(bookingId: string, userId: string): Promise<BookingResult> {
  try {
    const booking = await prisma.booking.findUnique({ 
      where: { id: bookingId },
      include: { slot: true }
    })

    if (!booking) {
      return { success: false, message: 'Booking not found' }
    }

    if (booking.mentorId !== userId && booking.menteeId !== userId) {
      return { success: false, message: 'Unauthorized: You are not part of this booking' }
    }

    if (booking.status === BookingStatus.COMPLETED) {
      return { success: false, message: 'Cannot cancel a completed booking' }
    }

    if (booking.status === BookingStatus.CANCELLED) {
      return { success: false, message: 'Booking is already cancelled' }
    }

    // Use transaction for refund and slot release
    await prisma.$transaction(async (tx) => {
      // Cancel booking
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      })

      // ✨ NEW: Release the slot (make it available again)
      if (booking.slotId) {
        await tx.availableSlot.update({
          where: { id: booking.slotId },
          data: { isBooked: false },
        })
        console.log(`🔓 Slot ${booking.slotId} released and available again`)
      }

      // Refund point to mentee if booking was PENDING or CONFIRMED
      if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) {
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })

        // ✨ Log refund transaction (AUDIT TRAIL)
        await tx.transactionLog.create({
          data: {
            userId: booking.menteeId,
            amount: 1,
            type: 'BOOKING_CANCELLED',
            bookingId,
          },
        })
        console.log('📝 Transaction logged: +1 point refund (BOOKING_CANCELLED)')
      }
    })

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/history')
    revalidatePath(`/mentor/${booking.mentorId}`)

    return {
      success: true,
      message: 'Booking cancelled. Point refunded and slot is available again.',
      bookingId,
    }
  } catch (error) {
    console.error('Error cancelling booking:', error)
    return { success: false, message: 'Failed to cancel booking. Please try again.' }
  }
}

export async function getMyBookings(userId: string) {
  try {
    console.log('🔵 Getting bookings for user:', userId)
    
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
    
    console.log('🔵 As mentor:', asMentor.length, 'As mentee:', asMentee.length)
    
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
      where: { receiverId: mentorId },
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
      where: { receiverId: mentorId },
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
