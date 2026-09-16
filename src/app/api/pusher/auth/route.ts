import { pusherServer } from '@/lib/pusher'
import { createPusherAuthRouteHandler } from '@/lib/pusher-auth-route-handlers'
import {
  requireAuthenticatedUser,
  requireConversationParticipant,
} from '@/lib/server-authorization'

export const POST = createPusherAuthRouteHandler({
  pusherServer,
  requireAuthenticatedUser,
  requireConversationParticipant,
})
