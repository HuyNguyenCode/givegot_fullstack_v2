import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { createMessageRouteHandlers } from '@/lib/message-route-handlers'
import {
  requireAuthenticatedUser,
  requireConversationParticipant,
} from '@/lib/server-authorization'

const handlers = createMessageRouteHandlers({
  prisma,
  pusherServer,
  requireAuthenticatedUser,
  requireConversationParticipant,
})

/**
 * GET/POST 401: missing session; 403: nonparticipant; 404: conversation absent.
 * Legacy viewer userId and senderId fields are accepted for compatibility and
 * ignored; read state and sender identity always come from the server session.
 */
export const GET = handlers.GET
export const POST = handlers.POST
