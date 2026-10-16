'use client'
import { useEffect, useRef, useState } from 'react'

export type PrivateReview = { id: string; content: string; outcome: 'REVIEWED' | 'REVISION_REQUESTED'; reviewedAt: string }
type ReviewResult = { review: PrivateReview | null; canReview: boolean }
type Props = { spaceId: string; taskId: string; submissionId: string; revisionCount: number; archived: boolean; onReviewed(): void }
type FormProps = { content: string; outcome: string; deadline: string; busy: boolean; error: string | null; onContent(value: string): void; onOutcome(value: string): void; onDeadline(value: string): void; onSubmit(): void }
const endpoint = (spaceId: string, taskId: string) => `/api/learning/spaces/${encodeURIComponent(spaceId)}/tasks/${encodeURIComponent(taskId)}/submission/review`
async function responseBody(response: Response) {
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Không thể tải phản hồi')
  return data
}
export async function sendSubmissionReview(spaceId: string, taskId: string, input: { submissionId: string; revisionCount: number; content: string; outcome: string; revisionDueAt?: string }, request: typeof fetch = fetch) {
  return responseBody(await request(endpoint(spaceId, taskId), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }))
}
export function PrivateFeedback({ review }: { review: PrivateReview }) {
  return <div className="mt-4 rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm" aria-label="Phản hồi riêng tư"><p className="font-semibold">{review.outcome === 'REVIEWED' ? 'Đã đánh giá' : 'Yêu cầu chỉnh sửa'}</p><p className="mt-2 whitespace-pre-wrap break-words">{review.content}</p><time className="mt-2 block text-xs text-slate-600" dateTime={review.reviewedAt}>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(review.reviewedAt))}</time></div>
}
export function ReviewForm({ content, outcome, deadline, busy, error, onContent, onOutcome, onDeadline, onSubmit }: FormProps) {
  return <form onSubmit={event => { event.preventDefault(); onSubmit() }} className="mt-3 space-y-3 rounded-xl border border-slate-200 p-4">
    <label className="block text-sm font-medium">Nội dung phản hồi<textarea value={content} onChange={event => onContent(event.target.value)} disabled={busy} maxLength={20000} rows={4} className="mt-1 w-full rounded-lg border p-3" /></label>
    <label className="block text-sm font-medium">Kết quả<select value={outcome} onChange={event => onOutcome(event.target.value)} disabled={busy} className="mt-1 block min-h-11 w-full rounded-lg border p-2"><option value="REVIEWED">Đã đánh giá</option><option value="REVISION_REQUESTED">Yêu cầu chỉnh sửa</option></select></label>
    {outcome === 'REVISION_REQUESTED' && <label className="block text-sm font-medium">Hạn chỉnh sửa (không bắt buộc)<input type="datetime-local" value={deadline} onChange={event => onDeadline(event.target.value)} onClick={(e) => e.currentTarget.showPicker?.()} disabled={busy} className="mt-1 block min-h-11 w-full rounded-lg border p-2" /><span className="mt-1 block text-xs text-slate-600">Theo múi giờ thiết bị. Để trống giữ hạn hiện tại.</span></label>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={busy} className="min-h-11 w-full rounded-lg bg-purple-600 px-4 text-white focus-visible:ring-2 focus-visible:ring-purple-600 disabled:opacity-60 sm:w-auto">{busy ? 'Đang gửi…' : 'Gửi phản hồi'}</button>
  </form>
}
export default function LearningSubmissionReview({ spaceId, taskId, submissionId, revisionCount, archived, onReviewed }: Props) {
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [content, setContent] = useState('')
  const [outcome, setOutcome] = useState('REVIEWED')
  const [deadline, setDeadline] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  useEffect(() => {
    let active = true
    fetch(endpoint(spaceId, taskId), { cache: 'no-store' }).then(responseBody).then(data => { if (active) { setResult(data); setLoadError(null) } }).catch(() => { if (active) setLoadError('Không thể tải phản hồi riêng tư.') })
    return () => { active = false }
  }, [spaceId, taskId, submissionId, revisionCount, reload])
  async function submit() {
    if (pending.current || archived || !result?.canReview) return
    if (!content.trim()) { setError('Nhập nội dung phản hồi.'); return }
    let revisionDueAt: string | undefined
    if (outcome === 'REVISION_REQUESTED' && deadline) {
      const due = new Date(deadline)
      if (!Number.isFinite(due.getTime()) || due.getTime() <= Date.now()) { setError('Chọn hạn chỉnh sửa trong tương lai.'); return }
      revisionDueAt = due.toISOString()
    }
    pending.current = true; setBusy(true); setError(null)
    try {
      const data = await sendSubmissionReview(spaceId, taskId, { submissionId, revisionCount, content, outcome, ...(revisionDueAt ? { revisionDueAt } : {}) })
      setResult({ review: data.review, canReview: false }); onReviewed()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Không thể gửi phản hồi.'); setReload(value => value + 1) }
    finally { pending.current = false; setBusy(false) }
  }
  if (loadError) return <div className="mt-4"><p role="alert">{loadError}</p><button type="button" onClick={() => setReload(value => value + 1)} className="min-h-10 underline">Thử lại</button></div>
  if (!result) return <p role="status" className="mt-4 text-sm">Đang tải phản hồi…</p>
  return <section className="mt-5 min-w-0" aria-label="Đánh giá bài nộp">
    <h4 className="font-semibold">Phản hồi riêng tư · bản {revisionCount}</h4>
    <p className="mt-1 text-sm text-slate-600">Chỉ thành viên không gian học được xem phản hồi.</p>
    {result.review && <PrivateFeedback review={result.review} />}
    {!result.review && !result.canReview && <p className="mt-2 text-sm">Chưa có phản hồi cho bản này.</p>}
    {!archived && result.canReview && <ReviewForm content={content} outcome={outcome} deadline={deadline} busy={busy} error={error} onContent={setContent} onOutcome={setOutcome} onDeadline={setDeadline} onSubmit={() => void submit()} />}
  </section>
}
