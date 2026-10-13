'use client'
import { useEffect, useRef, useState } from 'react'

import {
  finalizeLearningFileUpload,
  formatFileSize,
  hasCurrentLearningUploadCredential,
  initiateLearningFileUpload,
  type LearningFileUploadReservation,
  uploadLearningFileToProvider,
} from '@/components/learning/LearningResources'

export type Task = { id: string; title: string; description: string | null; acceptanceCriteria: string | null; assigneeId: string; status: string; dueAt: string | null }
type Submission = { id: string; content: string | null; linkUrl: string | null; attachmentResourceId: string | null; revisionCount: number; status: string; submittedAt: string }
type Resource = { id: string; title: string; kind: string; status: string }
type Row = { task: Task; submission: Submission | null }
export type DirectAttachment = { file: File; reservation: LearningFileUploadReservation | null; phase: 'SELECTED' | 'UPLOADING' | 'FINALIZING' }
export type Draft = { content: string; linkUrl: string; attachmentResourceId: string; attachmentTitle: string; directAttachment: DirectAttachment | null }
export type TaskRequestState = { busy: boolean; error: string | null }
const idleRequest: TaskRequestState = { busy: false, error: null }
const emptyDraft = (): Draft => ({ content: '', linkUrl: '', attachmentResourceId: '', attachmentTitle: '', directAttachment: null })
export const TASK_PAGE_SIZE = 8
const taskStatusLabels: Record<string, string> = {
  OPEN: 'Chưa bắt đầu', IN_PROGRESS: 'Đang thực hiện', SUBMITTED: 'Đã nộp',
  REVISION_REQUESTED: 'Cần chỉnh sửa', REVIEWED: 'Đã đánh giá', COMPLETED: 'Đã hoàn thành', CANCELLED: 'Đã hủy',
}
export const learningTaskStatusLabel = (status: string) => taskStatusLabels[status] ?? status
export function paginateLearningTasks(rows: Row[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / TASK_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  return { page, pageCount, rows: rows.slice((page - 1) * TASK_PAGE_SIZE, page * TASK_PAGE_SIZE) }
}
const formatDateTime = (value: string) => new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value))
const taskTitle = (task: Task) => task.title?.trim() || 'Tiêu đề công việc không khả dụng'

export function TaskListRow({ task, selected, onSelect }: { task: Task; selected: boolean; onSelect(): void }) {
  return <button type="button" onClick={onSelect} aria-current={selected ? 'true' : undefined} className={`min-h-16 w-full min-w-0 rounded-xl border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 ${selected ? 'border-purple-600 bg-purple-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-purple-50'}`}>
    <span className="block min-w-0 break-words [overflow-wrap:anywhere] text-base font-semibold leading-snug text-slate-950">{taskTitle(task)}</span>
    <span className="mt-2 inline-flex max-w-full rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{learningTaskStatusLabel(task.status)}</span>
    {task.dueAt && <span className="mt-2 block break-words text-xs text-slate-600">Hạn: {formatDateTime(task.dueAt)}</span>}
  </button>
}

export function TaskRequirements({ task, headingRef }: { task: Task; headingRef?: React.Ref<HTMLHeadingElement> }) {
  return <>
    <h3 ref={headingRef} tabIndex={-1} className="break-words [overflow-wrap:anywhere] text-xl font-bold leading-snug text-slate-950 focus:outline-none">{taskTitle(task)}</h3>
    <p className="mt-2 inline-flex rounded-full bg-purple-100 px-2.5 py-1 text-sm font-semibold text-purple-800">{learningTaskStatusLabel(task.status)}</p>
    {task.dueAt && <p className="mt-2 break-words text-sm text-slate-600">Hạn nộp: {formatDateTime(task.dueAt)}</p>}
    <section className="mt-5 min-w-0 border-t border-slate-200 pt-4" aria-label="Mô tả bài tập">
      <h4 className="text-sm font-semibold text-slate-900">Mô tả bài tập</h4>
      <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-slate-700">{task.description?.trim() ? task.description : 'Chưa có mô tả.'}</p>
    </section>
    <section className="mt-5 min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Yêu cầu hoàn thành">
      <h4 className="text-sm font-semibold text-slate-900">Yêu cầu hoàn thành</h4>
      <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm leading-6 text-slate-700">{task.acceptanceCriteria?.trim() ? task.acceptanceCriteria : 'Chưa có yêu cầu hoàn thành.'}</p>
    </section>
  </>
}

async function read(response: Response) {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Không thể tải dữ liệu')
  return data
}
export async function fetchReadyLearningFiles(spaceId: string, request: typeof fetch = fetch): Promise<Resource[]> {
  const data = await read(await request('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/resources?view=ready-files', { cache: 'no-store' })) as { resources: Resource[] }
  return data.resources
}
export async function submitLearningTask(spaceId: string, taskId: string, input: { content: string; linkUrl: string; attachmentResourceId: string }, request: typeof fetch = fetch) {
  return await read(await request('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks/' + encodeURIComponent(taskId) + '/submission', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  })) as { submission: Submission }
}
export async function downloadSubmissionAttachment(spaceId: string, resourceId: string, request: typeof fetch = fetch, navigate: (url: string) => void = url => window.location.assign(url)) {
  const result = await read(await request('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/files/' + encodeURIComponent(resourceId) + '/download', { method: 'POST' })) as { url?: unknown }
  if (typeof result.url !== 'string' || !result.url) throw new Error('Không thể tạo liên kết tải xuống')
  navigate(result.url)
}
export async function uploadTaskAttachment(spaceId: string, taskId: string, selected: DirectAttachment, inFlight: Set<string>, onState: (state: TaskRequestState) => void, updateDraft: (change: Partial<Draft>) => void, fileReady: (file: Resource) => void, request: typeof fetch = fetch) {
  if (inFlight.has(taskId)) return
  inFlight.add(taskId)
  onState({ busy: true, error: null })
  updateDraft({ directAttachment: selected })
  let current = selected
  let error: string | null = null
  try {
    if (!current.reservation || (current.phase === 'UPLOADING' && !hasCurrentLearningUploadCredential(current.reservation.upload))) {
      current = { ...current, reservation: null, phase: 'UPLOADING' }
      updateDraft({ directAttachment: current })
      current = { ...current, reservation: await initiateLearningFileUpload(spaceId, current.file, request, null, 'SUBMISSION_ATTACHMENT') }
      updateDraft({ directAttachment: current })
    }
    if (current.phase !== 'FINALIZING') {
      await uploadLearningFileToProvider(current.file, current.reservation!.upload, request)
      current = { ...current, phase: 'FINALIZING' }
      updateDraft({ directAttachment: current })
    }
    const finalized = await finalizeLearningFileUpload(spaceId, current.reservation!.resourceId, request)
    if (finalized.status !== 'READY') throw new Error('Tệp chưa sẵn sàng để đính kèm')
    fileReady({ id: finalized.resourceId, title: current.file.name, kind: 'FILE', status: 'READY' })
    updateDraft({ attachmentResourceId: finalized.resourceId, attachmentTitle: current.file.name, directAttachment: null })
  } catch (cause) { error = cause instanceof Error ? cause.message : 'Không thể tải tệp lên' }
  finally { inFlight.delete(taskId); onState({ busy: false, error }) }
}
export async function submitTaskDraft(spaceId: string, taskId: string, draft: Draft, inFlight: Set<string>, onState: (state: TaskRequestState) => void, saved: (submission: Submission) => void, request: typeof fetch = fetch) {
  if (inFlight.has(taskId) || draft.directAttachment) return
  if (!draft.content.trim() && !draft.linkUrl.trim() && !draft.attachmentResourceId) { onState({ busy: false, error: 'Thêm nội dung, liên kết HTTPS hoặc tệp đính kèm.' }); return }
  if (draft.linkUrl.trim()) {
    try { const url = new URL(draft.linkUrl.trim()); if (url.protocol !== 'https:' || url.username || url.password) throw new Error() }
    catch { onState({ busy: false, error: 'Liên kết phải là HTTPS hợp lệ.' }); return }
  }
  inFlight.add(taskId)
  onState({ busy: true, error: null })
  let error: string | null = null
  try {
    const data = await submitLearningTask(spaceId, taskId, { content: draft.content, linkUrl: draft.linkUrl, attachmentResourceId: draft.attachmentResourceId }, request)
    saved(data.submission)
  } catch (cause) { error = cause instanceof Error ? cause.message : 'Không thể gửi bài' }
  finally { inFlight.delete(taskId); onState({ busy: false, error }) }
}
export function Form({ spaceId, row, draft, uploadState, submitState, updateDraft, uploadAttachment, submitDraft, clearUploadError, clearSubmitError }: {
  spaceId: string; row: Row; draft: Draft; uploadState: TaskRequestState; submitState: TaskRequestState; updateDraft(change: Partial<Draft>): void; uploadAttachment(selected: DirectAttachment): void; submitDraft(draft: Draft): void; clearUploadError(): void; clearSubmitError(): void
}) {
  const busy = submitState.busy
  const uploadBusy = uploadState.busy
  const uploadError = uploadState.error
  const submitError = submitState.error
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerBusy, setPickerBusy] = useState(false)
  const [pickerError, setPickerError] = useState<string | null>(null)
  const [pickerFiles, setPickerFiles] = useState<Resource[]>([])

  async function openPicker() {
    setPickerOpen(true)
    setPickerBusy(true)
    setPickerError(null)
    try { setPickerFiles(await fetchReadyLearningFiles(spaceId)) }
    catch (cause) { setPickerError(cause instanceof Error ? cause.message : 'Không thể tải tệp đã tải lên') }
    finally { setPickerBusy(false) }
  }
  return <form onSubmit={event => { event.preventDefault(); submitDraft(draft) }} className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5" aria-labelledby={`submission-form-${row.task.id}`}>
    <h4 id={`submission-form-${row.task.id}`} className="text-base font-semibold text-slate-900">Bài làm của bạn</h4>
    <p className="mt-1 text-sm text-slate-600">Thêm nội dung, liên kết hoặc tệp. Chỉ cần một trong ba.</p>
    <div className="mt-4 space-y-4">
      <label className="block text-sm font-medium">Nội dung bài làm<textarea disabled={busy} value={draft.content} onChange={event => { updateDraft({ content: event.target.value }); clearSubmitError() }} maxLength={20000} rows={4} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3" /></label>
      <label className="block text-sm font-medium">Liên kết bài làm (nếu có)<input disabled={busy} value={draft.linkUrl} onChange={event => { updateDraft({ linkUrl: event.target.value }); clearSubmitError() }} type="url" inputMode="url" placeholder="https://…" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3" /></label>
      <fieldset className="min-w-0 border-t border-slate-200 pt-4"><legend className="px-1 text-sm font-semibold text-slate-900">Tệp đính kèm</legend>
        {!draft.directAttachment && !draft.attachmentResourceId && <label className="mt-2 block min-w-0 cursor-pointer rounded-xl border border-dashed border-purple-300 bg-white p-4 text-sm text-slate-800 focus-within:outline-none focus-within:ring-2 focus-within:ring-purple-600 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"><span className="block font-semibold text-purple-700">Chọn tệp từ thiết bị</span><span className="mt-1 block text-xs text-slate-600">PDF, JPG, PNG, TXT hoặc Markdown</span><input disabled={busy} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.md,application/pdf,image/jpeg,image/png,text/plain,text/markdown" className="sr-only" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { const selected: DirectAttachment = { file, reservation: null, phase: 'SELECTED' }; uploadAttachment(selected) } }} /></label>}
        {draft.directAttachment && <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3" aria-live="polite"><p className="break-words text-sm font-medium">{draft.directAttachment.file.name}</p><p className="mt-1 text-xs text-slate-500">{formatFileSize(draft.directAttachment.file.size)}</p>{uploadBusy && <p role="status" className="mt-2 text-sm font-medium text-purple-700">{draft.directAttachment.phase === 'FINALIZING' ? 'Đang xác nhận tệp…' : 'Đang tải lên…'}</p>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={uploadBusy || busy} onClick={() => void uploadAttachment(draft.directAttachment!)} className="min-h-10 rounded-lg bg-purple-600 px-3 text-sm font-semibold text-white disabled:opacity-60">{draft.directAttachment.phase === 'FINALIZING' ? 'Thử lại xác nhận' : 'Thử lại tải lên'}</button><button type="button" disabled={uploadBusy || busy} onClick={() => { updateDraft({ directAttachment: null }); clearUploadError() }} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:opacity-60">Bỏ chọn</button></div></div>}
        {draft.attachmentResourceId && <div className="mt-2 min-w-0 rounded-lg border border-emerald-300 bg-emerald-50 p-3" aria-live="polite"><p className="break-words text-sm font-medium text-slate-900">{draft.attachmentTitle || 'Tệp đã tải lên'}</p><p className="mt-1 text-sm font-medium text-emerald-800">Sẵn sàng đính kèm</p><button type="button" disabled={busy} onClick={() => { updateDraft({ attachmentResourceId: '', attachmentTitle: '' }); clearUploadError() }} className="mt-2 min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium">Bỏ tệp / chọn tệp khác</button></div>}
        {uploadError && <p role="alert" className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{uploadError}</p>}
        {!draft.directAttachment && <div className="mt-3"><button type="button" disabled={busy || pickerBusy} onClick={() => { if (busy) return; if (pickerOpen) setPickerOpen(false); else void openPicker() }} aria-expanded={pickerOpen} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium">Dùng tệp đã tải lên trước đó</button>{pickerOpen && <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">{pickerBusy && <p role="status" className="text-sm">Đang tải danh sách tệp…</p>}{pickerError && <p role="alert" className="text-sm text-red-700">{pickerError}</p>}{!pickerBusy && !pickerError && pickerFiles.length === 0 && <p className="text-sm text-slate-600">Chưa có tệp sẵn sàng.</p>}{!pickerBusy && !pickerError && <ul className="space-y-2">{pickerFiles.map(file => <li key={file.id}><button type="button" disabled={busy} onClick={() => { updateDraft({ attachmentResourceId: file.id, attachmentTitle: file.title }); setPickerOpen(false); clearUploadError() }} className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-left text-sm break-words hover:bg-purple-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600">{file.title}</button></li>)}</ul>}</div>}</div>}
      </fieldset>
      {submitError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{submitError}</p>}
      <button type="submit" disabled={busy || !!draft.directAttachment} className="min-h-11 w-full rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto">{busy ? 'Đang gửi bài…' : row.submission ? 'Gửi bản sửa' : 'Gửi bài'}</button>
    </div>
  </form>
}
export function LearningSubmissions({ spaceId, viewerId, archived }: { spaceId: string; viewerId: string; archived: boolean }) {
  const [rows, setRows] = useState<Row[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [taskPage, setTaskPage] = useState(1)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [uploadStates, setUploadStates] = useState<Record<string, TaskRequestState>>({})
  const [submitStates, setSubmitStates] = useState<Record<string, TaskRequestState>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [readyFiles, setReadyFiles] = useState<Resource[]>([])
  const [readyFilesError, setReadyFilesError] = useState(false)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState<string | null>(null)
  const [attachmentDownloadError, setAttachmentDownloadError] = useState<string | null>(null)
  const uploadingTasks = useRef(new Set<string>())
  const submittingTasks = useRef(new Set<string>())
  const attachmentDownloadInFlight = useRef(false)
  const listHeading = useRef<HTMLHeadingElement>(null)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const tasks: Task[] = (await read(await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks', { cache: 'no-store' }))).tasks
        const loaded = await Promise.all(tasks.map(async task => ({ task, submission: (await read(await fetch('/api/learning/spaces/' + encodeURIComponent(spaceId) + '/tasks/' + encodeURIComponent(task.id) + '/submission', { cache: 'no-store' }))).submission as Submission | null })))
        if (active) {
          setRows(loaded)
          setError(null)
          if (window.matchMedia('(min-width: 1024px)').matches) setSelectedTaskId(current => current ?? loaded[0]?.task.id ?? null)
        }
        try { const files = await fetchReadyLearningFiles(spaceId); if (active) { setReadyFiles(files); setReadyFilesError(false) } }
        catch { if (active) setReadyFilesError(true) }
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Không thể tải công việc') }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [spaceId, reload])
  const row = rows.find(item => item.task.id === selectedTaskId)
  const taskPagination = paginateLearningTasks(rows, taskPage)
  const editable = !!row && !archived && row.task.assigneeId === viewerId && ((!row.submission && ['OPEN', 'IN_PROGRESS'].includes(row.task.status)) || (row.submission?.status === 'REVISION_REQUESTED' && row.task.status === 'REVISION_REQUESTED'))
  const attachment = row?.submission?.attachmentResourceId ? readyFiles.find(file => file.id === row.submission?.attachmentResourceId) : null
  function updateDraft(taskId: string, change: Partial<Draft>) { if (submittingTasks.current.has(taskId)) return; setDrafts(previous => ({ ...previous, [taskId]: { ...(previous[taskId] ?? emptyDraft()), ...change } })) }
  function clearUploadError(taskId: string) { setUploadStates(previous => ({ ...previous, [taskId]: idleRequest })) }
  function clearSubmitError(taskId: string) { setSubmitStates(previous => ({ ...previous, [taskId]: idleRequest })) }
  function uploadAttachment(taskId: string, selected: DirectAttachment) {
    if (submittingTasks.current.has(taskId)) return
    void uploadTaskAttachment(spaceId, taskId, selected, uploadingTasks.current,
      state => setUploadStates(previous => ({ ...previous, [taskId]: state })),
      change => updateDraft(taskId, change),
      file => setReadyFiles(previous => [...previous.filter(item => item.id !== file.id), file]))
  }
  function submitDraft(taskId: string, draft: Draft) {
    if (uploadingTasks.current.has(taskId)) return
    void submitTaskDraft(spaceId, taskId, draft, submittingTasks.current,
      state => setSubmitStates(previous => ({ ...previous, [taskId]: state })),
      submission => {
        setRows(previous => previous.map(item => item.task.id === taskId ? { task: { ...item.task, status: 'SUBMITTED' }, submission } : item))
        void fetchReadyLearningFiles(spaceId).then(files => { setReadyFiles(files); setReadyFilesError(false) }).catch(() => setReadyFilesError(true))
      })
  }
  async function downloadAttachment(resource: Resource) {
    if (attachmentDownloadInFlight.current) return
    attachmentDownloadInFlight.current = true
    setDownloadingAttachmentId(resource.id)
    setAttachmentDownloadError(null)
    try { await downloadSubmissionAttachment(spaceId, resource.id) }
    catch (cause) { setAttachmentDownloadError(cause instanceof Error ? cause.message : 'Không thể tạo liên kết tải xuống') }
    finally { attachmentDownloadInFlight.current = false; setDownloadingAttachmentId(null) }
  }
  function selectTask(taskId: string) {
    setSelectedTaskId(taskId)
    setAttachmentDownloadError(null)
    window.requestAnimationFrame(() => detailHeading.current?.focus())
  }
  function showTaskList() {
    setSelectedTaskId(null)
    window.requestAnimationFrame(() => listHeading.current?.focus())
  }
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-labelledby="tasks-heading"><h2 id="tasks-heading" className="text-base font-semibold text-slate-900">Công việc & bài nộp</h2>
    {loading && <p role="status" className="mt-3 text-sm text-slate-600">Đang tải công việc…</p>}
    {error && <div className="mt-3"><p role="alert" className="text-sm text-red-700">{error}</p><button type="button" onClick={() => { setError(null); setLoading(true); setReload(value => value + 1) }} className="mt-2 min-h-10 rounded-lg border border-slate-300 px-3 text-sm">Thử lại</button></div>}
    {!loading && !error && rows.length === 0 && <p className="mt-3 text-sm text-slate-600">Chưa có công việc nào được giao.</p>}
    {!loading && !error && rows.length > 0 && <div className="mt-5 min-w-0 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,13fr)] lg:gap-5">
      <div className={`${row ? 'hidden lg:block' : 'block'} min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-3`}>
        <h3 ref={listHeading} tabIndex={-1} className="text-sm font-semibold text-slate-900">Danh sách công việc</h3>
        <ul className="mt-2 space-y-2">{taskPagination.rows.map(item => <li key={item.task.id} className="min-w-0"><TaskListRow task={item.task} selected={selectedTaskId === item.task.id} onSelect={() => selectTask(item.task.id)} /></li>)}</ul>
        {taskPagination.pageCount > 1 && <nav aria-label="Phân trang công việc" className="mt-3 flex items-center justify-between gap-2"><button type="button" disabled={taskPagination.page === 1} onClick={() => setTaskPage(taskPagination.page - 1)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium disabled:opacity-50">← Trước</button><span className="text-xs text-slate-600">Trang {taskPagination.page} / {taskPagination.pageCount}</span><button type="button" disabled={taskPagination.page === taskPagination.pageCount} onClick={() => setTaskPage(taskPagination.page + 1)} className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium disabled:opacity-50">Sau →</button></nav>}
      </div>
      <div className={`${row ? 'block' : 'hidden lg:block'} min-w-0 rounded-xl border border-slate-200 p-4 sm:p-5`}>
        {!row && <div className="flex min-h-48 items-center justify-center text-center"><div><p className="font-medium text-slate-800">Chọn một công việc</p><p className="mt-1 text-sm text-slate-600">Chi tiết và bài nộp sẽ xuất hiện tại đây.</p></div></div>}
        {row && <><button type="button" onClick={showTaskList} className="mb-4 min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 lg:hidden">← Quay lại danh sách</button><TaskRequirements task={row.task} headingRef={detailHeading} />{row.submission && <div className="mt-5 min-w-0 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-purple-950">Đã nộp · bản {row.submission.revisionCount}</p><time className="text-xs text-purple-800" dateTime={row.submission.submittedAt}>{formatDateTime(row.submission.submittedAt)}</time></div>{row.submission.content && <p className="mt-3 whitespace-pre-wrap break-words text-slate-800">{row.submission.content}</p>}{row.submission.linkUrl && <a href={row.submission.linkUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all font-medium text-purple-700 underline-offset-4 hover:underline">Mở liên kết bài nộp</a>}{attachment && <button type="button" disabled={downloadingAttachmentId === attachment.id} onClick={() => void downloadAttachment(attachment)} aria-label={`Tải tệp đính kèm ${attachment.title}`} className="mt-3 block break-all text-left font-medium text-purple-700 disabled:opacity-60 cursor-pointer">{downloadingAttachmentId === attachment.id ? 'Đang chuẩn bị tải xuống…' : `Tệp đính kèm: ${attachment.title}`}</button>}{row.submission.attachmentResourceId && !attachment && <p role="alert" className="mt-3 text-red-700">{readyFilesError ? 'Không thể kiểm tra tệp đính kèm. Hãy thử tải lại trang.' : 'Tệp đính kèm không còn khả dụng.'}</p>}{attachmentDownloadError && <p role="alert" className="mt-3 text-red-700">{attachmentDownloadError}</p>}</div>}{editable && <Form key={row.task.id} spaceId={spaceId} row={row} draft={drafts[row.task.id] ?? emptyDraft()} uploadState={uploadStates[row.task.id] ?? idleRequest} submitState={submitStates[row.task.id] ?? idleRequest} updateDraft={change => updateDraft(row.task.id, change)} uploadAttachment={selected => uploadAttachment(row.task.id, selected)} submitDraft={draft => submitDraft(row.task.id, draft)} clearUploadError={() => clearUploadError(row.task.id)} clearSubmitError={() => clearSubmitError(row.task.id)} />}</>}
      </div>
    </div>}
  </section>
}
