import Link from 'next/link'
import { Archive, ArrowRight, BookOpen, CalendarDays } from 'lucide-react'

import type { AuthorizedLearningSpaceShellData } from '@/lib/learning-space-shell'
import type { LearningResourceView } from '@/components/learning/LearningResources'
import { LearningSpaceSections } from '@/components/learning/LearningSpaceSections'
import { LearningSpaceDetails } from '@/components/learning/LearningSpaceDetails'

type Props = { space: AuthorizedLearningSpaceShellData; showFirstValue?: boolean; resources?: LearningResourceView[]; quota?: { usedBytes: string; maxBytes: string } }

const formatDate = (date: Date) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(date)

export function LearningSpaceShell({ space, showFirstValue = false, resources = [], quota = { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) } }: Props) {
  const now = new Date()
  const nextBooking = space.bookings.find(booking => booking.endTime >= now && !['CANCELLED', 'MISSED'].includes(booking.status))
  const partner = space.members.find(member => member.id !== space.viewerId)
  const archived = space.state === 'ARCHIVED'

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <nav aria-label="Điều hướng LearningSpace" className="mb-5">
          <Link href="/learning" className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-purple-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">
            <ArrowRight aria-hidden="true" className="h-4 w-4 rotate-180" />
            Không gian của tôi
          </Link>
          <Link href="/dashboard" className="ml-5 rounded-lg text-sm font-medium text-purple-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">Bảng điều khiển</Link>
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

        <LearningSpaceDetails spaceId={space.id} archived={archived} version={space.version} objective={space.objective} definitionOfDone={space.definitionOfDone} />

        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="booking-heading">
          <div className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="h-5 w-5 text-purple-600" /><h2 id="booking-heading" className="text-base font-semibold text-slate-900">Buổi học hiện tại hoặc tiếp theo</h2></div>
          {nextBooking ? <div className="mt-3 rounded-xl bg-slate-50 p-4"><p className="font-medium text-slate-900">{formatDate(nextBooking.startTime)}</p><p className="mt-1 text-sm text-slate-600">Trạng thái: {nextBooking.status}</p></div> : <p className="mt-3 text-sm leading-6 text-slate-600">Chưa có buổi học nào được liên kết với LearningSpace này.</p>}
          {partner && <Link href={`/book/${partner.id}?learningSpaceId=${encodeURIComponent(space.id)}`} className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">{showFirstValue && !nextBooking ? 'Đặt buổi học đầu tiên' : 'Đặt buổi học tiếp theo'} <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
        </section>

        <LearningSpaceSections spaceId={space.id} viewerId={space.viewerId} archived={archived} resources={resources} quota={quota} topics={space.topics} bookings={space.bookings} members={space.members} />
      </div>
    </main>
  )
}


