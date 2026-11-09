'use client'

import { useRef, useState } from 'react'
import type { Topic } from '@/components/learning/LearningTaskCreate'

type ManagedTopic = Topic
type Props = { spaceId: string; archived: boolean; topics: ManagedTopic[]; onTopicsChange(topics: ManagedTopic[]): void }

export function upsertTopic(topics: Topic[], changed: Topic): Topic[] {
  return topics.some(topic => topic.id === changed.id)
    ? topics.map(topic => topic.id === changed.id ? changed : topic)
    : [...topics, changed]
}

export async function requestTopicMutation(spaceId: string, topicId: string | null, body: Record<string, unknown>, request: typeof fetch = fetch): Promise<Topic> {
  const url = `/api/learning/spaces/${encodeURIComponent(spaceId)}/topics${topicId ? `/${encodeURIComponent(topicId)}` : ''}`
  let response: Response
  try {
    response = await request(url, { method: topicId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  } catch {
    throw new Error('Không thể kết nối. Hãy kiểm tra mạng và thử lại.')
  }
  let result: { topic?: Topic; error?: string }
  try { result = await response.json() as { topic?: Topic; error?: string } }
  catch { throw new Error('Phản hồi không hợp lệ. Hãy thử lại.') }
  if (!response.ok) throw new Error(result.error || 'Không thể cập nhật chủ đề.')
  if (!result.topic || typeof result.topic.id !== 'string' || typeof result.topic.label !== 'string' || !['ACTIVE', 'ARCHIVED'].includes(result.topic.state)) throw new Error('Phản hồi không hợp lệ. Hãy thử lại.')
  return result.topic
}

export function LearningTopicManagement({ spaceId, archived, topics, onTopicsChange }: Props) {
  const [newLabel, setNewLabel] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const pending = useRef(false)

  async function mutate(run: () => Promise<Topic>, successMessage: string, onSuccess?: () => void) {
    if (pending.current) return
    pending.current = true
    setBusy(true); setError(null); setSuccess(null)
    try {
      const changed = await run()
      onTopicsChange(upsertTopic(topics, changed))
      setSuccess(successMessage)
      onSuccess?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật chủ đề.')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }

  function create(event: React.FormEvent) {
    event.preventDefault()
    const label = newLabel.trim()
    if (!label) { setError('Vui lòng nhập tên chủ đề.'); return }
    if (label.length > 200) { setError('Tên chủ đề không được dài quá 200 ký tự.'); return }
    void mutate(() => requestTopicMutation(spaceId, null, { label }), 'Đã tạo chủ đề.', () => setNewLabel(''))
  }

  function rename(event: React.FormEvent, topicId: string) {
    event.preventDefault()
    const label = editLabel.trim()
    if (!label) { setError('Vui lòng nhập tên chủ đề.'); return }
    if (label.length > 200) { setError('Tên chủ đề không được dài quá 200 ký tự.'); return }
    void mutate(() => requestTopicMutation(spaceId, topicId, { label }), 'Đã đổi tên chủ đề.', () => { setEditingId(null); setEditLabel('') })
  }

  return <section className="mt-4 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="topics-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="topics-heading" className="text-base font-semibold text-slate-900">Chủ đề phụ</h2>{!archived && <span className="text-sm text-slate-600">Quản lý chủ đề trong không gian này</span>}</div>
    {topics.length ? <ul className="mt-3 space-y-2">{topics.map(topic => <li key={topic.id} className="flex min-w-0 flex-col gap-2 rounded-xl border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
      {editingId === topic.id ? <form onSubmit={event => rename(event, topic.id)} className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor={`topic-label-${topic.id}`}>Tên chủ đề</label><input id={`topic-label-${topic.id}`} autoFocus maxLength={200} value={editLabel} onChange={event => setEditLabel(event.target.value)} disabled={busy} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600" /><button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-purple-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-60">{busy ? 'Đang lưu…' : 'Lưu tên'}</button><button type="button" disabled={busy} onClick={() => { setEditingId(null); setError(null) }} className="min-h-11 rounded-lg border border-slate-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-60">Hủy</button></form> : <><span className={`min-w-0 break-words text-sm font-medium ${topic.state === 'ARCHIVED' ? 'text-slate-600' : 'text-purple-900'}`}>{topic.label}{topic.state === 'ARCHIVED' ? ' (đã lưu trữ)' : ''}</span>{!archived && topic.state === 'ACTIVE' && <div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => { setEditingId(topic.id); setEditLabel(topic.label); setError(null); setSuccess(null) }} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-60">Đổi tên</button><button type="button" disabled={busy} onClick={() => void mutate(() => requestTopicMutation(spaceId, topic.id, { action: 'archive' }), 'Đã lưu trữ chủ đề.')} className="min-h-10 rounded-lg border border-amber-400 px-3 text-sm font-medium text-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 disabled:opacity-60">Lưu trữ</button></div>}</>}
    </li>)}</ul> : <p className="mt-3 text-sm leading-6 text-slate-600">Chưa có chủ đề phụ.</p>}
    {!archived && <form onSubmit={create} className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row"><label className="sr-only" htmlFor="new-learning-topic">Tên chủ đề mới</label><input id="new-learning-topic" maxLength={200} value={newLabel} onChange={event => setNewLabel(event.target.value)} disabled={busy} placeholder="Tên chủ đề mới" className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600" /><button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-purple-700 px-4 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-60">{busy ? 'Đang lưu…' : 'Thêm chủ đề'}</button></form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}{success && <p role="status" className="mt-3 text-sm text-emerald-700">{success}</p>}
  </section>
}
