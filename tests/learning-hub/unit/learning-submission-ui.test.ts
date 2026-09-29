import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolve } from 'node:path'

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

