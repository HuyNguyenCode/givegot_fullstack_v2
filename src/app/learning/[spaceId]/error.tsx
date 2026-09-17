'use client'

export default function LearningSpaceError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-10"><section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-xl font-bold text-slate-900">Không thể tải LearningSpace</h1><p className="mt-2 text-sm leading-6 text-slate-600">Vui lòng thử lại. Nếu lỗi tiếp diễn, hãy quay lại bảng điều khiển.</p><button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">Thử lại</button></section></main>
}
