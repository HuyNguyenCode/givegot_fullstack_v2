'use client'
import { useEffect, useRef, useState } from 'react'

type Task = { id: string; title: string; description: string | null; acceptanceCriteria: string | null; assigneeId: string; status: string }
type Submission = { id: string; content: string | null; linkUrl: string | null; attachmentResourceId: string | null; revisionCount: number; status: string }
type Resource = { id: string; title: string; kind: string; status: string }
type Row = { task: Task; submission: Submission | null }
async function read(response: Response) {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu')
  return data
}
export async function downloadSubmissionAttachment(spaceId: string, resourceId: string, request: typeof fetch = fetch, navigate: (url: string) => void = url => window.location.assign(url)) {
  const result = await read(await request('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/files/' + encodeURIComponent(resourceId) + '/download', { method: 'POST' })) as { url?: unknown }
  if (typeof result.url !== 'string' || !result.url) throw new Error('Không thể tạo liên kết tải xuống')
  navigate(result.url)
}
function Form({ spaceId, row, files, saved }: { spaceId: string; row: Row; files: Resource[]; saved(value: Submission): void }) {
  const [content, setContent] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [attachmentResourceId, setAttachmentResourceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false)
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current) return
    if (!content.trim() && !linkUrl.trim() && !attachmentResourceId) { setError('Thêm nội dung, liên kết HTTPS hoặc tệp đính kèm.'); return }
    if (linkUrl.trim()) {
      try { const url = new URL(linkUrl.trim()); if (url.protocol !== 'https:' || url.username || url.password) throw new Error() }
      catch { setError('Liên kết phải là HTTPS hợp lệ.'); return }
    }
    inFlight.current = true; setBusy(true); setError(null)
    try {
      const data = await read(await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks/' + encodeURIComponent(row.task.id) + '/submission', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, linkUrl, attachmentResourceId }) }))
      saved(data.submission)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi bài') }
    finally { inFlight.current = false; setBusy(false) }
  }
  return <form onSubmit={event => void submit(event)} className="mt-4 space-y-3 rounded-xl bg-slate-50 p-4">
    <p className="text-sm text-slate-600">Sau khi gửi, bài chỉ sửa được khi có yêu cầu chỉnh sửa.</p>
    <label className="block text-sm font-medium">Nội dung<textarea value={content} onChange={event => { setContent(event.target.value); setError(null) }} maxLength={20000} rows={5} className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
    <label className="block text-sm font-medium">Liên kết HTTPS<input value={linkUrl} onChange={event => { setLinkUrl(event.target.value); setError(null) }} type="url" inputMode="url" placeholder="https://…" className="mt-1 w-full rounded-lg border border-slate-300 p-3" /></label>
    <label className="block text-sm font-medium">Tệp từ tài nguyên<select value={attachmentResourceId} onChange={event => { setAttachmentResourceId(event.target.value); setError(null) }} className="mt-1 w-full rounded-lg border border-slate-300 p-3"><option value="">Không đính kèm</option>{files.map(file => <option key={file.id} value={file.id}>{file.title}</option>)}</select></label>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={busy} className="min-h-11 w-full rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">{busy ? 'Đang gửi…' : row.submission ? 'Gửi bản sửa' : 'Gửi bài'}</button>
  </form>
}
export function LearningSubmissions({ spaceId, viewerId, archived, resources }: { spaceId: string; viewerId: string; archived: boolean; resources: Resource[] }) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)
  const [attachmentDownloadError, setAttachmentDownloadError] = useState<string | null>(null)
  const attachmentDownloadInFlight = useRef(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const tasks: Task[] = (await read(await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks', { cache: 'no-store' }))).tasks
        const loaded = await Promise.all(tasks.map(async task => ({ task, submission: (await read(await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks/' + encodeURIComponent(task.id) + '/submission', { cache: 'no-store' }))).submission as Submission | null })))
        if (active) setRows(loaded)
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải công việc') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [spaceId, reload])
  const files = resources.filter(resource => resource.kind === 'FILE' && resource.status === 'READY')
  async function downloadAttachment(resource: Resource) {
    if (attachmentDownloadInFlight.current) return
    attachmentDownloadInFlight.current = true
    setDownloadingAttachmentId(resource.id)
    setAttachmentDownloadError(null)
    try {
      await downloadSubmissionAttachment(spaceId, resource.id)
    } catch (cause) {
      setAttachmentDownloadError(cause instanceof Error ? cause.message : 'Không thể tạo liên kết tải xuống')
    } finally {
      attachmentDownloadInFlight.current = false
      setDownloadingAttachmentId(null)
    }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="tasks-heading"><h2 id="tasks-heading" className="text-base font-semibold text-slate-900">Công việc và bài nộp</h2>
    {loading && <p role="status" className="mt-3 text-sm text-slate-600">Đang tải công việc…</p>}
    {error && <div className="mt-3"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => { setError(null); setLoading(true); setReload(value => value + 1) }} className="mt-2 min-h-10 rounded-lg border border-slate-300 px-3 text-sm">Thử lại</button></div>}
    {!loading && !error && rows.length === 0 && <p className="mt-3 text-sm text-slate-600">Chưa có công việc nào được giao.</p>}
    {!loading && !error && <ul className="mt-4 space-y-4">{rows.map(row => {
      const editable = !archived && row.task.assigneeId === viewerId && ((!row.submission && ['OPEN', 'IN_PROGRESS'].includes(row.task.status)) || (row.submission?.status === 'REVISION_REQUESTED' && row.task.status === 'REVISION_REQUESTED'))
      const attachment = row.submission?.attachmentResourceId ? files.find(file => file.id === row.submission?.attachmentResourceId) : null
      return <li key={row.task.id} className="rounded-xl border border-slate-200 p-4"><h3 className="break-words font-semibold">{row.task.title}</h3><p className="mt-1 text-xs text-slate-500">Trạng thái: {row.task.status}</p>{row.task.description && <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.task.description}</p>}{row.task.acceptanceCriteria && <p className="mt-2 whitespace-pre-wrap break-words text-sm">Tiêu chí: {row.task.acceptanceCriteria}</p>}{row.submission && <div className="mt-3 rounded-lg bg-purple-50 p-3 text-sm"><p className="font-medium">Bài nộp hiện tại · bản {row.submission.revisionCount}</p>{row.submission.content && <p className="mt-2 whitespace-pre-wrap break-words">{row.submission.content}</p>}{row.submission.linkUrl && <a href={row.submission.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-purple-700">Mở liên kết bài nộp</a>}{attachment && <button type="button" disabled={downloadingAttachmentId === attachment.id} onClick={() => void downloadAttachment(attachment)} aria-label={`Tải tệp đính kèm ${attachment.title}`} className="mt-2 block break-all text-left text-purple-700 disabled:opacity-60 cursor-pointer">{downloadingAttachmentId === attachment.id ? 'Đang chuẩn bị tải xuống…' : `Tệp đính kèm: ${attachment.title}`}</button>}{row.submission.attachmentResourceId && !attachment && <p role="alert" className="mt-2 text-red-700">Tệp đính kèm không còn khả dụng.</p>}{attachmentDownloadError && <p role="alert" className="mt-2 text-red-700">{attachmentDownloadError}</p>}</div>}{editable && <Form spaceId={spaceId} row={row} files={files} saved={submission => setRows(previous => previous.map(item => item.task.id === row.task.id ? { task: { ...item.task, status: 'SUBMITTED' }, submission } : item))} />}</li>
    })}</ul>}
  </section>
}


