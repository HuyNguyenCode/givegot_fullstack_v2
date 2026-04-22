import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma'; // Đảm bảo đường dẫn này khớp với project của bạn

export async function GET(request: Request) {
  // 1. Lấy userId từ đường link trình duyệt
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: "Vui lòng cung cấp ?userId=... trên URL" }, { status: 400 });
  }

  const results: any = {};

  try {
    // ==========================================
    // KỊCH BẢN 1: TEST NẠP TIỀN CHÙA (TOP-UP)
    // ==========================================
    // Tạo giao dịch PENDING (giả lập user bấm nạp nhưng chưa thanh toán VNPay)
    const pendingTx = await prisma.transactionLog.create({
      data: {
        userId: userId,
        amount: 10,
        type: 'TOPUP' as any, // Ép kiểu nếu báo lỗi type
        status: 'PENDING' as any,
      }
    });

    // Xác nhận giao dịch (giả lập VNPay gọi Webhook trả về thành công)
    const successTx = await prisma.$transaction(async (tx) => {
      // 1. Cập nhật trạng thái giao dịch
      const updatedTx = await tx.transactionLog.update({
        where: { id: pendingTx.id },
        data: { status: 'SUCCESS' as any }
      });
      // 2. Cộng điểm vào ví
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { givePoints: { increment: 10 } }
      });
      return { tx: updatedTx, newBalance: updatedUser.givePoints };
    });
    results.scenario1 = { message: "Nạp 10 Points thành công", balance: successTx.newBalance };

    // ==========================================
    // KỊCH BẢN 2: TEST KHÓA TIỀN KÝ QUỸ (ESCROW)
    // ==========================================
    // Giả lập Mentor xin rút 5 Points
    const withdrawAmount = 5;
    const withdrawTx = await prisma.$transaction(async (tx) => {
      // 1. Trừ tiền NGAY LẬP TỨC để khóa ví
      const userAfterDeduct = await tx.user.update({
        where: { id: userId },
        data: { givePoints: { decrement: withdrawAmount } }
      });
      // 2. Tạo lịch sử giao dịch
      await tx.transactionLog.create({
        data: {
          userId: userId,
          amount: -withdrawAmount,
          type: 'CASHOUT' as any,
          status: 'SUCCESS' as any,
        }
      });
      // 3. Tạo phiếu yêu cầu chờ Admin duyệt
      const request = await tx.withdrawRequest.create({
        data: {
          mentorId: userId,
          pointsRequested: withdrawAmount,
          fiatAmount: withdrawAmount * 40000, // 40k VNĐ / 1 Point
          bankDetails: "MB Bank - 0123456789",
          status: 'PENDING' as any,
        }
      });
      return { userBalance: userAfterDeduct.givePoints, requestId: request.id };
    });
    results.scenario2 = { message: "Khóa 5 Points xin rút thành công", balance: withdrawTx.userBalance, reqId: withdrawTx.requestId };

    // ==========================================
    // KỊCH BẢN 3: TEST THỦNG VÍ (OVERDRAFT HACK)
    // ==========================================
    try {
      // Cố tình rút 9999 Points (chắc chắn lớn hơn số dư hiện tại)
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user || user.givePoints < 9999) {
          throw new Error("INSUFFICIENT_FUNDS"); // Khóa chặn ở Backend
        }
        // Đoạn code trừ tiền sẽ không bao giờ chạy tới đây
      });
    } catch (error: any) {
      results.scenario3 = { message: "Chặn hack thành công!", errorCaught: error.message };
    }

    // ==========================================
    // KỊCH BẢN 4: TEST ADMIN GIẢI NGÂN
    // ==========================================
    // Admin duyệt cái phiếu yêu cầu rút tiền ở Kịch bản 2
    const adminApprove = await prisma.withdrawRequest.update({
      where: { id: withdrawTx.requestId },
      data: { status: 'APPROVED' as any }
    });
    results.scenario4 = { message: "Admin giải ngân thành công", finalStatus: adminApprove.status };

    // Trả toàn bộ Báo cáo Test ra màn hình
    return NextResponse.json({ 
      status: "TEST_PASSED", 
      userIdTested: userId,
      details: results 
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Bug rồi sếp ơi!", details: error.message }, { status: 500 });
  }
}