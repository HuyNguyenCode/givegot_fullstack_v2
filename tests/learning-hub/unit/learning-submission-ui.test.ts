import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolve } from 'node:path'

import { downloadSubmissionAttachment, submitLearningTask } from '../../../src/components/learning/LearningSubmissions'
import { finalizeLearningFileUpload, initiateLearningFileUpload, uploadLearningFileToProvider } from '../../../src/components/learning/LearningResources'

const source = readFileSync(resolve('src/components/learning/LearningSubmissions.tsx'), 'utf8')
test('G2 form supports mobile text and file selection with retryable loading and validation', () => {
  assert.match(source, /rows=\{5\}/)
  assert.match(source, /w-full/)
  assert.match(source, /files\.map/)
  assert.match(source, /Hoặc tải tệp mới/)
  assert.match(source, /Tải tệp và đính kèm/)
  assert.match(source, /Đang tải tệp lên/)
  assert.match(source, /Đang xác nhận tệp/)
  assert.match(source, /break-words/)
  assert.match(source, /Đang tải công việc/)
  assert.match(source, /Thử lại/)
  assert.match(source, /role="alert"/)
  assert.match(source, /setError\(null\)/)
})
test('G2 form blocks duplicate clicks and retains the draft on validation or request failure', () => {
  assert.match(source, /if \(inFlight\.current \|\| directAttachment\) return/)
  assert.match(source, /uploadInFlight\.current/)
  assert.match(source, /disabled=\{busy \|\| !!directAttachment\}/)
  assert.match(source, /if \(!content\.trim\(\) && !linkUrl\.trim\(\) && !attachmentResourceId\)/)
  assert.match(source, /catch \(cause\) \{ setError/)
  assert.doesNotMatch(source, /setContent\(''\)|setLinkUrl\(''\)|setAttachmentResourceId\(''\)/)
})


test('G2 submits a newly READY attachment and retries a failed submission without re-upload', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const responses = [
    Response.json({ resourceId: 'ready-file', upload: { url: 'https://upload.example.test', fields: { key: 'opaque' }, expiresAt: '2099-01-01T00:00:00.000Z' } }, { status: 201 }),
    new Response(null, { status: 204 }),
    Response.json({ resourceId: 'ready-file', status: 'READY' }),
    Response.json({ error: 'Máy chủ tạm thời không khả dụng' }, { status: 502 }),
    Response.json({ submission: { id: 'submission-1', content: 'Bài nộp', linkUrl: '', attachmentResourceId: 'ready-file', revisionCount: 1, status: 'SUBMITTED' } }, { status: 201 }),
  ]
  const request = (async (input: string | URL | Request, init?: RequestInit) => { calls.push({ input: String(input), init }); return responses.shift()! }) as typeof fetch
  const file = new File(['%PDF-'], `Bài nộp tiếng Việt ${'rất dài '.repeat(20)}.pdf`, { type: 'application/pdf' })

  const reservation = await initiateLearningFileUpload('space', file, request)
  await uploadLearningFileToProvider(file, reservation.upload, request)
  const finalized = await finalizeLearningFileUpload('space', reservation.resourceId, request)
  assert.equal(finalized.status, 'READY')

  await assert.rejects(
    () => submitLearningTask('space', 'task', { content: 'Bài nộp', linkUrl: '', attachmentResourceId: reservation.resourceId }, request),
    /Máy chủ tạm thời không khả dụng/,
  )
  const result = await submitLearningTask('space', 'task', { content: 'Bài nộp', linkUrl: '', attachmentResourceId: reservation.resourceId }, request)

  assert.equal(result.submission.attachmentResourceId, 'ready-file')
  assert.deepEqual(calls.map(call => call.input), [
    '/api/learning/spaces/space/files',
    'https://upload.example.test',
    '/api/learning/spaces/space/files/ready-file/finalize',
    '/api/learning/spaces/space/tasks/task/submission',
    '/api/learning/spaces/space/tasks/task/submission',
  ])
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)).attachmentResourceId, 'ready-file')
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)).attachmentResourceId, 'ready-file')
})
test('G2 attachment download is an explicit accessible action using the F1 endpoint only after a signed URL is returned', async () => {
  const requests: Array<{ url: string; method?: string }> = []
  const navigated: string[] = []
  await downloadSubmissionAttachment('space id', 'file/id', async (url, init) => {
    requests.push({ url: String(url), method: init?.method })
    return new Response(JSON.stringify({ url: 'https://signed.example/download' }))
  }, url => navigated.push(url))
  assert.deepEqual(requests, [{ url: '/api/learning/spaces/space%20id/files/file%2Fid/download', method: 'POST' }])
  assert.deepEqual(navigated, ['https://signed.example/download'])
  assert.match(source, /aria-label=\{`Tải tệp đính kèm \$\{attachment\.title\}`\}/)
  assert.match(source, /onClick=\{\(\) => void downloadAttachment\(attachment\)\}/)
  assert.doesNotMatch(source, /attachmentResourceId && <a href=/)
  assert.doesNotMatch(source, /storageKey/)
  assert.doesNotMatch(source, /signed\.example/)
})
test('G2 attachment download failure does not navigate and retains the submission UI error path', async () => {
  let navigated = false
  await assert.rejects(downloadSubmissionAttachment('space', 'file', async () => new Response(JSON.stringify({ error: 'Tệp không còn khả dụng' }), { status: 404 }), () => { navigated = true }), /Tệp không còn khả dụng/)
  assert.equal(navigated, false)
  assert.match(source, /setAttachmentDownloadError\(cause instanceof Error/)
  assert.match(source, /attachmentDownloadError && <p role="alert"/)
  assert.match(source, /row\.submission\.attachmentResourceId && !attachment/)
})
test('G2 does not request an attachment while rendering or loading', () => {
  assert.equal((source.match(/downloadAttachment\(/g) ?? []).length, 2, 'download is only defined and bound to the explicit click action')
})