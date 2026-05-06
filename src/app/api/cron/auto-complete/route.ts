import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
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
    })

    // Nếu không có ai nợ đọng thì báo cáo về và đi ngủ
    if (expiredBookings.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, message: 'Không có booking nào cần chốt sổ.' })
    }

    let processedCount = 0
    const processedIds: string[] = []
    // 4. XỬ LÝ TỪNG HỒ SƠ BẰNG TRANSACTION (Quy tắc All-or-Nothing)
    for (const booking of expiredBookings) {
      await prisma.$transaction(async (tx) => {
        // A. Đổi trạng thái Booking thành COMPLETED
        await tx.booking.update({
          where: { id: booking.id },
          data: { status: 'COMPLETED' },
        })

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
  
            // bạn có thể mở comment dòng dưới đây:
            // bookingId: booking.id 
          },
        })
      })
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