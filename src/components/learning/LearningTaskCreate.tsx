'use client'
import { useRef, useState } from 'react'
import type { Task } from './LearningSubmissions'

export type Member = { id: string; name: string | null; email: string | null }
export type Booking = { id: string; startTime: Date; endTime: Date; status: string; mentorId: string; menteeId: string }
export type Topic = { id: string; label: string; state: 'ACTIVE' | 'ARCHIVED' }
export type CreateDraft = { title: string; acceptanceCriteria: string; description: string; topicId: string; bookingId: string; dueAt: string }
export function counterpart(members: Member[], viewerId: string) {
  return members.length === 2 && members.filter(member => member.id === viewerId).length === 1 ? members.find(member => member.id !== viewerId) ?? null : null
}
export function createTaskPayload(draft: CreateDraft, assigneeId: string, now = Date.now()) {
  if (!assigneeId || !draft.title.trim() || draft.title.trim().length > 255 || !draft.acceptanceCriteria.trim() || draft.acceptanceCriteria.trim().length > 10000 || draft.description.trim().length > 10000) throw new Error('Kiểm tra tiêu đề và yêu cầu hoàn thành.')
  let dueAt: string | undefined
  if (draft.dueAt) {
    const date = new Date(draft.dueAt)
    if (!Number.isFinite(date.getTime()) || date.getTime() <= now) throw new Error('Hạn nộp phải ở trong tương lai.')
    dueAt = date.toISOString()
  }
  return { assigneeId, title: draft.title.trim(), acceptanceCriteria: draft.acceptanceCriteria.trim(), ...(draft.description.trim() ? { description: draft.description.trim() } : {}), ...(draft.topicId ? { topicId: draft.topicId } : {}), ...(draft.bookingId ? { bookingId: draft.bookingId } : {}), ...(dueAt ? { dueAt } : {}) }
}
export const bookingLabel = (booking: Booking) => `Buổi học ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(booking.startTime))} · ${booking.status}`
export const memberLabel = (members: Member[], id: string) => { const member = members.find(item => item.id === id); return member?.name || member?.email || 'Thành viên' }
export function BookingContext({ booking, members, creatorId, assigneeId }: { booking: Booking | undefined; members: Member[]; creatorId: string; assigneeId: string }) {
  if (!booking) return <p className="mt-2 text-sm text-slate-600">Không có thông tin buổi học liên kết.</p>
  const reversed = creatorId === booking.menteeId && assigneeId === booking.mentorId
  return <div className="mt-2 text-sm text-slate-700"><p>{bookingLabel(booking)}</p><p>Mentor: {memberLabel(members, booking.mentorId)} · Mentee: {memberLabel(members, booking.menteeId)}</p>{reversed && <p className="mt-2 text-amber-800">Hướng giao việc đảo với vai trò của buổi học; công việc này có thể không được tính làm minh chứng hoàn thành buổi học.</p>}{['CANCELLED', 'DISPUTED', 'MISSED'].includes(booking.status) && <p className="mt-2 text-amber-800">Trạng thái buổi học này có thể chặn đánh giá bài nộp.</p>}</div>
}
export function CreateTask({ spaceId, viewerId, members, topics, bookings, onCreated }: { spaceId: string; viewerId: string; members: Member[]; topics: Topic[]; bookings: Booking[]; onCreated(task: Task): void }) {
  const peer = counterpart(members, viewerId)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<CreateDraft>({ title: '', acceptanceCriteria: '', description: '', topicId: '', bookingId: '', dueAt: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = useRef(false)
  const change = (key: keyof CreateDraft, value: string) => setDraft(previous => ({ ...previous, [key]: value }))
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (pending.current || !peer) return
    pending.current = true; setBusy(true); setError(null)
    try {
      if (draft.topicId && !topics.some(topic => topic.id === draft.topicId && topic.state === 'ACTIVE')) throw new Error('Chủ đề không còn khả dụng.')
      if (draft.bookingId && !bookings.some(booking => booking.id === draft.bookingId && [booking.mentorId, booking.menteeId].includes(viewerId) && [booking.mentorId, booking.menteeId].includes(peer.id))) throw new Error('Buổi học không còn khả dụng.')
      const payload = createTaskPayload(draft, peer.id)
      const response = await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Không thể tạo công việc.')
      onCreated(result as Task)
      setDraft({ title: '', acceptanceCriteria: '', description: '', topicId: '', bookingId: '', dueAt: '' }); setOpen(false)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể tạo công việc.') }
    finally { pending.current = false; setBusy(false) }
  }
  const choice = bookings.find(booking => booking.id === draft.bookingId)
  return <div className="mt-3"><button type="button" disabled={!peer} onClick={() => setOpen(value => !value)} aria-expanded={open} className="min-h-11 rounded-xl bg-purple-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:opacity-50">Tạo công việc</button>{!peer && <p className="mt-2 text-sm">Cần hai thành viên đang hoạt động để giao công việc.</p>}
    {open && peer && <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4" aria-label="Tạo công việc"><p className="text-sm">Giao cho: {memberLabel(members, peer.id)}</p>
      <label className="block text-sm font-medium">Tiêu đề<input required maxLength={255} value={draft.title} onChange={e => change('title', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block text-sm font-medium">Yêu cầu hoàn thành<textarea required maxLength={10000} value={draft.acceptanceCriteria} onChange={e => change('acceptanceCriteria', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block text-sm font-medium">Mô tả (không bắt buộc)<textarea maxLength={10000} value={draft.description} onChange={e => change('description', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block text-sm font-medium">Chủ đề<select value={draft.topicId} onChange={e => change('topicId', e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Không chọn</option>{topics.filter(topic => topic.state === 'ACTIVE').map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
      <label className="block text-sm font-medium">Buổi học<select value={draft.bookingId} onChange={e => change('bookingId', e.target.value)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Không gắn buổi học</option>{bookings.filter(booking => [booking.mentorId, booking.menteeId].includes(viewerId) && [booking.mentorId, booking.menteeId].includes(peer.id)).map(booking => <option key={booking.id} value={booking.id}>{bookingLabel(booking)}</option>)}</select></label>
      {choice && <BookingContext booking={choice} members={members} creatorId={viewerId} assigneeId={peer.id} />}
      <label className="block text-sm font-medium">Hạn nộp (không bắt buộc)<input type="datetime-local" value={draft.dueAt} onChange={e => change('dueAt', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-purple-700 px-4 text-white focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50">{busy ? 'Đang tạo…' : 'Lưu công việc'}</button>
    </form>}</div>
}
