import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LearningSubmissionReview, { PrivateFeedback, ReviewForm, sendSubmissionReview } from '../../../src/components/learning/LearningSubmissionReview'

test('G3 private feedback renders long Vietnamese text safely and labels the outcome', () => {
  const content = 'Nhận xét bài làm rất dài '.repeat(50) + '\n<script>alert(1)</script>'
  const html = renderToStaticMarkup(createElement(PrivateFeedback, { review: { id: 'review', content, outcome: 'REVISION_REQUESTED', reviewedAt: '2030-01-01T00:00:00Z' } }))
  assert.match(html, /Yêu cầu chỉnh sửa/)
  assert.match(html, /Nhận xét bài làm rất dài/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
  assert.match(html, /whitespace-pre-wrap break-words/)
  assert.match(html, /dateTime="2030-01-01T00:00:00Z"/)
})
test('G3 form has labelled mobile controls, revision-only deadline, pending locks and retained failed draft', () => {
  const props = { content: 'Keep my feedback', outcome: 'REVISION_REQUESTED', deadline: '2030-02-01T12:00', busy: true, error: null, onContent: () => undefined, onOutcome: () => undefined, onDeadline: () => undefined, onSubmit: () => undefined }
  const busy = renderToStaticMarkup(createElement(ReviewForm, props))
  assert.equal((busy.match(/disabled=""/g) ?? []).length, 4)
  assert.match(busy, /Hạn chỉnh sửa \(không bắt buộc\)/)
  assert.match(busy, /datetime-local/)
  assert.match(busy, /min-h-11 w-full/)
  assert.match(busy, /focus-visible:ring-2/)
  const failed = renderToStaticMarkup(createElement(ReviewForm, { ...props, busy: false, error: 'Try again' }))
  assert.match(failed, /Keep my feedback/)
  assert.match(failed, /value="2030-02-01T12:00"/)
  assert.match(failed, /role="alert"/)
  assert.doesNotMatch(failed, /disabled=""/)
  const reviewed = renderToStaticMarkup(createElement(ReviewForm, { ...props, outcome: 'REVIEWED', busy: false }))
  assert.doesNotMatch(reviewed, /datetime-local/)
})
test('G3 fetch helper sends revision identity without actor fields and exposes recoverable errors', async () => {
  const input = { submissionId: 'submission', revisionCount: 2, content: 'Feedback', outcome: 'REVIEWED' }
  const calls: Array<{ url: string; body: unknown }> = []
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body)) })
    return new Response(JSON.stringify({ error: 'Refresh and retry' }), { status: 409 })
  }) as typeof fetch
  await assert.rejects(sendSubmissionReview('space /', 'task /', input, request), /Refresh and retry/)
  assert.deepEqual(calls[0].body, input)
  assert.match(calls[0].url, /space%20%2F\/tasks\/task%20%2F\/submission\/review$/)
  assert.equal(input.content, 'Feedback')
  const loading = renderToStaticMarkup(createElement(LearningSubmissionReview, { spaceId: 'space', taskId: 'task', submissionId: 'submission', revisionCount: 1, archived: true, onReviewed: () => undefined }))
  assert.match(loading, /role="status"/)
  assert.doesNotMatch(loading, /<form/)
})
