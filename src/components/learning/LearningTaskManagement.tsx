'use client'
import { useEffect, useRef, useState } from 'react'
import type { Task } from './LearningSubmissions'
import type { Topic } from './LearningTaskCreate'

type EditDraft = { title: string; description: string; acceptanceCriteria: string; dueAt: string; dueChanged: boolean; topicId?: string | null; originalTopicId?: string | null }
export function taskPermissions(task: Task, viewerId: string, archived: boolean) {
  const creator = !archived && task.creatorId === viewerId && Number.isSafeInteger(task.version) && (task.version ?? 0) > 0
  return { edit: creator && task.status === 'OPEN', cancel: creator && ['OPEN', 'IN_PROGRESS'].includes(task.status) }
}
function localDate(value: string | null) {
  if (!value) return ''
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
export function taskEditDraft(task: Task): EditDraft {
  return { title: task.title, description: task.description ?? '', acceptanceCriteria: task.acceptanceCriteria ?? '', dueAt: localDate(task.dueAt), dueChanged: false, topicId: task.topicId ?? null, originalTopicId: task.topicId ?? null }
}
export function editTaskPayload(draft: EditDraft, version: number, now = Date.now(), topics: Topic[] = []) {
  const title = draft.title.trim(), description = draft.description.trim(), acceptanceCriteria = draft.acceptanceCriteria.trim()
  if (!title || title.length > 255 || !acceptanceCriteria || acceptanceCriteria.length > 10000 || description.length > 10000) throw new Error('Kiểm tra tiêu đề và yêu cầu hoàn thành.')
  let dueAt: string | null | undefined
  if (draft.dueChanged) {
    if (!draft.dueAt) dueAt = null
    else { const date = new Date(draft.dueAt); if (!Number.isFinite(date.getTime()) || date.getTime() <= now) throw new Error('Hạn nộp phải ở trong tương lai.'); dueAt = date.toISOString() }
  }
  const topicChanged = (draft.topicId ?? null) !== (draft.originalTopicId ?? null)
  if (topicChanged && draft.topicId && !topics.some(topic => topic.id === draft.topicId && topic.state === 'ACTIVE')) throw new Error('Chủ đề không còn khả dụng. Hãy chọn chủ đề đang hoạt động hoặc bỏ gắn chủ đề.')
  return { expectedVersion: version, title, description: description || null, acceptanceCriteria, ...(draft.dueChanged ? { dueAt } : {}), ...(topicChanged ? { topicId: draft.topicId || null } : {}) }
}
export class TaskConflict extends Error {}
export function TaskTopicSelector({ value, topics, onChange }: { value: string | null; topics: Topic[]; onChange(value: string | null): void }) {
  return <label className="block text-sm">Chủ đề<select value={value ?? ''} onChange={event => onChange(event.target.value || null)} className="mt-1 block w-full rounded-lg border p-2"><option value="">Không gắn chủ đề</option>{value && !topics.some(topic => topic.id === value && topic.state === 'ACTIVE') && <option value={value} disabled>{topics.find(topic => topic.id === value)?.label || 'Chủ đề không khả dụng'} (không khả dụng)</option>}{topics.filter(topic => topic.state === 'ACTIVE').map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
}
export async function patchTask(spaceId: string, taskId: string, payload: object, request: typeof fetch = fetch): Promise<Task> {
  let response: Response
  try { response = await request(`/api/learning/spaces/${encodeURIComponent(spaceId)}/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }) }
  catch { throw new Error('Không thể kết nối. Hãy kiểm tra mạng và thử lại.') }
  if (response.status === 409) throw new TaskConflict('Công việc đã thay đổi hoặc không còn cho phép thao tác. Hãy tải thông tin hiện tại trước khi thử lại.')
  if (response.status === 401 || response.status === 403) throw new Error('Bạn không còn quyền thực hiện thao tác này. Hãy tải lại thông tin hoặc đăng nhập lại.')
  if (!response.ok) throw new Error(response.status === 400 ? 'Thông tin chưa hợp lệ. Hãy kiểm tra các trường và chọn chủ đề đang hoạt động hoặc bỏ gắn chủ đề.' : 'Không thể cập nhật công việc. Hãy thử lại.')
  return await response.json() as Task
}
export function TaskManagement({ task, viewerId, archived, spaceId, topics, onUpdated, onRefresh }: { task: Task; viewerId: string; archived: boolean; spaceId: string; topics: Topic[]; onUpdated(task: Task): void; onRefresh(taskId: string): Promise<Task> }) {
  const permissions = taskPermissions(task, viewerId, archived)
  const [draft, setDraft] = useState<EditDraft | null>(null)
  const [baseVersion, setBaseVersion] = useState(task.version ?? 0)
  const [confirm, setConfirm] = useState(false)
  const [confirmRefresh, setConfirmRefresh] = useState(false)
  const [busy, setBusy] = useState(false)
  const [conflict, setConflict] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const pending = useRef(false)
  const mounted = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  function openEdit() { setDraft(taskEditDraft(task)); setBaseVersion(task.version ?? 0); setConflict(false); setMessage(null) }
  async function mutate(kind: 'edit' | 'cancel') {
    if (pending.current || conflict || (kind === 'edit' ? !permissions.edit || !draft : !permissions.cancel || !confirm)) return
    pending.current = true; setBusy(true); setMessage(null)
    try {
      const payload = kind === 'edit' ? editTaskPayload(draft!, baseVersion, Date.now(), topics) : { expectedVersion: task.version, action: 'CANCEL' }
      const result = await patchTask(spaceId, task.id, payload)
      onUpdated(result); setDraft(null); setConfirm(false); setMessage(kind === 'edit' ? 'Đã cập nhật công việc.' : 'Đã hủy công việc.')
    } catch (error) { if (error instanceof TaskConflict) setConflict(true); setMessage(error instanceof Error ? error.message : 'Không thể cập nhật công việc.') }
    finally { pending.current = false; setBusy(false) }
  }
  async function refresh() {
    if (pending.current) return
    pending.current = true; setBusy(true)
    try {
      const latest = await onRefresh(task.id)
      if (!mounted.current || latest.id !== task.id) return
      if (!Number.isSafeInteger(latest.version) || (latest.version ?? 0) < 1) throw new Error('Invalid version')
      setDraft(previous => previous ? taskEditDraft(latest) : null)
      setBaseVersion(latest.version!)
      setConflict(false); setConfirm(false); setConfirmRefresh(false)
      setMessage('Biểu mẫu đã được cập nhật theo thông tin mới nhất. Hãy xem lại trước khi lưu.')
    } catch { if (mounted.current) setMessage('Không thể tải thông tin hiện tại. Hãy kiểm tra mạng và thử lại.') }
    finally { pending.current = false; if (mounted.current) setBusy(false) }
  }
  const change = (key: keyof EditDraft, value: string) => setDraft(previous => previous && { ...previous, [key]: value })
  return <div className="mt-4 space-y-3">
    <div className="flex flex-wrap gap-2">{permissions.edit && !draft && <button type="button" onClick={openEdit} className="min-h-10 rounded-lg border px-3 focus-visible:ring-2">Chỉnh sửa công việc</button>}{permissions.cancel && !confirm && <button type="button" onClick={() => { setConfirm(true); setMessage(null) }} className="min-h-10 rounded-lg border px-3 focus-visible:ring-2">Hủy công việc</button>}</div>
    {draft && <form onSubmit={event => { event.preventDefault(); void mutate('edit') }} className="space-y-3 rounded-xl border p-4" aria-label="Chỉnh sửa công việc">
      <label className="block text-sm">Tiêu đề<input required maxLength={255} value={draft.title} onChange={e => change('title', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block text-sm">Mô tả<textarea maxLength={10000} value={draft.description} onChange={e => change('description', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <label className="block text-sm">Yêu cầu hoàn thành<textarea required maxLength={10000} value={draft.acceptanceCriteria} onChange={e => change('acceptanceCriteria', e.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <TaskTopicSelector value={draft.topicId ?? null} topics={topics} onChange={topicId => setDraft(previous => previous && { ...previous, topicId })} />
      <label className="block text-sm">Hạn nộp<input type="datetime-local" step="1" value={draft.dueAt} onChange={e => setDraft(previous => previous && { ...previous, dueAt: e.target.value, dueChanged: true })} className="mt-1 block w-full rounded-lg border p-2" /></label>
      <button type="submit" disabled={busy || conflict || !permissions.edit} className="min-h-10 rounded-lg bg-purple-700 px-3 text-white disabled:opacity-50">Lưu thay đổi</button> <button type="button" disabled={busy} onClick={() => setDraft(null)} className="min-h-10 rounded-lg border px-3">Đóng</button>
    </form>}
    {confirm && permissions.cancel && <div role="group" aria-label="Xác nhận hủy công việc" className="rounded-xl border border-amber-300 p-4"><p>Bạn có chắc muốn hủy công việc? Không thể khôi phục.</p><button type="button" disabled={busy || conflict} onClick={() => void mutate('cancel')} className="mt-2 min-h-10 rounded-lg bg-red-700 px-3 text-white disabled:opacity-50">Xác nhận hủy công việc</button> <button type="button" disabled={busy} onClick={() => setConfirm(false)} className="min-h-10 rounded-lg border px-3">Quay lại</button></div>}
    {message && <p role={conflict ? 'alert' : 'status'} className="text-sm break-words">{message}</p>}{conflict && !confirmRefresh && <button type="button" disabled={busy} onClick={() => setConfirmRefresh(true)} className="min-h-10 rounded-lg border px-3 focus-visible:ring-2">Tải thông tin hiện tại</button>}
    {conflict && confirmRefresh && <div role="group" aria-label="Xác nhận tải thông tin mới nhất" className="rounded-xl border border-amber-300 p-4"><p>Tải thông tin mới nhất sẽ thay thế các thay đổi bạn chưa lưu. Bạn có muốn tiếp tục?</p><button type="button" disabled={busy} onClick={() => void refresh()} className="mt-2 min-h-10 rounded-lg bg-purple-700 px-3 text-white disabled:opacity-50 focus-visible:ring-2">Tải thông tin mới nhất</button> <button type="button" disabled={busy} onClick={() => setConfirmRefresh(false)} className="min-h-10 rounded-lg border px-3 focus-visible:ring-2">Quay lại</button></div>}
  </div>
}
