'use server'

import { BookingStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

interface BookingResult {
  success: boolean
  message: string
  bookingId?: string
}

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
    })

    console.log('🔵 Review added, booking completed, point transferred')

    revalidatePath('/')
    revalidatePath('/dashboard')
    revalidatePath('/discover')
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
    const booking = await prisma.booking.findUnique({ where: { id: bookingId } })

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

    // Use transaction for refund
    await prisma.$transaction(async (tx) => {
      // Cancel booking
      await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      })

      // Refund point to mentee if booking was PENDING or CONFIRMED
      if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.CONFIRMED) {
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })
      }
    })

    revalidatePath('/')
    revalidatePath('/dashboard')

    return {
      success: true,
      message: 'Booking cancelled. Point refunded to mentee.',
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
