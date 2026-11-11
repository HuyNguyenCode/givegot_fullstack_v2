'use client'

import { useRef, useState } from 'react'

type Field = 'objective' | 'definitionOfDone'
type Props = { spaceId: string; archived: boolean; version: number; objective: string | null; definitionOfDone: string | null }
const fields: Array<{ key: Field; label: string; empty: string }> = [
  { key: 'objective', label: 'Mục tiêu chung', empty: 'Hai bạn chưa thêm mục tiêu chung.' },
  { key: 'definitionOfDone', label: 'Định nghĩa hoàn thành', empty: 'Hai bạn chưa xác định tiêu chí hoàn thành.' },
]

export function LearningSpaceDetails(props: Props) {
  const [values, setValues] = useState({ objective: props.objective, definitionOfDone: props.definitionOfDone })
  const [version, setVersion] = useState(props.version)
  const [editing, setEditing] = useState<Field | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)
  const [success, setSuccess] = useState(false)
  const pending = useRef(false)

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (!editing || pending.current || conflict) return
    const value = draft.trim() || null
    if (value && value.length > 10000) { setError('Nội dung không được dài quá 10.000 ký tự.'); return }
    pending.current = true; setBusy(true); setError(null); setSuccess(false)
    try {
      const response = await fetch(`/api/learning/spaces/${encodeURIComponent(props.spaceId)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expectedVersion: version, [editing]: value }) })
      if (response.status === 409) { setConflict(true); setError('Không gian đã thay đổi hoặc đã lưu trữ. Hãy tải lại trang để xem dữ liệu mới; bản nháp chưa lưu sẽ mất.'); return }
      const result = await response.json()
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Không thể lưu thay đổi.')
      if (!Number.isInteger(result.space?.version)) throw new Error('Phản hồi không hợp lệ. Hãy tải lại trang trước khi thử lại.')
      setVersion(result.space.version); setValues(previous => ({ ...previous, [editing]: value })); setEditing(null); setSuccess(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể kết nối. Hãy thử lại.') }
    finally { pending.current = false; setBusy(false) }
  }

  return <div className="mt-6 grid gap-4 lg:grid-cols-2">{fields.map(field => <section key={field.key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby={`${field.key}-heading`}>
    <h2 id={`${field.key}-heading`} className="text-base font-semibold text-slate-900">{field.label}</h2>
    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{values[field.key] || field.empty}</p>
    {!props.archived && editing !== field.key && <button type="button" disabled={busy || editing !== null || conflict} onClick={() => { setDraft(values[field.key] ?? ''); setEditing(field.key); setError(null); setSuccess(false) }} className="mt-3 min-h-11 rounded-lg border border-slate-300 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50">Chỉnh sửa {field.label.toLowerCase()}</button>}
    {editing === field.key && <form onSubmit={save} className="mt-3 space-y-3"><label className="block text-sm font-medium" htmlFor={`${field.key}-input`}>{field.label}</label><textarea id={`${field.key}-input`} value={draft} maxLength={10000} onChange={event => setDraft(event.target.value)} disabled={busy} className="min-h-28 w-full rounded-lg border border-slate-300 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600" /><p className="text-sm text-slate-600">Để trống để xóa nội dung.</p><div className="flex flex-wrap gap-2"><button disabled={busy || conflict} type="submit" className="min-h-11 rounded-lg bg-purple-700 px-4 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50">{busy ? 'Đang lưu…' : 'Lưu'}</button><button disabled={busy} type="button" onClick={() => { setEditing(null); setError(null) }} className="min-h-11 rounded-lg border border-slate-300 px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">Hủy</button></div></form>}
    {editing === field.key && error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {conflict && field.key === 'objective' && <button type="button" onClick={() => window.location.reload()} className="mt-3 min-h-11 rounded-lg border border-slate-300 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">Tải lại trang (bản nháp chưa lưu sẽ mất)</button>}
    {success && !editing && field.key === 'objective' && <p role="status" className="mt-3 text-sm text-emerald-700">Đã lưu thay đổi.</p>}
  </section>)}</div>
}
