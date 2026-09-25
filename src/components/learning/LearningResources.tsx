'use client'

import { useEffect, useReducer, useRef, useState } from 'react'
import { Download, ExternalLink, FileUp, Link2, LoaderCircle, Trash2, X } from 'lucide-react'

export type LearningResourceView = { id: string; bookingId: string | null; topicId: string | null; kind: 'LINK' | 'FILE'; title: string; description: string | null; externalUrl: string | null; mimeType: string | null; sizeBytes: string | null; status: 'PENDING' | 'READY' | 'QUARANTINED' | 'DELETED'; createdAt: Date; uploaderName: string; topicLabel: string | null; canDelete: boolean }
type Props = { spaceId: string; resources: LearningResourceView[]; quota: { usedBytes: string; maxBytes: string }; topics: Array<{ id: string; label: string; state: 'ACTIVE' | 'ARCHIVED' }>; archived: boolean }
type ResourceListResponse = { resources: Array<Omit<LearningResourceView, 'createdAt'> & { createdAt: string }>; quota: Props['quota'] }
export type FileUploadState = { phase: 'EMPTY' | 'SELECTED' | 'UPLOADING' | 'SUCCESS' | 'ERROR'; file: File | null }
type FileUploadAction = { type: 'SELECT'; file: File } | { type: 'REMOVE' } | { type: 'UPLOAD' } | { type: 'SUCCEED' } | { type: 'FAIL' }
export type LearningResourceGroup = { id: string; label: string; resources: LearningResourceView[]; topicless: boolean }
export const RESOURCE_GROUP_PAGE_SIZE = 5

class LearningResourceRefreshError extends Error {}

const initialFileUploadState: FileUploadState = { phase: 'EMPTY', file: null }
const bytes = (value: string) => `${(Number(value) / (1024 * 1024)).toFixed(1)} MB`
const labels = { PENDING: 'Đang chờ tải lên', READY: 'Sẵn sàng', QUARANTINED: 'Không thể sử dụng', DELETED: 'Đã xóa' } as const

export function groupLearningResources(resources: LearningResourceView[], topics: Props['topics']): LearningResourceGroup[] {
  const resourcesByTopicId = new Map<string, LearningResourceView[]>()
  const unknownTopicGroups = new Map<string, LearningResourceGroup>()
  const topicIds = new Set(topics.map(topic => topic.id))
  const topicless: LearningResourceView[] = []

  for (const resource of resources) {
    if (!resource.topicId) {
      topicless.push(resource)
      continue
    }
    if (topicIds.has(resource.topicId)) {
      const grouped = resourcesByTopicId.get(resource.topicId) ?? []
      grouped.push(resource)
      resourcesByTopicId.set(resource.topicId, grouped)
      continue
    }
    const existing = unknownTopicGroups.get(resource.topicId)
    if (existing) existing.resources.push(resource)
    else {
      if (!resource.topicLabel) throw new Error('A resource topic must include its label')
      unknownTopicGroups.set(resource.topicId, { id: resource.topicId, label: resource.topicLabel, resources: [resource], topicless: false })
    }
  }

  return [
    ...topics.flatMap(topic => {
      const grouped = resourcesByTopicId.get(topic.id)
      return grouped ? [{ id: topic.id, label: topic.label, resources: grouped, topicless: false }] : []
    }),
    ...unknownTopicGroups.values(),
    ...(topicless.length ? [{ id: 'topicless', label: 'Chưa gắn chủ đề', resources: topicless, topicless: true }] : []),
  ]
}

export function paginateLearningResourceGroup(resources: LearningResourceView[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(resources.length / RESOURCE_GROUP_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  const start = (page - 1) * RESOURCE_GROUP_PAGE_SIZE
  return { page, pageCount, resources: resources.slice(start, start + RESOURCE_GROUP_PAGE_SIZE) }
}

export function clampResourceGroupPages(groups: LearningResourceGroup[], pages: Record<string, number>) {
  return Object.fromEntries(groups.map(group => [group.id, paginateLearningResourceGroup(group.resources, pages[group.id] ?? 1).page]))
}

export function formatFileSize(value: number) {
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

export function fileUploadReducer(state: FileUploadState, action: FileUploadAction): FileUploadState {
  if (action.type === 'SELECT') return { phase: 'SELECTED', file: action.file }
  if (action.type === 'REMOVE') return initialFileUploadState
  if (action.type === 'UPLOAD') return state.file && state.phase !== 'UPLOADING' ? { ...state, phase: 'UPLOADING' } : state
  if (action.type === 'SUCCEED') return { phase: 'SUCCESS', file: null }
  return state.file ? { ...state, phase: 'ERROR' } : state
}

async function responseJson(response: Response) {
  const data: unknown = await response.json().catch(() => null)
  if (!response.ok) throw new Error(data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Không thể xử lý tài nguyên')
  return data
}

export async function fetchLearningResources(spaceId: string, request: typeof fetch = fetch) {
  const base = `/api/learning/spaces/${encodeURIComponent(spaceId)}`
  return await responseJson(await request(`${base}/resources`, { cache: 'no-store' })) as ResourceListResponse
}

export async function uploadLearningFile(spaceId: string, file: File, request: typeof fetch = fetch, topicId: string | null = null) {
  const base = `/api/learning/spaces/${encodeURIComponent(spaceId)}`
  const init = await responseJson(await request(`${base}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName: file.name, mimeType: file.type, sizeBytes: file.size, topicId }),
  })) as { resourceId: string; upload: { url: string; fields: Record<string, string> } }
  const form = new FormData()
  Object.entries(init.upload.fields).forEach(([key, value]) => form.append(key, value))
  form.append('file', file)
  const put = await request(init.upload.url, { method: 'POST', body: form })
  if (!put.ok) throw new Error('Tải tệp lên kho riêng tư thất bại')
  await responseJson(await request(`${base}/files/${encodeURIComponent(init.resourceId)}/finalize`, { method: 'POST' }))
  try {
    return await fetchLearningResources(spaceId, request)
  } catch {
    throw new LearningResourceRefreshError('Tệp đã được tải lên nhưng danh sách chưa thể cập nhật.')
  }
}

export async function createLearningLink(spaceId: string, form: FormData, request: typeof fetch = fetch) {
  const base = `/api/learning/spaces/${encodeURIComponent(spaceId)}`
  await responseJson(await request(`${base}/resources`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: form.get('url'), title: form.get('title'), description: form.get('description'), topicId: form.get('topicId') || null }) }))
  try {
    return await fetchLearningResources(spaceId, request)
  } catch {
    throw new LearningResourceRefreshError('Liên kết đã được lưu nhưng danh sách chưa thể cập nhật.')
  }
}

export async function deleteLearningResource(spaceId: string, resource: Pick<LearningResourceView, 'id' | 'kind'>, request: typeof fetch = fetch) {
  const base = `/api/learning/spaces/${encodeURIComponent(spaceId)}`
  const path = resource.kind === 'FILE' ? `${base}/files/${encodeURIComponent(resource.id)}` : `${base}/resources/${encodeURIComponent(resource.id)}`
  await responseJson(await request(path, { method: 'DELETE' }))
}

export function SelectedFileReview({ state, busy, onRemove, onUpload }: { state: FileUploadState; busy: boolean; onRemove: () => void; onUpload: () => void }) {
  if (!state.file) return null
  return <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3" aria-live="polite">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-medium text-slate-900">{state.file.name}</p><p className="mt-1 text-xs text-slate-500">{formatFileSize(state.file.size)}</p></div><button type="button" disabled={state.phase === 'UPLOADING'} onClick={onRemove} aria-label={`Bỏ chọn ${state.file.name}`} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-50"><X className="h-4 w-4" /></button></div>
    {state.phase === 'UPLOADING' && <p role="status" className="mt-3 flex items-center gap-2 text-sm font-medium text-purple-700"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />Đang tải lên...</p>}
    <button type="button" disabled={busy || state.phase === 'UPLOADING'} onClick={onUpload} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:opacity-60">{state.phase === 'ERROR' ? 'Thử lại' : 'Tải lên'}</button>
  </div>
}

export function LearningResources({ spaceId, resources, quota, topics, archived }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resourceItems, setResourceItems] = useState(resources)
  const [resourceQuota, setResourceQuota] = useState(quota)
  const [fileUpload, dispatchFileUpload] = useReducer(fileUploadReducer, initialFileUploadState)
  const [fileTopicId, setFileTopicId] = useState('')
  const [collapsedTopicIds, setCollapsedTopicIds] = useState<Set<string>>(() => new Set())
  const [resourcePages, setResourcePages] = useState<Record<string, number>>({})
  const [deleteCandidate, setDeleteCandidate] = useState<LearningResourceView | null>(null)
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadInFlight = useRef(false)
  const deleteInFlight = useRef<string | null>(null)
  const deleteTrigger = useRef<HTMLButtonElement>(null)
  const deletePopover = useRef<HTMLDivElement>(null)
  const deleteCancel = useRef<HTMLButtonElement>(null)
  const activeTopics = topics.filter(topic => topic.state === 'ACTIVE')
  const resourceGroups = groupLearningResources(resourceItems, topics)

  function toggleTopicGroup(topicId: string) {
    setCollapsedTopicIds(current => {
      const next = new Set(current)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  function setResourceGroupPage(groupId: string, page: number) {
    setResourcePages(current => ({ ...current, [groupId]: page }))
  }

  useEffect(() => {
    setResourcePages(current => {
      const next = clampResourceGroupPages(resourceGroups, current)
      return Object.keys(current).length === Object.keys(next).length && Object.entries(next).every(([id, page]) => current[id] === page) ? current : next
    })
  }, [resourceItems, topics])

  function restoreDeleteTriggerFocus() {
    if (typeof window !== 'undefined') window.requestAnimationFrame(() => deleteTrigger.current?.focus())
  }

  function closeDeleteConfirmation() {
    if (deleteInFlight.current) return
    setDeleteCandidate(null)
    setDeleteError(null)
    restoreDeleteTriggerFocus()
  }

  useEffect(() => {
    if (!deleteCandidate) return
    const focusCancel = window.requestAnimationFrame(() => deleteCancel.current?.focus())
    const closeForOutsideClick = (event: MouseEvent) => {
      if (deleteInFlight.current || deletePopover.current?.contains(event.target as Node) || deleteTrigger.current?.contains(event.target as Node)) return
      setDeleteCandidate(null)
      setDeleteError(null)
      restoreDeleteTriggerFocus()
    }
    const closeForEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || deleteInFlight.current) return
      event.preventDefault()
      setDeleteCandidate(null)
      setDeleteError(null)
      restoreDeleteTriggerFocus()
    }
    document.addEventListener('mousedown', closeForOutsideClick)
    document.addEventListener('keydown', closeForEscape)
    return () => {
      window.cancelAnimationFrame(focusCancel)
      document.removeEventListener('mousedown', closeForOutsideClick)
      document.removeEventListener('keydown', closeForEscape)
    }
  }, [deleteCandidate])

  function clearSelectedFile() {
    if (fileUpload.phase === 'UPLOADING') return
    dispatchFileUpload({ type: 'REMOVE' })
    setError(null)
    if (fileInput.current) fileInput.current.value = ''
  }

  async function addLink(form: FormData) {
    setBusy(true)
    setError(null)
    try {
      const result = await createLearningLink(spaceId, form)
      setResourceItems(result.resources.map(resource => ({ ...resource, createdAt: new Date(resource.createdAt) })))
      setResourceQuota(result.quota)
      return true
    } catch (cause) {
      if (cause instanceof LearningResourceRefreshError) {
        setError(cause.message)
        return true
      }
      setError(cause instanceof Error ? cause.message : 'Không thể thêm liên kết')
      return false
    } finally {
      setBusy(false)
    }
  }

  async function upload() {
    const file = fileUpload.file
    if (!file || uploadInFlight.current) return
    uploadInFlight.current = true
    setBusy(true)
    setError(null)
    dispatchFileUpload({ type: 'UPLOAD' })
    try {
      const result = await uploadLearningFile(spaceId, file, fetch, fileTopicId || null)
      setResourceItems(result.resources.map(resource => ({ ...resource, createdAt: new Date(resource.createdAt) })))
      setResourceQuota(result.quota)
      dispatchFileUpload({ type: 'SUCCEED' })
      setFileTopicId('')
      if (fileInput.current) fileInput.current.value = ''
    } catch (cause) {
      dispatchFileUpload({ type: cause instanceof LearningResourceRefreshError ? 'SUCCEED' : 'FAIL' })
      if (cause instanceof LearningResourceRefreshError && fileInput.current) fileInput.current.value = ''
      setError(cause instanceof Error ? cause.message : 'Không thể tải tệp lên')
    } finally {
      uploadInFlight.current = false
      setBusy(false)
    }
  }

  async function download(id: string) {
    setBusy(true)
    setError(null)
    try {
      const result = await responseJson(await fetch(`/api/learning/spaces/${encodeURIComponent(spaceId)}/files/${encodeURIComponent(id)}/download`, { method: 'POST' })) as { url: string }
      window.location.assign(result.url)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tạo liên kết tải xuống')
    } finally {
      setBusy(false)
    }
  }

  function openDeleteConfirmation(resource: LearningResourceView, trigger: HTMLButtonElement) {
    if (deleteInFlight.current) return
    deleteTrigger.current = trigger
    setDeleteCandidate(resource)
    setDeleteError(null)
  }

  async function confirmRemove() {
    const resource = deleteCandidate
    if (!resource || deleteInFlight.current) return
    deleteInFlight.current = resource.id
    setDeletingResourceId(resource.id)
    setBusy(true)
    setError(null)
    setDeleteError(null)
    try {
      await deleteLearningResource(spaceId, resource)
      setResourceItems(items => items.filter(item => item.id !== resource.id))
      setDeleteCandidate(null)
      restoreDeleteTriggerFocus()
      try {
        const refreshed = await fetchLearningResources(spaceId)
        setResourceItems(refreshed.resources.map(item => ({ ...item, createdAt: new Date(item.createdAt) })))
        setResourceQuota(refreshed.quota)
      } catch {
        setError('Tài nguyên đã được xóa nhưng danh sách chưa thể cập nhật.')
      }
    } catch {
      setDeleteError('Không thể xóa tài nguyên. Kiểm tra kết nối và thử lại.')
    } finally {
      deleteInFlight.current = null
      setDeletingResourceId(null)
      setBusy(false)
    }
  }

  function renderResource(resource: LearningResourceView) {
    return <li key={resource.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0">{resource.status === 'READY' && resource.kind === 'LINK' && resource.externalUrl ? <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer" className="block break-words font-medium text-slate-900 underline-offset-4 hover:text-purple-700 hover:focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2">{resource.title}</a> : <p className="break-words font-medium text-slate-900">{resource.title}</p>}{resource.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{resource.description}</p>}<p className="mt-2 text-xs text-slate-500">{resource.kind === 'LINK' ? 'Liên kết' : resource.mimeType || 'Tệp'} · {resource.uploaderName} · {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(resource.createdAt))}{resource.topicLabel ? ` · ${resource.topicLabel}` : ''} · <span className={resource.status === 'READY' ? 'text-emerald-700' : resource.status === 'DELETED' ? 'text-slate-500' : 'text-amber-700'}>{labels[resource.status]}</span></p></div><div className="flex shrink-0 gap-2">{resource.status === 'READY' && resource.kind === 'LINK' && resource.externalUrl && <a href={resource.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-medium">Mở<ExternalLink className="h-4 w-4" /></a>}{resource.status === 'READY' && resource.kind === 'FILE' && <button disabled={busy} onClick={() => void download(resource.id)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-sm font-medium">Tải<Download className="h-4 w-4" /></button>}{resource.canDelete && resource.status !== 'DELETED' && <div className="relative"><button disabled={busy} onClick={event => openDeleteConfirmation(resource, event.currentTarget)} aria-label={`Xóa ${resource.title}`} aria-haspopup="dialog" aria-expanded={deleteCandidate?.id === resource.id} aria-controls={`delete-resource-${resource.id}`} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-red-200 px-3 text-sm font-medium text-red-700"><Trash2 className="h-4 w-4" />Xóa</button>{deleteCandidate?.id === resource.id && <div ref={deletePopover} id={`delete-resource-${resource.id}`} role="dialog" aria-label="Xác nhận xóa tài nguyên" className="absolute right-0 top-full z-10 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"><p className="text-sm font-medium text-slate-900">Xóa tài nguyên này?</p>{deleteError && <p role="alert" className="mt-2 text-sm text-red-700">{deleteError}</p>}<div className="mt-3 flex justify-end gap-2"><button ref={deleteCancel} type="button" disabled={deletingResourceId === resource.id} onClick={closeDeleteConfirmation} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600 focus-visible:ring-offset-2 disabled:opacity-60">Hủy</button><button type="button" disabled={deletingResourceId === resource.id} onClick={() => void confirmRemove()} className="min-h-10 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2 disabled:opacity-60">{deletingResourceId === resource.id ? 'Đang xóa...' : 'Xóa'}</button></div></div>}</div>}</div></div></li>
  }

  return <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="resources-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="resources-heading" className="text-base font-semibold text-slate-900">Tài nguyên</h2><p className="mt-1 text-sm text-slate-600">Đã dùng {bytes(resourceQuota.usedBytes)} / {bytes(resourceQuota.maxBytes)} kho riêng tư</p></div></div>
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {fileUpload.phase === 'SUCCESS' && <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Tệp đã được tải lên thành công.</p>}
    {!archived && <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <form onSubmit={event => { event.preventDefault(); const form = event.currentTarget; void addLink(new FormData(form)).then(created => { if (created) form.reset() }) }} className="rounded-xl bg-slate-50 p-4">
        <h3 className="flex items-center gap-2 font-medium text-slate-900"><Link2 className="h-4 w-4" />Thêm liên kết HTTPS</h3>
        <label className="mt-3 block text-sm font-medium">Tiêu đề<input required name="title" maxLength={255} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
        <label className="mt-3 block text-sm font-medium">Liên kết<input required name="url" type="url" placeholder="https://…" className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
        <label className="mt-3 block text-sm font-medium">Mô tả (không bắt buộc)<textarea name="description" maxLength={10000} className="mt-1 w-full rounded-lg border border-slate-300 p-2" /></label>
        <label className="mt-3 block text-sm font-medium">Chủ đề<select name="topicId" className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">Không gắn chủ đề</option>{activeTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
        <button disabled={busy} className="mt-3 min-h-11 rounded-xl bg-purple-600 px-4 text-sm font-semibold text-white disabled:opacity-60">Lưu liên kết</button>
      </form>
      <div className="rounded-xl bg-slate-50 p-4">
        <h3 className="flex items-center gap-2 font-medium text-slate-900"><FileUp className="h-4 w-4" />Tải tệp riêng tư</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">PDF, JPG, PNG, TXT hoặc Markdown; tối đa 20 MB. Tệp không được đọc hoặc xem trước.</p>
        <label className="mt-3 block text-sm font-medium">Chủ đề<select value={fileTopicId} disabled={busy || fileUpload.phase === 'UPLOADING'} onChange={event => setFileTopicId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2"><option value="">Không gắn chủ đề</option>{activeTopics.map(topic => <option key={topic.id} value={topic.id}>{topic.label}</option>)}</select></label>
        {(fileUpload.phase === 'EMPTY' || fileUpload.phase === 'SUCCESS') && <label className="mt-3 block text-sm font-medium">Tệp<input ref={fileInput} disabled={busy} type="file" accept=".pdf,.jpg,.jpeg,.png,.txt,.md,application/pdf,image/jpeg,image/png,text/plain,text/markdown" className="mt-1 block w-full text-sm" onChange={event => { const file = event.currentTarget.files?.[0]; if (file) { setError(null); dispatchFileUpload({ type: 'SELECT', file }) } }} /></label>}
        <SelectedFileReview state={fileUpload} busy={busy} onRemove={clearSelectedFile} onUpload={() => void upload()} />
      </div>
    </div>}
    {resourceItems.length === 0 ? <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Chưa có tài nguyên. Thêm một liên kết HTTPS hoặc tệp riêng tư để bắt đầu.</p> : <div className="mt-5 space-y-4">{resourceGroups.map(group => {
      const collapsed = !group.topicless && collapsedTopicIds.has(group.id)
      const listId = `resource-topic-${group.id}`
      const pagination = paginateLearningResourceGroup(group.resources, resourcePages[group.id] ?? 1)
      return <section key={group.id} className="rounded-xl bg-slate-50 p-3">
        {group.topicless ? <h3 className="px-1 text-sm font-semibold text-slate-900">{group.label} <span className="font-normal text-slate-500">{group.resources.length} tài nguyên</span></h3> : <h3><button type="button" onClick={() => toggleTopicGroup(group.id)} aria-expanded={!collapsed} aria-controls={listId} className="flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-1 text-left text-sm font-semibold text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-600"><span>{group.label} <span className="font-normal text-slate-500">{group.resources.length} tài nguyên</span></span><span aria-hidden="true">{collapsed ? '▸' : '▾'}</span></button></h3>}
        {!collapsed && <><ul id={listId} className="mt-3 space-y-3">{pagination.resources.map(renderResource)}</ul>{pagination.pageCount > 1 && <nav aria-label={`Phân trang ${group.label}`} className="mt-3 flex items-center justify-between gap-3"><button type="button" disabled={pagination.page === 1} onClick={() => setResourceGroupPage(group.id, pagination.page - 1)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:opacity-50">← Trước</button><p className="text-sm text-slate-600">Trang {pagination.page} / {pagination.pageCount}</p><button type="button" disabled={pagination.page === pagination.pageCount} onClick={() => setResourceGroupPage(group.id, pagination.page + 1)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium disabled:opacity-50">Sau →</button></nav>}</>}
      </section>
    })}</div>}
  </section>
}
