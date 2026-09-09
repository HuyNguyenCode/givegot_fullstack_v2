import Link from 'next/link'

export default function CancellationPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6">
      <article className="mx-auto max-w-3xl rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
        <Link href="/" className="text-sm font-semibold text-purple-700 hover:text-purple-900">
          ← Về trang chủ
        </Link>
        <h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950">Chính sách hủy buổi học</h1>
        <p className="mt-3 leading-7 text-slate-600">
          Mỗi booking giữ 1 GivePoint của Mentee. Hậu quả cụ thể luôn được hiển thị trước khi bạn xác nhận hủy, dựa trên trạng thái và thời gian thực tế của booking.
        </p>

        <section className="mt-8 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="font-bold text-blue-950">1. Booking đang chờ phản hồi</h2>
          <p className="mt-2 text-sm leading-6 text-blue-900">
            Nếu Mentee hủy yêu cầu hoặc Mentor từ chối, Mentee được hoàn đầy đủ 1 GivePoint. Trust Score của cả hai bên không thay đổi.
          </p>
        </section>

        <section className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="font-bold text-amber-950">2. Booking đã xác nhận — Mentee hủy</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-amber-900">
            <li>Từ 12 giờ trở lên: hoàn 1 GivePoint cho Mentee; Trust Score của Mentee giảm 2 điểm.</li>
            <li>Dưới 12 giờ: Mentee không được hoàn điểm; 1 GivePoint được chuyển cho Mentor để bồi thường; Trust Score của Mentee giảm 10 điểm.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-5">
          <h2 className="font-bold text-purple-950">3. Booking đã xác nhận — Mentor hủy</h2>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-6 text-purple-900">
            <li>Mentee luôn được hoàn đầy đủ 1 GivePoint.</li>
            <li>Từ 12 giờ trở lên: Trust Score của Mentor giảm 5 điểm.</li>
            <li>Dưới 12 giờ: Trust Score của Mentor giảm 20 điểm.</li>
          </ul>
        </section>

        <section className="mt-4 rounded-xl border border-red-200 bg-red-50 p-5">
          <h2 className="font-bold text-red-950">4. An toàn tài khoản</h2>
          <p className="mt-2 text-sm leading-6 text-red-900">
            Nếu Trust Score mới thấp hơn 30, hệ thống sẽ đình chỉ tài khoản. Mọi thay đổi GivePoint và Trust Score được lưu trong lịch sử giao dịch.
          </p>
        </section>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/dashboard" className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
            Mở Dashboard
          </Link>
          <Link href="/history" className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            Xem lịch sử giao dịch
          </Link>
        </div>
      </article>
    </main>
  )
}
