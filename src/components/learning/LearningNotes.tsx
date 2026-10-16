'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

export type LearningNoteView = { id: string; authorId: string; author?: { name: string | null }; bookingId: string | null; content: string; type: 'GENERAL' | 'RECAP'; visibility: 'SPACE_MEMBERS' | 'BOOKING_PARTICIPANTS' | 'AUTHOR_ONLY'; version: number; updatedAt: string }
type Booking = { id: string; endTime: Date; status: string }

const loadError = 'Không thể tải ghi chú. Kiểm tra kết nối rồi thử lại.'

export async function requestNotes(endpoint: string, request: typeof fetch = fetch): Promise<LearningNoteView[]> {
  try {
    const response = await request(endpoint, { cache: 'no-store' })
    if (!response.ok) throw new Error('notes request failed')
    const payload = await response.json() as { notes?: unknown }
    if (!Array.isArray(payload.notes)) throw new Error('invalid notes response')
    return payload.notes as LearningNoteView[]
  } catch {
    throw new Error(loadError)
  }
}

export function reconcileReloadedNotes(notes: LearningNoteView[], editing: LearningNoteView | null) {
  const latestEditing = editing ? notes.find(note => note.id === editing.id) ?? null : null
  const missingEditing = Boolean(editing && !latestEditing)
  return { notes, editing: latestEditing, refreshedEditing: Boolean(editing && latestEditing), missingEditing }
}

export function canSubmitNoteDraft(content: string, busy: boolean, editingUnavailable: boolean) {
  return Boolean(content.trim()) && !busy && !editingUnavailable
}

export type LearningNoteDraft = Pick<LearningNoteView, 'content' | 'type' | 'visibility'> & { bookingId: string | null }

export async function submitNoteDraft(endpoint: string, editing: LearningNoteView | null, draft: LearningNoteDraft, request: typeof fetch = fetch) {
  const response = await request(editing ? endpoint + '/' + encodeURIComponent(editing.id) : endpoint, { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...(editing ? { expectedVersion: editing.version } : {}), ...draft }) })
  if (response.ok) return
  let error = ''
  try { const value = (await response.json() as { error?: unknown }).error; error = typeof value === 'string' ? value : '' } catch { /* The fallback below is safe for malformed error bodies. */ }
  throw new Error(response.status === 404 ? 'Ghi chú không còn khả dụng. Tải lại để kiểm tra trạng thái mới nhất.' : response.status === 409 ? 'Ghi chú đã thay đổi. Tải lại trước khi sửa tiếp.' : error || 'Không thể lưu ghi chú')
}

function actionError(reason: unknown, fallback: string) {
  const message = reason instanceof Error ? reason.message : ''
  return message && message !== 'Failed to fetch' ? message : `${fallback}. Kiểm tra kết nối rồi thử lại.`
}

export function LearningNotes({ spaceId, viewerId, archived, bookings, initialNotes = [] }: { spaceId: string; viewerId: string; archived: boolean; bookings: Booking[]; initialNotes?: LearningNoteView[] }) {
  const [notes, setNotes] = useState<LearningNoteView[]>(initialNotes)
  const [editing, setEditing] = useState<LearningNoteView | null>(null)
  const editingRef = useRef<LearningNoteView | null>(null)
  const [content, setContent] = useState('')
  const [kind, setKind] = useState<LearningNoteView['type']>('GENERAL')
  const [visibility, setVisibility] = useState<LearningNoteView['visibility']>('SPACE_MEMBERS')
  const [bookingId, setBookingId] = useState('')
  const [error, setError] = useState('')
  const [reloadNotice, setReloadNotice] = useState('')
  const [editingUnavailable, setEditingUnavailable] = useState(false)
  const [loadingNotes, setLoadingNotes] = useState(false)
  const [busy, setBusy] = useState(false)
  const endpoint = '/api/learning/spaces/' + encodeURIComponent(spaceId) + '/notes'
  const load = useCallback(async () => {
    setLoadingNotes(true)
    try {
      const reloadedNotes = await requestNotes(endpoint)
      const reloaded = reconcileReloadedNotes(reloadedNotes, editingRef.current)
      setNotes(reloaded.notes)
      if (reloaded.missingEditing) {
        editingRef.current = null
        setEditing(null)
        setEditingUnavailable(true)
        setReloadNotice('Ghi chú này đã được xóa ở nơi khác. Bản nháp vẫn được giữ để bạn sao chép, nhưng không thể lưu thay đổi.')
      } else if (reloaded.refreshedEditing) {
        editingRef.current = reloaded.editing
        setEditing(reloaded.editing)
        setReloadNotice('Đã tải bản mới nhất. Bản nháp đang sửa được giữ nguyên.')
      } else setReloadNotice('')
      setError('')
      return true
    } catch (reason) {
      setError(actionError(reason, 'Không thể tải ghi chú'))
      return false
    } finally { setLoadingNotes(false) }
  }, [endpoint])
  useEffect(() => { void load() }, [load])
  const eligible = bookings.filter(booking => new Date(booking.endTime).getTime() <= Date.now() && !['CANCELLED', 'MISSED', 'DISPUTED'].includes(booking.status))
  function start(note?: LearningNoteView, recapBookingId?: string) { const nextEditing = note ?? null; setEditingUnavailable(false); editingRef.current = nextEditing; setEditing(nextEditing); setContent(note?.content ?? ''); setKind(note?.type ?? (recapBookingId ? 'RECAP' : 'GENERAL')); setVisibility(note?.visibility ?? 'SPACE_MEMBERS'); setBookingId(note?.bookingId ?? recapBookingId ?? ''); setError(''); setReloadNotice('') }
  async function save() {
    if (editingUnavailable) return
    const currentEditing = editingRef.current
    setBusy(true); setError('')
    try {
      await submitNoteDraft(endpoint, currentEditing, { content, type: kind, visibility, bookingId: bookingId || null })
      start(); await load()
    } catch (reason) { setError(actionError(reason, 'Không thể lưu ghi chú')) } finally { setBusy(false) }
  }
  async function remove(note: LearningNoteView) {
    if (!window.confirm('Xóa ghi chú này? Ghi chú sẽ không còn hiển thị trong LearningSpace.')) return
    setBusy(true); setError('')
    try { const response = await fetch(endpoint + '/' + encodeURIComponent(note.id), { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: note.version }) }); if (!response.ok) throw new Error(response.status === 409 ? 'Ghi chú đã thay đổi. Tải lại trước khi xóa.' : 'Không thể lưu trữ ghi chú'); await load() }
    catch (reason) { setError(actionError(reason, 'Không thể lưu trữ ghi chú')) } finally { setBusy(false) }
  }
  return <section aria-labelledby="notes-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <h2 id="notes-heading" className="font-semibold text-slate-900">Ghi chú riêng tư</h2>
    <p className="mt-1 text-sm text-slate-600">Ghi chú do bạn viết; nội dung không được gửi cho AI.</p>
    {!archived && eligible.length > 0 && <div className="mt-4 rounded-xl bg-purple-50 p-3 text-sm text-purple-900">Sau buổi học, bạn có thể viết tóm tắt ngắn. <button type="button" onClick={() => start(undefined, eligible[eligible.length - 1].id)} className="min-h-11 font-semibold cursor-pointer focus-visible:outline-2 focus-visible:outline-purple-700">Viết tóm tắt</button></div>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" disabled={loadingNotes} onClick={() => void load()} className="cursor-pointer disabled:opacity-50">{loadingNotes ? 'Đang tải…' : 'Tải lại'}</button></p>}
    {reloadNotice && <p role="status" className="mt-3 text-sm text-slate-700">{reloadNotice}</p>}
    {!archived && <div className="mt-4 space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
      <label className="block text-sm font-medium">Loại ghi chú<select value={kind} onChange={event => setKind(event.target.value as LearningNoteView['type'])} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option value="GENERAL">Ghi chú</option><option value="RECAP">Tóm tắt buổi học</option></select></label>
      <label className="block text-sm font-medium">Buổi học (tùy chọn)<select value={bookingId} onChange={event => setBookingId(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option value="">Toàn LearningSpace</option>{bookings.map(booking => <option key={booking.id} value={booking.id}>{new Date(booking.endTime).toLocaleDateString('vi-VN')}</option>)}</select></label>
      <label className="block text-sm font-medium">Ai có thể xem<select value={visibility} onChange={event => setVisibility(event.target.value as LearningNoteView['visibility'])} className="mt-1 min-h-11 w-full rounded-lg border p-2"><option value="SPACE_MEMBERS">Thành viên không gian</option><option value="BOOKING_PARTICIPANTS" disabled={!bookingId}>Người tham gia buổi học</option><option value="AUTHOR_ONLY">Chỉ mình tôi</option></select></label>
      <label className="block text-sm font-medium">Nội dung<textarea value={content} onChange={event => setContent(event.target.value)} maxLength={50000} rows={5} className="mt-1 w-full min-w-0 rounded-lg border p-3 text-base" placeholder="Viết ghi chú của bạn..." /></label>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={!canSubmitNoteDraft(content, busy, editingUnavailable)} onClick={() => void save()} className="min-h-11 rounded-lg bg-purple-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{editing ? 'Lưu thay đổi' : editingUnavailable ? 'Ghi chú đã lưu trữ' : 'Thêm ghi chú'}</button>{(editing || editingUnavailable) && <button type="button" onClick={() => start()} className="min-h-11 rounded-lg border px-4 text-sm">{editingUnavailable ? 'Bỏ bản nháp' : 'Hủy sửa'}</button>}</div>
    </div>}
    <ul className="mt-4 space-y-3">{notes.map(note => <li key={note.id} className="min-w-0 rounded-xl border border-slate-200 p-3"><p className="text-xs text-slate-600">{note.type === 'RECAP' ? 'Tóm tắt' : 'Ghi chú'} · {note.author?.name || 'Thành viên'} · {note.visibility === 'AUTHOR_ONLY' ? 'Chỉ mình tôi' : note.visibility === 'BOOKING_PARTICIPANTS' ? 'Người tham gia buổi học' : 'Thành viên không gian'} · {new Date(note.updatedAt).toLocaleString('vi-VN')}</p><p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-900">{note.content}</p>{!archived && note.authorId === viewerId && <div className="mt-2 flex gap-3 text-sm"><button type="button" onClick={() => start(note)} className="min-h-11 text-purple-700 cursor-pointer">Sửa</button><button type="button" disabled={busy} onClick={() => void remove(note)} className="min-h-11 text-red-700 cursor-pointer">Xóa ghi chú</button></div>}</li>)}</ul>
    {!notes.length && <p className="mt-4 text-sm text-slate-600">Chưa có ghi chú nào bạn có thể xem.</p>}
  </section>
}
