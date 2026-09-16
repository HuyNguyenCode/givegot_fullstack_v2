import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'
import { privateConversationChannel } from '@/lib/realtime-channels'
import {
  isAuthorizationError,
  type AuthenticatedUser,
  type ConversationParticipant,
} from '@/lib/server-authorization'

export type MessageRouteDependencies = {
  prisma: Pick<typeof prisma, 'message' | 'conversation'>
  pusherServer: Pick<typeof pusherServer, 'trigger'>
  requireAuthenticatedUser(): Promise<AuthenticatedUser>
  requireConversationParticipant(
    conversationId: string,
    authenticatedUser?: AuthenticatedUser,
  ): Promise<ConversationParticipant>
}

function authorizationResponse(error: unknown): NextResponse | null {
  if (!isAuthorizationError(error)) return null
  return NextResponse.json({ error: error.message }, { status: error.status })
}

export function createMessageRouteHandlers(dependencies: MessageRouteDependencies) {
  async function GET(req: NextRequest) {
    const conversationId = req.nextUrl.searchParams.get('conversationId')

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    try {
      const actor = await dependencies.requireAuthenticatedUser()
      await dependencies.requireConversationParticipant(conversationId, actor)

      const messages = await dependencies.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          senderId: true,
          isRead: true,
          createdAt: true,
        },
      })

      // Read state is owned by the session viewer. A failure remains non-fatal
      // so the legacy message-list response is still available.
      await dependencies.prisma.message.updateMany({
        where: {
          conversationId,
          senderId: { not: actor.id },
          isRead: false,
        },
        data: { isRead: true },
      }).catch((error: unknown) => {
        console.error('[Messages GET] Mark-read failed:', error)
      })

      return NextResponse.json(
        messages.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        })),
      )
    } catch (error) {
      const denied = authorizationResponse(error)
      if (denied) return denied
      console.error('[Messages GET] Error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  async function POST(req: NextRequest) {
    try {
      const actor = await dependencies.requireAuthenticatedUser()
      const body = await req.json()
      const { conversationId, content } = body as {
        conversationId?: string
        senderId?: string
        content?: string
      }

      if (!conversationId || !content?.trim()) {
        return NextResponse.json(
          { error: 'conversationId and content are required' },
          { status: 400 },
        )
      }

      await dependencies.requireConversationParticipant(conversationId, actor)

      const message = await dependencies.prisma.message.create({
        data: {
          conversationId,
          senderId: actor.id,
          content: content.trim(),
        },
        select: {
          id: true,
          content: true,
          senderId: true,
          isRead: true,
          createdAt: true,
        },
      })

      await dependencies.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      })

      const payload = { ...message, createdAt: message.createdAt.toISOString() }
      await dependencies.pusherServer.trigger(
        privateConversationChannel(conversationId),
        'new-message',
        payload,
      )

      return NextResponse.json(payload, { status: 201 })
    } catch (error) {
      const denied = authorizationResponse(error)
      if (denied) return denied
      console.error('[Messages POST] Error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return { GET, POST }
}
