import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolve } from 'node:path'

import { downloadSubmissionAttachment } from '../../../src/components/learning/LearningSubmissions'

const source = readFileSync(resolve('src/components/learning/LearningSubmissions.tsx'), 'utf8')
test('G2 form supports mobile text and file selection with retryable loading and validation', () => {
  assert.match(source, /rows=\{5\}/)
  assert.match(source, /w-full/)
  assert.match(source, /files\.map/)
  assert.match(source, /Đang tải công việc/)
  assert.match(source, /Thử lại/)
  assert.match(source, /role="alert"/)
  assert.match(source, /setError\(null\)/)
})
test('G2 form blocks duplicate clicks and retains the draft on validation or request failure', () => {
  assert.match(source, /if \(inFlight\.current\) return/)
  assert.match(source, /disabled=\{busy\}/)
  assert.match(source, /if \(!content\.trim\(\) && !linkUrl\.trim\(\) && !attachmentResourceId\)/)
  assert.match(source, /catch \(cause\) \{ setError/)
  assert.doesNotMatch(source, /setContent\(''\)|setLinkUrl\(''\)|setAttachmentResourceId\(''\)/)
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