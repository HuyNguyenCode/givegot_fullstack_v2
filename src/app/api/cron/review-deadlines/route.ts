import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const HOUR_MS = 60 * 60 * 1000

export type ReviewDeadlineMilestone = '24H_LEFT' | '2H_LEFT' | 'OVERDUE'

/**
 * Returns the most relevant milestone for a still-CONFIRMED booking. The
 * broad windows allow a delayed cron to catch up, while notification
 * deduplication guarantees each user sees each milestone at most once.
 */
export function getReviewDeadlineMilestone(
  endTime: Date,
  now: Date,
): ReviewDeadlineMilestone | null {
  const elapsedHours = (now.getTime() - endTime.getTime()) / HOUR_MS
  if (elapsedHours < 24 || elapsedHours >= 72) return null
  if (elapsedHours >= 48) return 'OVERDUE'
  if (elapsedHours >= 46) return '2H_LEFT'
  return '24H_LEFT'
}

async function createNotificationOnce(input: {
  userId: string
  title: string
  message: string
  link: string
}) {
  try {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        title: input.title,
        link: input.link,
      },
      select: { id: true },
    })
    if (existing) return false

    await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: 'SYSTEM',
        link: input.link,
      },
    })
    return true
  } catch (error) {
    // Deadline notifications are advisory and must never change or block the
    // booking/payment lifecycle.
    console.error('[Review deadline notification] Failed:', error)
    return false
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  // Local staging remains easy to test without a secret. Production always
  // refuses an unconfigured or invalid cron request.
  if (!cronSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET environment variable is not set.' }, { status: 500 })
  }
  if (cronSecret && authHeader !== 'Bearer ' + cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const oldestEligibleEnd = new Date(now.getTime() - 72 * HOUR_MS)
  const newestEligibleEnd = new Date(now.getTime() - 24 * HOUR_MS)

  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: {
          gt: oldestEligibleEnd,
          lte: newestEligibleEnd,
        },
      },
      select: {
        id: true,
        endTime: true,
        mentorId: true,
        menteeId: true,
        mentor: { select: { name: true, email: true } },
        mentee: { select: { name: true, email: true } },
      },
    })

    let sent = 0
    for (const booking of bookings) {
      const milestone = getReviewDeadlineMilestone(booking.endTime, now)
      if (!milestone) continue

      const mentorName = booking.mentor.name ?? booking.mentor.email ?? 'Mentor'
      const menteeName = booking.mentee.name ?? booking.mentee.email ?? 'Mentee'
      const link = '/dashboard?bookingId=' + booking.id + '&deadline=' + milestone

      const copy = milestone === '24H_LEFT'
        ? {
            menteeTitle: 'Còn 24 giờ để review hoặc báo vắng',
            menteeMessage: 'Buổi học với ' + mentorName + ' còn 24 giờ trong thời hạn review/no-show. Sau hạn này, booking mới sẽ bị khóa nếu bạn chưa review.',
            mentorTitle: 'Còn 24 giờ trong thời hạn báo vắng',
            mentorMessage: 'Buổi học với ' + menteeName + ' còn 24 giờ để gửi báo cáo vắng mặt nếu cần. GivePoint vẫn đang được giữ.',
          }
        : milestone === '2H_LEFT'
          ? {
              menteeTitle: 'Chỉ còn 2 giờ để review hoặc báo vắng',
              menteeMessage: 'Hãy xử lý buổi học với ' + mentorName + ' trước khi hết hạn. Nếu chưa review, bạn sẽ không thể đặt booking mới.',
              mentorTitle: 'Chỉ còn 2 giờ để báo vắng',
              mentorMessage: 'Thời hạn báo Mentee vắng ở buổi học với ' + menteeName + ' sắp kết thúc.',
            }
          : {
              menteeTitle: 'Đã quá hạn review / báo vắng',
              menteeMessage: 'Buổi học với ' + mentorName + ' đã quá hạn 48 giờ. Booking mới hiện bị khóa; hãy review trước khi hệ thống tự chốt khi đủ 72 giờ.',
              mentorTitle: 'Đã kết thúc thời hạn báo vắng',
              mentorMessage: 'Buổi học với ' + menteeName + ' đang chờ hệ thống tự chốt khi đủ 72 giờ. GivePoint vẫn đang được giữ.',
            }

      const results = await Promise.all([
        createNotificationOnce({
          userId: booking.menteeId,
          title: copy.menteeTitle,
          message: copy.menteeMessage,
          link,
        }),
        createNotificationOnce({
          userId: booking.mentorId,
          title: copy.mentorTitle,
          message: copy.mentorMessage,
          link,
        }),
      ])
      sent += results.filter(Boolean).length
    }

    return NextResponse.json({
      ok: true,
      bookings: bookings.length,
      sent,
      message: 'Đã xử lý notification deadline review/no-show.',
    })
  } catch (error) {
    console.error('[Review deadline cron] Failed:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
