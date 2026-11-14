'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Archive, ArrowRight, BookOpen, CalendarDays } from 'lucide-react'

import type { AuthorizedLearningSpaceShellData } from '@/lib/learning-space-shell'
import type { LearningResourceView } from '@/components/learning/LearningResources'
import { LearningSpaceSections } from '@/components/learning/LearningSpaceSections'
import { LearningSpaceDetails } from '@/components/learning/LearningSpaceDetails'

type Props = { space: AuthorizedLearningSpaceShellData; showFirstValue?: boolean; resources?: LearningResourceView[]; quota?: { usedBytes: string; maxBytes: string } }

export class SpaceLifecycleConflict extends Error {}
export class SpaceLifecycleRequestError extends Error {}
export async function requestSpaceLifecycle(spaceId: string, action: 'archive' | 'restore', version: number, request: typeof fetch = fetch): Promise<{ state: 'ACTIVE' | 'ARCHIVED'; version: number }> {
  const response = await request(`/api/learning/spaces/${encodeURIComponent(spaceId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, expectedVersion: version }) })
  if (response.status === 409) throw new SpaceLifecycleConflict()
  const data = await response.json()
  if (!response.ok) throw new SpaceLifecycleRequestError(typeof data.error === 'string' ? data.error : 'Không thể cập nhật không gian.')
  const state = action === 'archive' ? 'ARCHIVED' : 'ACTIVE'
  if (data.space?.state !== state || !Number.isInteger(data.space?.version)) throw new Error('Phản hồi không hợp lệ.')
  return { state, version: data.space.version }
}

const formatDate = (date: Date) => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
}).format(date)

export function LearningSpaceShell({ space, showFirstValue = false, resources = [], quota = { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) } }: Props) {
  const now = new Date()
  const [state, setState] = useState(space.state)
  const [version, setVersion] = useState(space.version)
  const [details, setDetails] = useState({ objective: space.objective, definitionOfDone: space.definitionOfDone })
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pending = useRef(false)
  const beginMutation = () => { if (pending.current) return false; pending.current = true; setBusy(true); return true }
  const endMutation = () => { pending.current = false; setBusy(false) }
  async function changeState(action: 'archive' | 'restore') {
    if (!beginMutation()) return
    setError(null); setMessage(null)
    try {
      const result = await requestSpaceLifecycle(space.id, action, version)
      setVersion(result.version); setState(result.state); setConfirming(false)
      setMessage(action === 'archive' ? 'Đã lưu trữ không gian.' : 'Đã khôi phục không gian.')
    } catch (cause) {
      if (cause instanceof SpaceLifecycleConflict) { setConflict(true); setError('Không gian đã thay đổi. Hãy tải lại để xem trạng thái mới; nội dung chưa lưu sẽ bị mất.') }
      else if (cause instanceof SpaceLifecycleRequestError) setError(`Không thể cập nhật không gian: ${cause.message}`)
      else setError('Không thể xác nhận thay đổi. Hãy kiểm tra kết nối và tải lại để xem trạng thái; nội dung chưa lưu sẽ bị mất.')
    }
    finally { endMutation() }
  }
  const nextBooking = space.bookings.find(booking => booking.endTime >= now && !['CANCELLED', 'MISSED'].includes(booking.status))
  const partner = space.members.find(member => member.id !== space.viewerId)
  const archived = state === 'ARCHIVED'

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

        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Trạng thái không gian">
          <p className="text-sm font-medium">{archived ? 'Đã lưu trữ · Chỉ xem' : 'Đang hoạt động'}</p>
          {!confirming && <button type="button" disabled={busy || conflict} onClick={() => archived ? void changeState('restore') : setConfirming(true)} className="mt-2 min-h-11 rounded-lg border border-slate-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50">{busy ? 'Đang xử lý…' : archived ? 'Khôi phục không gian' : 'Lưu trữ không gian'}</button>}
          {confirming && <div role="group" aria-labelledby="archive-confirm-title" className="mt-3"><h2 id="archive-confirm-title" className="font-semibold">Lưu trữ LearningSpace?</h2><p className="mt-2 text-sm">Bạn vẫn có thể xem lịch sử học tập và khôi phục không gian sau này; đây không phải xóa vĩnh viễn. Các thao tác chỉnh sửa tạm thời không khả dụng. Nội dung công việc chưa lưu (nếu có) sẽ bị mất khi lưu trữ thành công.</p><div className="mt-3 flex flex-wrap gap-2"><button type="button" autoFocus disabled={busy} onClick={() => setConfirming(false)} className="min-h-11 rounded-lg border px-4 focus-visible:ring-2 focus-visible:ring-purple-600">Hủy</button><button type="button" disabled={busy || conflict} onClick={() => void changeState('archive')} className="min-h-11 rounded-lg bg-purple-700 px-4 text-white focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50">{busy ? 'Đang lưu trữ…' : 'Tiếp tục lưu trữ'}</button></div></div>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          {error && <button type="button" onClick={() => { if (window.confirm('Tải lại trang sẽ làm mất nội dung chưa lưu. Tiếp tục?')) window.location.reload() }} className="mt-2 min-h-11 rounded-lg border px-3 focus-visible:ring-2 focus-visible:ring-purple-600">Tải lại trang</button>}
          {message && <p role="status" className="mt-3 text-sm text-emerald-700">{message}</p>}
        </section>

        <LearningSpaceDetails key={state} spaceId={space.id} archived={archived} version={version} objective={details.objective} definitionOfDone={details.definitionOfDone} mutationBusy={busy} beginMutation={beginMutation} endMutation={endMutation} onSaved={(field, value, nextVersion) => { setDetails(previous => ({ ...previous, [field]: value })); setVersion(nextVersion) }} />

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


