import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/conversations?userId=<id>
// Returns all conversations for a user, with last message + unread count.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 })
  }

  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        OR: [{ userAId: userId }, { userBId: userId }],
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
                senderId: { not: userId },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    })

    const result = conversations.map((conv) => ({
      id: conv.id,
      bookingId: conv.bookingId,
      partner: conv.userAId === userId ? conv.userB : conv.userA,
      lastMessage: conv.messages[0]
        ? { ...conv.messages[0], createdAt: conv.messages[0].createdAt.toISOString() }
        : null,
      unreadCount: conv._count.messages,
      booking: {
        startTime: conv.booking.startTime.toISOString(),
        status: conv.booking.status,
      },
    }))

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Conversations GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/conversations  { bookingId, userId }
// Idempotent: returns existing conversation or creates a new one.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { bookingId, userId } = body as { bookingId?: string; userId?: string }

    if (!bookingId || !userId) {
      return NextResponse.json({ error: 'bookingId and userId are required' }, { status: 400 })
    }

    // Return existing conversation if one already exists for this booking
    const existing = await prisma.conversation.findUnique({
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
      return NextResponse.json({
        id: existing.id,
        bookingId: existing.bookingId,
        partner: existing.userAId === userId ? existing.userB : existing.userA,
        lastMessage: existing.messages[0]
          ? { ...existing.messages[0], createdAt: existing.messages[0].createdAt.toISOString() }
          : null,
        unreadCount: 0,
        booking: {
          startTime: existing.booking.startTime.toISOString(),
          status: existing.booking.status,
        },
      })
    }

    // Fetch the booking to get participants
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { mentorId: true, menteeId: true, startTime: true, status: true },
    })

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    if (booking.mentorId !== userId && booking.menteeId !== userId) {
      return NextResponse.json(
        { error: 'Unauthorized: you are not a participant of this booking' },
        { status: 403 }
      )
    }

    // Create new conversation (mentee = userA, mentor = userB)
    const conv = await prisma.conversation.create({
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
      id: conv.id,
      bookingId: conv.bookingId,
      partner: conv.userAId === userId ? conv.userB : conv.userA,
      lastMessage: null,
      unreadCount: 0,
      booking: {
        startTime: conv.booking.startTime.toISOString(),
        status: conv.booking.status,
      },
    })
  } catch (error) {
    console.error('[Conversations POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
