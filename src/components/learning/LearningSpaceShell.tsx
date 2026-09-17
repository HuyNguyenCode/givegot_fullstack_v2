import Link from 'next/link'
import { Archive, ArrowRight, BookOpen, CalendarDays, CheckSquare, History, NotebookPen, Users } from 'lucide-react'

import type { AuthorizedLearningSpaceShellData } from '@/lib/learning-space-shell'

type Props = { space: AuthorizedLearningSpaceShellData }

const formatDate = (date: Date) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(date)

function Placeholder({ icon: Icon, title, detail }: { icon: typeof BookOpen; title: string; detail: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`${title}-heading`}>
      <Icon aria-hidden="true" className="mb-3 h-5 w-5 text-purple-600" />
      <h2 id={`${title}-heading`} className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{detail}</p>
      <p className="mt-3 text-xs font-medium text-slate-500">Sắp có trong Learning Hub</p>
    </section>
  )
}

export function LearningSpaceShell({ space }: Props) {
  const now = new Date()
  const nextBooking = space.bookings.find(booking => booking.endTime >= now && !['CANCELLED', 'MISSED'].includes(booking.status))
  const partner = space.members.find(member => member.id !== space.viewerId)
  const archived = space.state === 'ARCHIVED'

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Điều hướng LearningSpace" className="mb-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-purple-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">
            <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />
            Bảng điều khiển
          </Link>
        </nav>

        {archived && (
          <div role="status" className="mb-5 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <Archive aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
            <div><p className="font-semibold">LearningSpace đã lưu trữ</p><p className="mt-1 text-sm leading-6">Không gian này vẫn có thể xem. Các thay đổi đang được khóa; bạn vẫn có thể đặt buổi học tiếp theo.</p></div>
          </div>
        )}

        <header className="rounded-2xl bg-gradient-to-br from-purple-700 to-indigo-700 p-5 text-white shadow-sm sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-purple-100">LearningSpace riêng tư</p>
              <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">{space.title}</h1>
              <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-sm font-medium break-words"><BookOpen aria-hidden="true" className="h-4 w-4 shrink-0" />{space.primarySkillName}</p>
            </div>
            <div className="rounded-xl bg-white/10 p-3 text-sm"><p className="text-purple-100">Cùng học với</p><p className="mt-1 font-semibold break-words">{space.members.map(member => member.name || member.email || 'Thành viên').join(' · ')}</p></div>
          </div>
        </header>

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="objective-heading">
            <h2 id="objective-heading" className="text-base font-semibold text-slate-900">Mục tiêu chung</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{space.objective || 'Hai bạn chưa thêm mục tiêu chung.'}</p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="done-heading">
            <h2 id="done-heading" className="text-base font-semibold text-slate-900">Định nghĩa hoàn thành</h2>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{space.definitionOfDone || 'Hai bạn chưa xác định tiêu chí hoàn thành.'}</p>
          </section>
        </div>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="topics-heading">
          <div className="flex items-center gap-2"><Users aria-hidden="true" className="h-5 w-5 text-purple-600" /><h2 id="topics-heading" className="text-base font-semibold text-slate-900">Chủ đề phụ</h2></div>
          {space.topics.length ? <ul className="mt-3 flex flex-wrap gap-2">{space.topics.map(topic => <li key={topic.id} className={`max-w-full break-words rounded-full px-3 py-1.5 text-sm ${topic.state === 'ARCHIVED' ? 'bg-slate-100 text-slate-600 line-through' : 'bg-purple-50 text-purple-800'}`}>{topic.label}{topic.state === 'ARCHIVED' ? ' (đã lưu trữ)' : ''}</li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-600">Chưa có chủ đề phụ. Không gian này vẫn sẵn sàng cho buổi học đầu tiên.</p>}
        </section>

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="booking-heading">
          <div className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-5 w-5 text-purple-600" /><h2 id="booking-heading" className="text-base font-semibold text-slate-900">Buổi học hiện tại hoặc tiếp theo</h2></div>
          {nextBooking ? <div className="mt-3 rounded-xl bg-slate-50 p-4"><p className="font-medium text-slate-900">{formatDate(nextBooking.startTime)}</p><p className="mt-1 text-sm text-slate-600">Trạng thái: {nextBooking.status}</p></div> : <p className="mt-3 text-sm leading-6 text-slate-600">Chưa có buổi học nào được liên kết với LearningSpace này.</p>}
          {partner && <Link href={`/book/${partner.id}`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">Đặt buổi học tiếp theo <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
        </section>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Placeholder icon={BookOpen} title="Tài nguyên" detail="Liên kết và tệp riêng tư sẽ xuất hiện tại đây." />
          <Placeholder icon={CheckSquare} title="Công việc" detail="Việc cần làm và tiêu chí hoàn thành sẽ xuất hiện tại đây." />
          <Placeholder icon={NotebookPen} title="Ghi chú" detail="Ghi chú và phần tóm tắt chung sẽ xuất hiện tại đây." />
          <Placeholder icon={History} title="Lịch sử" detail="Hoạt động học tập có cấu trúc sẽ xuất hiện tại đây." />
        </div>
      </div>
    </main>
  )
}
