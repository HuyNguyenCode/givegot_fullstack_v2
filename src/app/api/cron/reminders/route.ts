import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/actions/notifications'

/**
 * GET /api/cron/reminders
 *
 * Designed to be called by a cron service (Vercel Cron, GitHub Actions, etc.)
 * every ~5 minutes.
 *
 * Security: Validates the `Authorization: Bearer <CRON_SECRET>` header.
 * Set CRON_SECRET in your environment variables.
 *
 * Logic:
 *   - Finds all CONFIRMED bookings whose startTime is between NOW and NOW+30min
 *   - Creates an in-app "session starting soon" notification for both mentor and mentee
 *   - Placeholder: Send transactional email via Resend / Nodemailer here
 *
 * Example cron schedule (Vercel cron.json):
 *   { "path": "/api/cron/reminders", "schedule": "* * * * *" }
 */
export async function GET(req: NextRequest) {
  // ── Security guard ───────────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    // CRON_SECRET not configured — refuse to run to avoid accidental data leaks
    return NextResponse.json(
      { error: 'CRON_SECRET environment variable is not set.' },
      { status: 500 }
    )
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Time window: sessions starting within the next 15-30 minutes ─────────
  const now = new Date()
  const windowStart = new Date(now.getTime() + 15 * 60 * 1000) // now + 15 min
  const windowEnd   = new Date(now.getTime() + 30 * 60 * 1000) // now + 30 min

  try {
    const upcomingBookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        startTime: {
          gte: windowStart,
          lte: windowEnd,
        },
      },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        mentee: { select: { id: true, name: true, email: true } },
      },
    })

    if (upcomingBookings.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, message: 'No upcoming sessions.' })
    }

    let notificationsSent = 0

    for (const booking of upcomingBookings) {
      const startFormatted = booking.startTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      })

      // ── In-app notification: Mentee ───────────────────────────────────────
      await createNotification(
        booking.menteeId,
        'Your session starts soon!',
        `Your session with ${booking.mentor.name || booking.mentor.email} starts at ${startFormatted} UTC. Make sure you're ready!`,
        'SYSTEM',
        '/history'
      )

      // ── In-app notification: Mentor ───────────────────────────────────────
      await createNotification(
        booking.mentorId,
        'Upcoming session reminder',
        `You have a session with ${booking.mentee.name || booking.mentee.email} starting at ${startFormatted} UTC.`,
        'SYSTEM',
        '/dashboard'
      )

      notificationsSent += 2

      // ────────────────────────────────────────────────────────────────────────
      // TODO: Email Reminders (Phase 5 — integrate Resend or Nodemailer here)
      //
      // Example with Resend:
      //   import { Resend } from 'resend'
      //   const resend = new Resend(process.env.RESEND_API_KEY)
      //
      //   await resend.emails.send({
      //     from: 'GiveGot <noreply@givegot.app>',
      //     to: booking.mentee.email,
      //     subject: 'Your GiveGot session starts in 15 minutes!',
      //     html: `<p>Hi ${booking.mentee.name},<br/>Your session with ${booking.mentor.name} starts at ${startFormatted}.</p>`,
      //   })
      //
      //   await resend.emails.send({
      //     from: 'GiveGot <noreply@givegot.app>',
      //     to: booking.mentor.email,
      //     subject: 'Reminder: You have an upcoming session on GiveGot',
      //     html: `<p>Hi ${booking.mentor.name},<br/>You have a session with ${booking.mentee.name} starting at ${startFormatted}.</p>`,
      //   })
      // ────────────────────────────────────────────────────────────────────────
    }

    return NextResponse.json({
      ok: true,
      sent: notificationsSent,
      bookings: upcomingBookings.length,
      window: { from: windowStart.toISOString(), to: windowEnd.toISOString() },
    })
  } catch (error) {
    console.error('[Cron] Reminders job failed:', error)
    return NextResponse.json(
      { error: 'Internal server error', detail: String(error) },
      { status: 500 }
    )
  }
}
