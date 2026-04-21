import { NextResponse } from "next/server";
// Cập nhật lại đường dẫn import hàm này cho đúng với file của bạn
import { calculateAndUpdateTrustScore } from "@/lib/trust-algorithm"; 

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "Thiếu userId" }, { status: 400 });
  }

  try {
    const result = await calculateAndUpdateTrustScore(userId);
    return NextResponse.json({ 
      message: "Tính toán thành công", 
      result: result 
    });
  } catch (error) {
    return NextResponse.json({ error: "Lỗi chạy thuật toán" }, { status: 500 });
  }
}