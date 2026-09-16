import { pusherServer } from '@/lib/pusher'
import { createPusherAuthRouteHandler } from '@/lib/pusher-auth-route-handlers'
import { learningSpaceRepository } from '@/lib/learning-space-service'
import {
  requireAuthenticatedUser,
  requireConversationParticipant,
  requireLearningSpaceMember,
} from '@/lib/server-authorization'

export const POST = createPusherAuthRouteHandler({
  pusherServer,
  requireAuthenticatedUser,
  requireConversationParticipant,
  authorizeLearningSpaceChannel: async (spaceId, actor) => {
    await requireLearningSpaceMember(spaceId, learningSpaceRepository, actor)
  },
})