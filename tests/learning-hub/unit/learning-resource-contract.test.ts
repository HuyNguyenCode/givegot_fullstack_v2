import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { createLearningLink, fileUploadReducer, formatFileSize, LearningResources, SelectedFileReview, uploadLearningFile } from '../../../src/components/learning/LearningResources'
import { normalizeExternalUrl } from '../../../src/lib/learning-resource-service'

test('external resources accept normalized HTTPS only and reject dangerous schemes', () => {
  assert.equal(normalizeExternalUrl(' HTTPS://Example.COM/path#fragment '), 'https://example.com/path')
  for (const value of ['http://example.test', 'javascript:alert(1)', 'data:text/html,boom', 'file:///private']) {
    assert.throws(() => normalizeExternalUrl(value), { status: 400 })
  }
})

test('resource UI exposes quota, empty/error-safe states, and mobile-safe long Vietnamese filenames', () => {
  const longName = `Tài liệu luyện phát âm tiếng Việt ${'rất dài '.repeat(70)}.pdf`
  const html = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '1024', maxBytes: String(500 * 1024 * 1024) }, topics: [], archived: false, resources: [{ id: 'file', bookingId: null, topicId: null, kind: 'FILE', title: longName, description: null, externalUrl: null, mimeType: 'application/pdf', sizeBytes: '1024', status: 'READY', createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: null, canDelete: true }] }))
  assert.match(html, /Đã dùng 0.0 MB \/ 500.0 MB/)
  assert.match(html, /Tải tệp riêng tư/)
  assert.match(html, /break-words/)
  assert.match(html, /min-h-10/)
  const empty = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) }, topics: [], archived: false, resources: [] }))
  assert.match(empty, /Chưa có tài nguyên/)
  assert.match(empty, /PDF, JPG, PNG, TXT hoặc Markdown; tối đa 20 MB/)
  assert.match(empty, /accept="\.pdf,\.jpg,\.jpeg,\.png,\.txt,\.md,application\/pdf,image\/jpeg,image\/png,text\/plain,text\/markdown"/)
})

test('file upload selection is reviewable and removable before any upload starts', () => {
  const file = new File([new Uint8Array(1536)], 'valid.pdf', { type: 'application/pdf' })
  const empty = { phase: 'EMPTY' as const, file: null }
  const selected = fileUploadReducer(empty, { type: 'SELECT', file })

  assert.equal(selected.phase, 'SELECTED')
  assert.equal(selected.file?.name, 'valid.pdf')
  assert.equal(formatFileSize(selected.file!.size), '1.5 KB')
  const review = renderToStaticMarkup(createElement(SelectedFileReview, { state: selected, busy: false, onRemove: () => undefined, onUpload: () => undefined }))
  assert.match(review, /valid\.pdf/)
  assert.match(review, /1\.5 KB/)
  assert.match(review, /Bỏ chọn valid\.pdf/)
  assert.match(review, />Tải lên<\/button>/)
  assert.deepEqual(fileUploadReducer(selected, { type: 'REMOVE' }), empty)
})

test('file upload states prevent duplicate starts, preserve retry context, and clear on success', () => {
  const file = new File(['%PDF-'], 'valid.pdf', { type: 'application/pdf' })
  const selected = { phase: 'SELECTED' as const, file }
  const uploading = fileUploadReducer(selected, { type: 'UPLOAD' })

  assert.equal(uploading.phase, 'UPLOADING')
  assert.strictEqual(fileUploadReducer(uploading, { type: 'UPLOAD' }), uploading)
  const uploadingMarkup = renderToStaticMarkup(createElement(SelectedFileReview, { state: uploading, busy: true, onRemove: () => undefined, onUpload: () => undefined }))
  assert.match(uploadingMarkup, /Đang tải lên\.\.\./)
  assert.match(uploadingMarkup, /disabled=""/)
  const failed = fileUploadReducer(uploading, { type: 'FAIL' })
  assert.equal(failed.phase, 'ERROR')
  assert.strictEqual(failed.file, file)
  assert.match(renderToStaticMarkup(createElement(SelectedFileReview, { state: failed, busy: false, onRemove: () => undefined, onUpload: () => undefined })), />Thử lại<\/button>/)
  assert.equal(fileUploadReducer(failed, { type: 'UPLOAD' }).phase, 'UPLOADING')
  assert.deepEqual(fileUploadReducer(uploading, { type: 'SUCCEED' }), { phase: 'SUCCESS', file: null })
})

test('explicit upload completes the existing flow and refetches resources without a page reload', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const resource = { id: 'file-1', bookingId: null, topicId: null, kind: 'FILE' as const, title: 'valid.pdf', description: null, externalUrl: null, mimeType: 'application/pdf', sizeBytes: '5', status: 'READY' as const, createdAt: '2030-01-01T00:00:00.000Z', uploaderName: 'An', topicLabel: null, canDelete: true }
  const responses = [
    Response.json({ resourceId: 'file-1', upload: { url: 'https://upload.example.test', fields: { key: 'opaque', 'Content-Type': 'application/pdf' } } }, { status: 201 }),
    new Response(null, { status: 204 }),
    Response.json({ resourceId: 'file-1', status: 'READY' }),
    Response.json({ resources: [resource], quota: { usedBytes: '5', maxBytes: String(500 * 1024 * 1024) } }),
  ]
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ input: String(input), init })
    return responses.shift()!
  }) as typeof fetch

  const result = await uploadLearningFile('space/id', new File(['%PDF-'], 'valid.pdf', { type: 'application/pdf' }), request)

  assert.deepEqual(calls.map(call => call.input), [
    '/api/learning/spaces/space%2Fid/files',
    'https://upload.example.test',
    '/api/learning/spaces/space%2Fid/files/file-1/finalize',
    '/api/learning/spaces/space%2Fid/resources',
  ])
  assert.equal(calls[0].init?.method, 'POST')
  assert.equal(calls[1].init?.method, 'POST')
  assert.equal(calls[2].init?.method, 'POST')
  assert.equal(calls[3].init?.cache, 'no-store')
  assert.equal(result.resources[0].title, 'valid.pdf')
  assert.doesNotMatch(uploadLearningFile.toString(), /location\.reload/)
})

test('file upload failures expose only the safe API error and remain retryable', async () => {
  const request = (async () => Response.json({ error: 'Không thể cấp quyền tải tệp' }, { status: 502 })) as typeof fetch
  await assert.rejects(
    () => uploadLearningFile('space', new File(['%PDF-'], 'valid.pdf', { type: 'application/pdf' }), request),
    { message: 'Không thể cấp quyền tải tệp' },
  )
})

test('link creation revalidates local resources without native navigation and retains form validation', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const resource = { id: 'link-1', bookingId: null, topicId: null, kind: 'LINK' as const, title: 'Tài liệu', description: null, externalUrl: 'https://example.com/tai-lieu', mimeType: null, sizeBytes: null, status: 'READY' as const, createdAt: '2030-01-01T00:00:00.000Z', uploaderName: 'An', topicLabel: null, canDelete: true }
  const responses = [Response.json({ id: 'link-1', status: 'READY' }, { status: 201 }), Response.json({ resources: [resource], quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) } })]
  const request = (async (input: string | URL | Request, init?: RequestInit) => { calls.push({ input: String(input), init }); return responses.shift()! }) as typeof fetch
  const form = new FormData()
  form.set('title', 'Tài liệu')
  form.set('url', 'https://example.com/tai-lieu')

  const result = await createLearningLink('space/id', form, request)

  assert.deepEqual(calls.map(call => call.input), ['/api/learning/spaces/space%2Fid/resources', '/api/learning/spaces/space%2Fid/resources'])
  assert.equal(calls[0].init?.method, 'POST')
  assert.equal(calls[1].init?.cache, 'no-store')
  assert.equal(result.resources[0].title, 'Tài liệu')
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /onSubmit=\{event => \{ event\.preventDefault\(\)/)
  assert.doesNotMatch(source, /await createLearningLink\(spaceId, form\)\s*\n\s*reloadPage/)
  assert.match(source, /<input required name="title"/)
  assert.match(source, /<input required name="url" type="url"/)
})

test('link creation distinguishes a failed create from a saved link whose refresh fails', async () => {
  const form = new FormData()
  form.set('title', 'Tài liệu')
  form.set('url', 'https://example.com/tai-lieu')
  const createFailure = (async () => Response.json({ error: 'Không thể thêm liên kết' }, { status: 403 })) as typeof fetch
  await assert.rejects(() => createLearningLink('space', form, createFailure), { message: 'Không thể thêm liên kết' })

  const refreshFailureResponses = [Response.json({ id: 'link-1', status: 'READY' }, { status: 201 }), Response.json({ error: 'Danh sách tạm thời không khả dụng' }, { status: 502 })]
  const refreshFailure = (async () => refreshFailureResponses.shift()!) as typeof fetch
  await assert.rejects(
    () => createLearningLink('space', form, refreshFailure),
    { message: 'Liên kết đã được lưu nhưng danh sách chưa thể cập nhật.' },
  )
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /cause instanceof LearningResourceRefreshError/)
  assert.match(source, /Liên kết đã được lưu nhưng danh sách chưa thể cập nhật\./)
  assert.match(source, /setError\(cause\.message\)\s*\n\s*return true/)
})

test('ready LINK resource titles preserve the safe external-navigation contract', () => {
  const title = `Tài liệu luyện phát âm tiếng Việt ${'rất dài '.repeat(70)}`
  const html = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) }, topics: [], archived: false, resources: [
    { id: 'link', bookingId: null, topicId: null, kind: 'LINK', title, description: null, externalUrl: 'https://example.com/tai-lieu', mimeType: null, sizeBytes: null, status: 'READY', createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: null, canDelete: true },
    { id: 'file', bookingId: null, topicId: null, kind: 'FILE', title: 'Tệp riêng tư.pdf', description: null, externalUrl: null, mimeType: 'application/pdf', sizeBytes: '1024', status: 'READY', createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: null, canDelete: true },
  ] }))
  assert.match(html, new RegExp(`<a href="https://example\\.com/tai-lieu" target="_blank" rel="noopener noreferrer"[^>]*>${title}</a>`))
  assert.match(html, /Mở<svg/)
  assert.match(html, /<p[^>]*>Liên kết · An/)
  assert.match(html, /aria-label="Xóa Tài liệu luyện phát âm tiếng Việt/)
  assert.match(html, /Tệp riêng tư\.pdf<\/p>/)
  assert.match(html, /Tải<svg/)
  assert.doesNotMatch(html, /storageKey|signedUrl|spaces\//)
  assert.match(html, /break-words/)
})

test('resource contracts retain private boundaries and deduplicated activity semantics', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/lib/learning-resource-service.ts', 'utf8'))
  assert.match(source, /requireAuthenticatedUser/)
  assert.match(source, /learningSpaceId_userId/)
  assert.match(source, /findMany\(\{ where: \{ learningSpaceId: spaceId, status: \{ in: \['PENDING', 'READY', 'QUARANTINED'\] \} \}/)
  assert.match(source, /uploaderId: actorId, status: \{ not: 'DELETED' \}.*data: \{ status: 'DELETED', deletedAt: new Date\(\) \}/)
  assert.match(source, /eventKey: `learning-resource:\$\{resource.id\}:created`/)
  assert.match(source, /metadata: \{ kind: 'LINK', status: 'READY' \}/)
  assert.doesNotMatch(source, /signDownload|storageKey.*return/)
})
