import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createNotification } from '@/actions/notifications'

export async function GET(req: NextRequest) {
  // Keep the request available for the existing optional CRON_SECRET guard
  // below without changing its current dev-mode behavior.
  void req
  // 1. TẠM TẮT BẢO MẬT ĐỂ MỞ CỬA CHO TRÌNH DUYỆT TEST (Chỉ dùng khi Dev)
  // Khi nào làm khóa luận xong, đưa lên môi trường thật thì bỏ comment đoạn này ra
  /*
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  */

  // 2. XÁC ĐỊNH THỜI ĐIỂM CHỐT SỔ (Quá 72h kể từ lúc kết thúc buổi học)
  const now = new Date()
  const cutoffTime = new Date(now.getTime() - 72 * 60 * 60 * 1000)

  try {
    // 3. TÌM CÁC HỒ SƠ TỒN ĐỌNG (Trạng thái CONFIRMED & Đã quá 72h)
    const expiredBookings = await prisma.booking.findMany({
      where: {
        status: 'CONFIRMED',
        endTime: {
          lt: cutoffTime,
        },
      },
      include: {
        mentor: { select: { name: true, email: true } },
        mentee: { select: { name: true, email: true } },
      },
    })

    // Nếu không có ai nợ đọng thì báo cáo về và đi ngủ
    if (expiredBookings.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'Không có booking nào cần chốt sổ.' })
    }

    let processedCount = 0
    const processedIds: string[] = []
    // 4. XỬ LÝ TỪNG HỒ SƠ BẰNG TRANSACTION (Quy tắc All-or-Nothing)
    for (const booking of expiredBookings) {
      const wasCompleted = await prisma.$transaction(async (tx) => {
        // A. Claim booking theo điều kiện ngay trong transaction. Nếu một cron
        // khác đã chốt trước, tuyệt đối không cộng điểm hoặc ghi sổ lần hai.
        const claim = await tx.booking.updateMany({
          where: {
            id: booking.id,
            status: 'CONFIRMED',
          },
          data: { status: 'COMPLETED' },
        })

        if (claim.count !== 1) {
          return false
        }

        // B. Cộng điểm cho Mentor 
        // LƯU Ý: Chỗ này giả định giá mặc định là 1 điểm. Nếu DB của bạn 
        // có lưu giá trong bảng booking (VD: booking.price) thì thay số 1 bằng số đó.
        const pointsToEarn = 1; 

        await tx.user.update({
          where: { id: booking.mentorId },
          data: { givePoints: { increment: pointsToEarn } },
        })

        // C. Ghi sổ TransactionLog để có bằng chứng
        await tx.transactionLog.create({
          data: {
            userId: booking.mentorId,
            amount: pointsToEarn,
            type: "BOOKING_COMPLETED", 
            bookingId: booking.id 
          },
        })

        return true
      })

      if (!wasCompleted) {
        continue
      }

      // Notifications are intentionally post-commit and best-effort:
      // a notification failure must not roll back or report a successfully
      // settled booking as failed.
      const mentorName = booking.mentor.name ?? booking.mentor.email ?? 'Mentor'
      const menteeName = booking.mentee.name ?? booking.mentee.email ?? 'Mentee'
      await Promise.all([
        createNotification(
          booking.mentorId,
          'Buổi học đã được tự động hoàn thành',
          'Buổi học với ' + menteeName + ' đã được hệ thống chốt sau 72 giờ. 1 GivePoint đã được chuyển vào ví của bạn.',
          'POINTS',
          '/history',
        ),
        createNotification(
          booking.menteeId,
          'Buổi học đã được tự động hoàn thành',
          'Buổi học với ' + mentorName + ' đã được hệ thống chốt sau 72 giờ. 1 GivePoint đã được chuyển cho Mentor.',
          'SYSTEM',
          '/history',
        ),
      ])
      processedIds.push(booking.id)
      processedCount++
    }

    // Báo cáo thành công
    return NextResponse.json({
        ok: true,
        processed: processedCount,
        ids: processedIds, // <-- Thêm dòng này
        message: 'Chốt sổ thành công!',
      })
  } catch (error) {
    console.error('[Cron Auto-Complete] Lỗi:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
