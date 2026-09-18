'use server'

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/server-authorization'
import {
  LearningBookingAuthorizationError,
  LearningBookingValidationError,
  loadLearningBookingContext,
  type LearningBookingRecord,
  type LearningBookingRepository,
} from '@/lib/learning-booking-service'

function repository(): LearningBookingRepository {
  return {
    lockSpace: async () => undefined,
    isActiveMember: async (learningSpaceId, userId) => Boolean(await prisma.learningSpaceMember.findFirst({
      where: { learningSpaceId, userId, status: 'ACTIVE' },
      select: { userId: true },
    })),
    findSpace: async (id) => prisma.learningSpace.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        state: true,
        objective: true,
        definitionOfDone: true,
        members: { select: { userId: true, status: true } },
        topics: { select: { id: true, label: true, state: true } },
      },
    }) as Promise<LearningBookingRecord | null>,
  }
}

export async function getLearningBookingContext(mentorId: string, learningSpaceId: string) {
  try {
    const actor = await requireAuthenticatedUser()
    const context = await loadLearningBookingContext(repository(), {
      actorId: actor.id,
      mentorId,
      learningSpaceId,
    })
    return { success: true as const, context }
  } catch (error) {
    if (error instanceof LearningBookingAuthorizationError || error instanceof LearningBookingValidationError) {
      return { success: false as const, message: 'LearningSpace này không thể dùng cho booking.' }
    }
    throw error
  }
}
