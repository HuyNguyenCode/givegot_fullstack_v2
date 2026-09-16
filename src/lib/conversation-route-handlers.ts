import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import {
  assertConversationParticipant,
  isAuthorizationError,
  type AuthenticatedUser,
} from '@/lib/server-authorization'

export type ConversationRouteDependencies = {
  prisma: Pick<typeof prisma, 'conversation' | 'booking'>
  requireAuthenticatedUser(): Promise<AuthenticatedUser>
}

function authorizationResponse(error: unknown): NextResponse | null {
  if (!isAuthorizationError(error)) return null
  return NextResponse.json({ error: error.message }, { status: error.status })
}

export function createConversationRouteHandlers(dependencies: ConversationRouteDependencies) {
  async function GET(req: NextRequest) {
    void req

    try {
      const actor = await dependencies.requireAuthenticatedUser()
      const conversations = await dependencies.prisma.conversation.findMany({
        where: {
          OR: [{ userAId: actor.id }, { userBId: actor.id }],
        },
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
                where: {
                  isRead: false,
                  senderId: { not: actor.id },
                },
              },
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      })

      const result = conversations.map((conversation) => ({
        id: conversation.id,
        bookingId: conversation.bookingId,
        partner: conversation.userAId === actor.id ? conversation.userB : conversation.userA,
        lastMessage: conversation.messages[0]
          ? {
              ...conversation.messages[0],
              createdAt: conversation.messages[0].createdAt.toISOString(),
            }
          : null,
        unreadCount: conversation._count.messages,
        booking: {
          startTime: conversation.booking.startTime.toISOString(),
          status: conversation.booking.status,
        },
      }))

      return NextResponse.json(result)
    } catch (error) {
      const denied = authorizationResponse(error)
      if (denied) return denied
      console.error('[Conversations GET] Error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  async function POST(req: NextRequest) {
    try {
      const actor = await dependencies.requireAuthenticatedUser()
      const body = await req.json()
      const { bookingId } = body as { bookingId?: string; userId?: string }

      if (!bookingId) {
        return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
      }

      const existing = await dependencies.prisma.conversation.findUnique({
        where: { bookingId },
        include: {
          userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
          userB: { select: { id: true, name: true, email: true, avatarUrl: true } },
          booking: { select: { startTime: true, status: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, content: true, senderId: true, createdAt: true },
          },
        },
      })

      if (existing) {
        assertConversationParticipant(existing, actor)
        return NextResponse.json({
          id: existing.id,
          bookingId: existing.bookingId,
          partner: existing.userAId === actor.id ? existing.userB : existing.userA,
          lastMessage: existing.messages[0]
            ? {
                ...existing.messages[0],
                createdAt: existing.messages[0].createdAt.toISOString(),
              }
            : null,
          unreadCount: 0,
          booking: {
            startTime: existing.booking.startTime.toISOString(),
            status: existing.booking.status,
          },
        })
      }

      const booking = await dependencies.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { mentorId: true, menteeId: true, startTime: true, status: true },
      })

      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
      }

      if (booking.mentorId !== actor.id && booking.menteeId !== actor.id) {
        return NextResponse.json(
          { error: 'You are not a participant of this booking' },
          { status: 403 },
        )
      }

      const conversation = await dependencies.prisma.conversation.create({
        data: {
          bookingId,
          userAId: booking.menteeId,
          userBId: booking.mentorId,
        },
        include: {
          userA: { select: { id: true, name: true, email: true, avatarUrl: true } },
          userB: { select: { id: true, name: true, email: true, avatarUrl: true } },
          booking: { select: { startTime: true, status: true } },
        },
      })

      return NextResponse.json({
        id: conversation.id,
        bookingId: conversation.bookingId,
        partner: conversation.userAId === actor.id ? conversation.userB : conversation.userA,
        lastMessage: null,
        unreadCount: 0,
        booking: {
          startTime: conversation.booking.startTime.toISOString(),
          status: conversation.booking.status,
        },
      })
    } catch (error) {
      const denied = authorizationResponse(error)
      if (denied) return denied
      console.error('[Conversations POST] Error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return { GET, POST }
}
