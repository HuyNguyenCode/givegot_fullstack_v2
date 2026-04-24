'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'
import { BookingStatus } from '@prisma/client'

interface SlotInput {
  startTime: Date | string
  endTime: Date | string
}

interface SlotResult {
  success: boolean
  message: string
  createdCount?: number
}

// ── Shared Conflict Detection ─────────────────────────────────────────────────
// Checks BOTH AvailableSlot (owned) and Booking (as mentor OR mentee) for any
// overlap with the requested [startTime, endTime) window.

export async function checkUserTimeConflict(
  userId: string,
  startTime: Date,
  endTime: Date,
  opts?: { excludeSlotId?: string },
): Promise<{ hasConflict: boolean; message: string }> {
  const fmt = (d: Date) =>
    new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  // 1. Check for an owned teaching slot that overlaps
  const slotConflict = await prisma.availableSlot.findFirst({
    where: {
      mentorId: userId,
      ...(opts?.excludeSlotId ? { id: { not: opts.excludeSlotId } } : {}),
      startTime: { lt: endTime },
      endTime:   { gt: startTime },
    },
  })

  if (slotConflict) {
    return {
      hasConflict: true,
      message: `Bạn đã có một khung giờ dạy từ ${fmt(slotConflict.startTime)}–${fmt(slotConflict.endTime)}. Không thể tạo trùng giờ.`,
    }
  }

  // 2. Check for an active booking (as mentor OR mentee) that overlaps
  const bookingConflict = await prisma.booking.findFirst({
    where: {
      OR: [{ mentorId: userId }, { menteeId: userId }],
      status: { notIn: [BookingStatus.CANCELLED, BookingStatus.MISSED, BookingStatus.DISPUTED] },
      startTime: { lt: endTime },
      endTime:   { gt: startTime },
    },
    include: {
      mentor: { select: { name: true } },
      mentee: { select: { name: true } },
    },
  })

  if (bookingConflict) {
    const isMentor = bookingConflict.mentorId === userId
    const partner  = isMentor
      ? (bookingConflict.mentee?.name ?? 'học viên')
      : (bookingConflict.mentor?.name ?? 'giảng viên')
    const role = isMentor ? 'dạy' : 'học'
    return {
      hasConflict: true,
      message: `Bạn đã có một buổi ${role} với ${partner} vào ${fmt(startTime)}–${fmt(endTime)}. Không thể đặt lịch trùng.`,
    }
  }

  return { hasConflict: false, message: '' }
}

export async function addMentorSlots(
  mentorId: string,
  slots: SlotInput[]
): Promise<SlotResult> {
  try {
    console.log(`Adding ${slots.length} slots for mentor:`, mentorId)

    if (slots.length === 0) {
      return { success: false, message: 'No slots provided' }
    }

    const processedSlots = slots.map(s => ({
      startTime: new Date(s.startTime),
      endTime: new Date(s.endTime)
    }))

    for (let i = 0; i < processedSlots.length; i++) {
      for (let j = i + 1; j < processedSlots.length; j++) {
        const slot1 = processedSlots[i]
        const slot2 = processedSlots[j]

        const overlap = 
          slot1.startTime.getTime() < slot2.endTime.getTime() && 
          slot1.endTime.getTime() > slot2.startTime.getTime()

        if (overlap) return { success: false, message: `Overlapping slots detected.` }
      }
    }

    const existingSlots = await prisma.availableSlot.findMany({
      where: {
        mentorId,
        OR: processedSlots.map(slot => ({
          AND: [
            { startTime: { lt: slot.endTime } },
            { endTime: { gt: slot.startTime } },
          ],
        })),
      },
    })

    if (existingSlots.length > 0) {
      return { success: false, message: `You already have ${existingSlots.length} overlapping slot(s).` }
    }

    // Cross-table conflict check: any active booking for this user in the same window?
    for (const slot of processedSlots) {
      const conflict = await checkUserTimeConflict(mentorId, slot.startTime, slot.endTime)
      if (conflict.hasConflict) return { success: false, message: conflict.message }
    }

    const result = await prisma.availableSlot.createMany({
      data: processedSlots.map(slot => ({
        mentorId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBooked: false,
      })),
    })

    console.log(`Created ${result.count} available slots`)

    revalidatePath('/dashboard')
    revalidatePath(`/profile/${mentorId}`)
    revalidatePath(`/book/${mentorId}`)

    return {
      success: true,
      message: `Successfully added ${result.count} slot(s)!`,
      createdCount: result.count,
    }
  } catch (error) {
    console.error('Error adding mentor slots:', error)
    return { success: false, message: 'Failed to add slots.' }
  }
}

export async function getAvailableSlots(mentorId: string) {
  try {
    noStore();
    const now = new Date()

    const slots = await prisma.availableSlot.findMany({
      where: {
        mentorId,
        isBooked: false,
        startTime: { gte: now },
      },
      orderBy: { startTime: 'asc' },
    })
    return slots
  } catch (error) { return [] }
}

export async function getAllMentorSlots(mentorId: string) {
  try {
    noStore(); 
    
    const startLimit = new Date();
    startLimit.setDate(startLimit.getDate() - 7);

    const slots = await prisma.availableSlot.findMany({
      where: {
        mentorId,
        startTime: { gte: startLimit }, 
      },
      include: {
        booking: {
          include: {
            mentee: {
              select: { id: true, name: true, avatarUrl: true, email: true },
            },
          },
        },
      },
      orderBy: { startTime: 'asc' },
    })

    console.log(`Found ${slots.length} total slots for mentor ${mentorId}`)

    return slots
  } catch (error) {
    console.error('Error fetching mentor slots:', error)
    return []
  }
}

export async function deleteMentorSlot(slotId: string, mentorId: string): Promise<SlotResult> {
  try {
    const slot = await prisma.availableSlot.findUnique({ where: { id: slotId } })
    if (!slot) return { success: false, message: 'Slot not found' }
    if (slot.mentorId !== mentorId) return { success: false, message: 'Unauthorized' }
    if (slot.isBooked) return { success: false, message: 'Cannot delete booked slot.' }

    await prisma.availableSlot.delete({ where: { id: slotId } })
    revalidatePath('/dashboard')
    revalidatePath(`/profile/${mentorId}`)
    revalidatePath(`/book/${mentorId}`)
    return { success: true, message: 'Slot deleted successfully' }
  } catch (error) { return { success: false, message: 'Failed to delete slot.' } }
}

export async function updateMentorSlot(
  slotId: string,
  mentorId: string,
  newStart: Date,
  newEnd: Date
): Promise<SlotResult> {
  try {
    const slot = await prisma.availableSlot.findUnique({ where: { id: slotId } })
    if (!slot) return { success: false, message: 'Slot not found' }
    if (slot.mentorId !== mentorId) return { success: false, message: 'Unauthorized' }
    if (slot.isBooked) return { success: false, message: 'Cannot move a booked slot.' }

    // Validate the new time range
    if (newEnd <= newStart) return { success: false, message: 'End time must be after start time.' }

    // Check for overlaps with other slots (excluding this one)
    const overlapping = await prisma.availableSlot.findFirst({
      where: {
        mentorId,
        id: { not: slotId },
        AND: [
          { startTime: { lt: newEnd } },
          { endTime: { gt: newStart } },
        ],
      },
    })
    if (overlapping) {
      return { success: false, message: 'This time overlaps with an existing slot.' }
    }

    // Cross-table conflict check (exclude this slot so we don't self-conflict)
    const conflict = await checkUserTimeConflict(mentorId, newStart, newEnd, { excludeSlotId: slotId })
    if (conflict.hasConflict) return { success: false, message: conflict.message }

    await prisma.availableSlot.update({
      where: { id: slotId },
      data: { startTime: newStart, endTime: newEnd },
    })

    revalidatePath('/dashboard')
    revalidatePath(`/profile/${mentorId}`)
    revalidatePath(`/book/${mentorId}`)
    return { success: true, message: 'Slot updated successfully' }
  } catch (error) {
    console.error('Error updating mentor slot:', error)
    return { success: false, message: 'Failed to update slot.' }
  }
}