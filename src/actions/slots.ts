'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, unstable_noStore as noStore } from 'next/cache'

interface SlotInput {
  startTime: Date | string
  endTime: Date | string
}

interface SlotResult {
  success: boolean
  message: string
  createdCount?: number
}

export async function addMentorSlots(
  mentorId: string,
  slots: SlotInput[]
): Promise<SlotResult> {
  try {
    console.log(`📅 Adding ${slots.length} slots for mentor:`, mentorId)

    if (slots.length === 0) {
      return { success: false, message: 'No slots provided' }
    }

    // Ép kiểu Date object chuẩn, diệt gọn lỗi Overlapping ảo của chuỗi String
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

    const result = await prisma.availableSlot.createMany({
      data: processedSlots.map(slot => ({
        mentorId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        isBooked: false,
      })),
    })

    console.log(`✅ Created ${result.count} available slots`)

    revalidatePath('/dashboard')
    revalidatePath(`/mentor/${mentorId}`)
    
    return {
      success: true,
      message: `Successfully added ${result.count} slot(s)!`,
      createdCount: result.count,
    }
  } catch (error) {
    console.error('❌ Error adding mentor slots:', error)
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
        startTime: { gte: now }, // Mentee chỉ được thấy slot tương lai để đặt
      },
      orderBy: { startTime: 'asc' },
    })
    return slots
  } catch (error) { return [] }
}

export async function getAllMentorSlots(mentorId: string) {
  try {
    noStore(); 
    
    // 🌟 FIX LỖI TÀNG HÌNH: 
    // Cho phép lấy lùi lại 7 ngày trước để UI hiển thị đủ tất cả slot trong tuần,
    // Tránh bị server nuốt mất slot do lệch vài tiếng đồng hồ.
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

    console.log(`📅 Found ${slots.length} total slots for mentor ${mentorId}`)

    return slots
  } catch (error) {
    console.error('❌ Error fetching mentor slots:', error)
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
    revalidatePath(`/mentor/${mentorId}`)
    return { success: true, message: 'Slot deleted successfully' }
  } catch (error) { return { success: false, message: 'Failed to delete slot.' } }
}