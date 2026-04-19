import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { pusherServer } from '@/lib/pusher'

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/messages?conversationId=<id>
// Returns all messages in a conversation ordered oldest → newest.
// Also marks messages from the other user as read.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const conversationId = req.nextUrl.searchParams.get('conversationId')
  const viewerId = req.nextUrl.searchParams.get('userId') // optional: for marking read

  if (!conversationId) {
    return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
  }

  try {
    const messages = await prisma.message.findMany({
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

    // Mark incoming messages as read in the background
    if (viewerId) {
      prisma.message
        .updateMany({
          where: {
            conversationId,
            senderId: { not: viewerId },
            isRead: false,
          },
          data: { isRead: true },
        })
        .catch((e) => console.error('[Messages GET] Mark-read failed:', e))
    }

    return NextResponse.json(
      messages.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() }))
    )
  } catch (error) {
    console.error('[Messages GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/messages  { conversationId, senderId, content }
// Saves the message to DB then triggers a Pusher event for real-time delivery.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { conversationId, senderId, content } = body as {
      conversationId?: string
      senderId?: string
      content?: string
    }

    if (!conversationId || !senderId || !content?.trim()) {
      return NextResponse.json(
        { error: 'conversationId, senderId, and content are required' },
        { status: 400 }
      )
    }

    // Verify sender is a participant
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { userAId: true, userBId: true },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    if (conversation.userAId !== senderId && conversation.userBId !== senderId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Persist message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId,
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

    // Bump conversation.updatedAt so it floats to top of sidebar
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    })

    const payload = { ...message, createdAt: message.createdAt.toISOString() }

    // ── Real-time: broadcast to all subscribers on this conversation's channel ──
    await pusherServer.trigger(`conversation-${conversationId}`, 'new-message', payload)

    return NextResponse.json(payload, { status: 201 })
  } catch (error) {
    console.error('[Messages POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
