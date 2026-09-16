import { prisma } from '@/lib/prisma'
import { createConversationRouteHandlers } from '@/lib/conversation-route-handlers'
import { requireAuthenticatedUser } from '@/lib/server-authorization'

const handlers = createConversationRouteHandlers({
  prisma,
  requireAuthenticatedUser,
})

/**
 * GET 401: missing session. The session-scoped collection does not emit 403/404.
 * POST 401: missing session; 403: nonparticipant; 404: Booking not found.
 * Legacy userId query/body fields are accepted for compatibility and ignored.
 */
export const GET = handlers.GET
export const POST = handlers.POST
