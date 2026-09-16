import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { createConversationRouteHandlers } from '../../../src/lib/conversation-route-handlers'
import { createMessageRouteHandlers } from '../../../src/lib/message-route-handlers'
import {
  AuthorizationError,
  assertConversationParticipant,
  type AuthenticatedUser,
} from '../../../src/lib/server-authorization'

const ACTOR_A: AuthenticatedUser = Object.freeze({
  id: 'user-a',
  email: 'a@example.com',
  name: 'User A',
})

const ACTOR_B: AuthenticatedUser = Object.freeze({
  id: 'user-b',
  email: 'b@example.com',
  name: 'User B',
})

const CONVERSATION = {
  id: 'conversation-1',
  bookingId: 'booking-1',
  userAId: ACTOR_A.id,
  userBId: ACTOR_B.id,
  userA: { id: ACTOR_A.id, name: ACTOR_A.name, email: ACTOR_A.email, avatarUrl: null },
  userB: { id: ACTOR_B.id, name: ACTOR_B.name, email: ACTOR_B.email, avatarUrl: null },
  booking: {
    startTime: new Date('2026-09-15T08:00:00.000Z'),
    status: 'CONFIRMED',
  },
  messages: [{
    id: 'message-1',
    content: 'hello',
    senderId: ACTOR_B.id,
    createdAt: new Date('2026-09-12T00:00:00.000Z'),
  }],
  _count: { messages: 1 },
}

type ConversationDependencies = Parameters<typeof createConversationRouteHandlers>[0]
type MessageDependencies = Parameters<typeof createMessageRouteHandlers>[0]

test('an unauthenticated conversations request is rejected before data access', async () => {
  let queried = false
  const handlers = createConversationRouteHandlers({
    prisma: {
      conversation: {
        findMany: async () => {
          queried = true
          return []
        },
      },
    } as unknown as ConversationDependencies['prisma'],
    requireAuthenticatedUser: async () => {
      throw new AuthorizationError(401, 'Authentication required')
    },
  })

  const response = await handlers.GET(new NextRequest('http://local/api/conversations'))

  assert.equal(response.status, 401)
  assert.equal(queried, false)
})

test('user A cannot list user B conversations by changing the legacy query parameter', async () => {
  let query: unknown
  const handlers = createConversationRouteHandlers({
    prisma: {
      conversation: {
        findMany: async (args: unknown) => {
          query = args
          return [CONVERSATION]
        },
      },
    } as unknown as ConversationDependencies['prisma'],
    requireAuthenticatedUser: async () => ACTOR_A,
  })

  const response = await handlers.GET(
    new NextRequest('http://local/api/conversations?userId=user-b'),
  )
  const payload = await response.json() as Array<{ partner: { id: string } }>

  assert.equal(response.status, 200)
  assert.equal(payload[0].partner.id, ACTOR_B.id)
  assert.deepEqual(query, {
    where: { OR: [{ userAId: ACTOR_A.id }, { userBId: ACTOR_A.id }] },
    include: {
      userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
      userB: { select: { id: true, name: true, email: true, avatarUrl: true } },
      booking: { select: { startTime: true, status: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, content: true, senderId: true, createdAt: true },
      },
      _count: {
        select: {
          messages: {
            where: { isRead: false, senderId: { not: ACTOR_A.id } },
          },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  })
})

test('a nonparticipant cannot open or mark a conversation read', async () => {
  let listed = false
  let markedRead = false
  const handlers = createMessageRouteHandlers({
    prisma: {
      message: {
        findMany: async () => {
          listed = true
          return []
        },
        updateMany: async () => {
          markedRead = true
          return { count: 0 }
        },
      },
    } as unknown as MessageDependencies['prisma'],
    pusherServer: { trigger: async () => ({}) } as unknown as MessageDependencies['pusherServer'],
    requireAuthenticatedUser: async () => ({
      id: 'user-c',
      email: 'c@example.com',
      name: 'User C',
    }),
    requireConversationParticipant: async (_conversationId, actor) => {
      assertConversationParticipant(CONVERSATION, actor ?? ACTOR_A)
      return CONVERSATION
    },
  })

  const response = await handlers.GET(
    new NextRequest(
      'http://local/api/messages?conversationId=conversation-1&userId=user-a',
    ),
  )

  assert.equal(response.status, 403)
  assert.equal(listed, false)
  assert.equal(markedRead, false)
})

test('message sender and read viewer come from the session for legitimate participants', async () => {
  let createdData: unknown
  let readWhere: unknown
  const sentMessage = {
    id: 'message-2',
    content: 'session-owned',
    senderId: ACTOR_A.id,
    isRead: false,
    createdAt: new Date('2026-09-12T01:00:00.000Z'),
  }
  const handlers = createMessageRouteHandlers({
    prisma: {
      message: {
        findMany: async () => [sentMessage],
        updateMany: async (args: { where: unknown }) => {
          readWhere = args.where
          return { count: 1 }
        },
        create: async (args: { data: unknown }) => {
          createdData = args.data
          return sentMessage
        },
      },
      conversation: {
        update: async () => CONVERSATION,
      },
    } as unknown as MessageDependencies['prisma'],
    pusherServer: {
      trigger: async () => ({}),
    } as unknown as MessageDependencies['pusherServer'],
    requireAuthenticatedUser: async () => ACTOR_A,
    requireConversationParticipant: async (_conversationId, actor) => {
      return assertConversationParticipant(CONVERSATION, actor ?? ACTOR_A)
    },
  })

  const readResponse = await handlers.GET(
    new NextRequest(
      'http://local/api/messages?conversationId=conversation-1&userId=user-b',
    ),
  )
  assert.equal(readResponse.status, 200)
  assert.deepEqual(readWhere, {
    conversationId: CONVERSATION.id,
    senderId: { not: ACTOR_A.id },
    isRead: false,
  })

  const sendResponse = await handlers.POST(new NextRequest('http://local/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId: CONVERSATION.id,
      senderId: ACTOR_B.id,
      content: '  session-owned  ',
    }),
  }))
  const sendPayload = await sendResponse.json() as { senderId: string; content: string }

  assert.equal(sendResponse.status, 201)
  assert.equal(sendPayload.senderId, ACTOR_A.id)
  assert.deepEqual(createdData, {
    conversationId: CONVERSATION.id,
    senderId: ACTOR_A.id,
    content: 'session-owned',
  })
})

test('conversation creation keeps the Booking mentee-to-mentor association', async () => {
  let createdData: unknown
  const createdConversation = {
    ...CONVERSATION,
    messages: [],
  }
  const handlers = createConversationRouteHandlers({
    prisma: {
      conversation: {
        findUnique: async () => null,
        create: async (args: { data: unknown }) => {
          createdData = args.data
          return createdConversation
        },
      },
      booking: {
        findUnique: async () => ({
          mentorId: ACTOR_B.id,
          menteeId: ACTOR_A.id,
          startTime: CONVERSATION.booking.startTime,
          status: CONVERSATION.booking.status,
        }),
      },
    } as unknown as ConversationDependencies['prisma'],
    requireAuthenticatedUser: async () => ACTOR_A,
  })

  const response = await handlers.POST(new NextRequest('http://local/api/conversations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ bookingId: 'booking-1', userId: 'spoofed-user' }),
  }))
  const payload = await response.json() as { partner: { id: string } }

  assert.equal(response.status, 200)
  assert.equal(payload.partner.id, ACTOR_B.id)
  assert.deepEqual(createdData, {
    bookingId: 'booking-1',
    userAId: ACTOR_A.id,
    userBId: ACTOR_B.id,
  })
})
