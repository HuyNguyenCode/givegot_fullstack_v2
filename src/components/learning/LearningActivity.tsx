'use client'
import { useCallback, useEffect, useState } from 'react'

type Event = { id: string; eventType: string; occurredAt: string; actorName: string }
type Page = { events: Event[]; nextCursor: string | null }
export const activityLabels: Record<string, string> = {
  LEARNING_SPACE_CREATED: 'Đã tạo không gian học', LEARNING_SPACE_DETAILS_UPDATED: 'Đã cập nhật thông tin không gian học tập', LEARNING_SPACE_PRIMARY_SKILL_CHANGED: 'Đã đổi kỹ năng chính',
  LEARNING_TOPIC_CHANGED: 'Đã thay đổi chủ đề', LEARNING_RESOURCE_CREATED: 'Đã thêm tài liệu', LEARNING_RESOURCE_DELETED: 'Đã xóa tài liệu',
  LEARNING_TASK_ASSIGNED: 'Đã giao công việc', LEARNING_SUBMISSION_CREATED: 'Đã nhận bài nộp',
  LEARNING_SUBMISSION_REVISED: 'Đã nhận bài nộp mới', LEARNING_REVISION_REQUESTED: 'Đã yêu cầu chỉnh sửa',
  LEARNING_SUBMISSION_REVIEWED: 'Đã có phản hồi', LEARNING_NOTE_ADDED: 'Đã thêm ghi chú',
  LEARNING_RECAP_ADDED: 'Đã thêm tóm tắt', LEARNING_NOTE_UPDATED: 'Đã cập nhật ghi chú', LEARNING_NOTE_DELETED: 'Đã xóa ghi chú', LEARNING_BOOKING_LINKED: 'Đã liên kết lịch hẹn',
  LEARNING_FULFILLMENT_CHANGED: 'Đã cập nhật tiến độ hoàn thành',
}
export function LearningActivity({ spaceId }: { spaceId: string }) {
  const [events, setEvents] = useState<Event[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const load = useCallback(async (next: string | null, signal?: AbortSignal) => {
    setLoading(true); setError(false)
    try {
      const query = next ? '?cursor=' + encodeURIComponent(next) : ''
      const response = await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/activity' + query, { signal })
      if (!response.ok) throw new Error('Activity unavailable')
      const page = await response.json() as Page
      setEvents(current => next ? [...current, ...page.events.filter(row => !current.some(old => old.id === row.id))] : page.events)
      setCursor(page.nextCursor)
    } catch (cause) { if (!(cause instanceof DOMException && cause.name === 'AbortError')) setError(true) }
    finally { if (!signal?.aborted) setLoading(false) }
  }, [spaceId])
  useEffect(() => { const controller = new AbortController(); void load(null, controller.signal); return () => controller.abort() }, [load])
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="activity-heading">
    <h2 id="activity-heading" className="text-base font-semibold text-slate-900">Hoạt động học tập</h2>
    <p className="mt-1 text-sm text-slate-600">Các mốc học tập của hai bạn theo thời gian.</p>
    {loading && events.length === 0 && <p role="status" className="mt-5 text-sm text-slate-600">Đang tải hoạt động…</p>}
    {error && <div className="mt-5"><p role="alert" className="text-sm text-red-700">Chưa tải được hoạt động.</p><button type="button" onClick={() => void load(cursor)} className="mt-2 min-h-11 rounded-lg border px-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-purple-600">Thử lại</button></div>}
    {!loading && !error && events.length === 0 && <p className="mt-5 text-sm text-slate-600">Chưa có hoạt động học tập nào.</p>}
    <ol className="mt-4 space-y-3">{events.map(event => <li key={event.id} className="min-w-0 rounded-xl border border-slate-100 bg-slate-50 p-3"><span className="block min-w-0 break-words text-sm font-medium text-slate-800">{activityLabels[event.eventType] ?? 'Đã cập nhật hoạt động học tập'}</span><span className="mt-1 block break-words text-xs text-slate-500">{event.actorName} <span aria-hidden="true">·</span> <time dateTime={event.occurredAt}>{new Date(event.occurredAt).toLocaleString('vi-VN')}</time></span></li>)}</ol>
    {cursor && <button type="button" disabled={loading} onClick={() => void load(cursor)} className="mt-4 min-h-11 rounded-lg border border-purple-600 px-4 text-sm font-semibold text-purple-700 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-purple-600">{loading ? 'Đang tải…' : 'Xem thêm'}</button>}
  </section>
}
