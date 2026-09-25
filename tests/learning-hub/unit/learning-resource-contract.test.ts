import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { clampResourceGroupPages, createLearningLink, deleteLearningResource, fetchLearningResources, fileUploadReducer, formatFileSize, groupLearningResources, LearningResources, paginateLearningResourceGroup, RESOURCE_GROUP_PAGE_SIZE, SelectedFileReview, uploadLearningFile } from '../../../src/components/learning/LearningResources'
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

test('resources group by the supplied topic order, preserve row order, and keep topicless resources last', () => {
  const resource = (id: string, topicId: string | null, topicLabel: string | null) => ({ id, bookingId: null, topicId, kind: id.startsWith('file') ? 'FILE' as const : 'LINK' as const, title: id, description: null, externalUrl: id.startsWith('file') ? null : 'https://example.com', mimeType: null, sizeBytes: null, status: 'READY' as const, createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel, canDelete: true })
  const topics = [
    { id: 'topic-calculus', label: 'Tích phân', state: 'ACTIVE' as const },
    { id: 'topic-extrema', label: 'Cực trị', state: 'ARCHIVED' as const },
    { id: 'topic-empty', label: 'Không có tài nguyên', state: 'ACTIVE' as const },
  ]
  const resources = [resource('link-extrema-1', 'topic-extrema', 'Cực trị'), resource('file-calculus', 'topic-calculus', 'Tích phân'), resource('link-extrema-2', 'topic-extrema', 'Cực trị'), resource('file-topicless', null, null)]

  const groups = groupLearningResources(resources, topics)

  assert.deepEqual(groups.map(group => [group.id, group.label, group.resources.map(item => item.id)]), [
    ['topic-calculus', 'Tích phân', ['file-calculus']],
    ['topic-extrema', 'Cực trị', ['link-extrema-1', 'link-extrema-2']],
    ['topicless', 'Chưa gắn chủ đề', ['file-topicless']],
  ])
  assert.equal(groups.some(group => group.id === 'topic-empty'), false)
  const html = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) }, topics, archived: false, resources }))
  assert.match(html, /Tích phân.*1 tài nguyên/)
  assert.match(html, /Cực trị.*2 tài nguyên/)
  assert.match(html, /Chưa gắn chủ đề.*1 tài nguyên/)
  assert.ok(html.indexOf('Tích phân') < html.indexOf('Cực trị'))
  assert.ok(html.indexOf('link-extrema-1') < html.indexOf('link-extrema-2'))
  const afterDeletingExtrema = groupLearningResources(resources.filter(item => item.topicId !== 'topic-extrema'), topics)
  assert.equal(afterDeletingExtrema.some(group => group.id === 'topic-extrema'), false)
})

test('topic-group controls are local, independently collapsible, and do not add progressive disclosure', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /const \[collapsedTopicIds, setCollapsedTopicIds\] = useState<Set<string>>/)
  assert.match(source, /function toggleTopicGroup\(topicId: string\)/)
  assert.match(source, /aria-expanded=\{!collapsed\}/)
  assert.match(source, /resourceGroups\.map\(group =>/)
  assert.doesNotMatch(source, /Xem thêm|visibleResourceCount|loadMore/)
})

test('resource pagination is independent per group, pages five rows at a time, and clamps after authoritative replacement', async () => {
  const resource = (id: number, topicId: string | null = 'topic-a') => ({ id: `resource-${id}`, bookingId: null, topicId, kind: id % 2 ? 'LINK' as const : 'FILE' as const, title: `Tài nguyên ${id}`, description: null, externalUrl: id % 2 ? 'https://example.com' : null, mimeType: null, sizeBytes: null, status: 'READY' as const, createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: topicId ? 'Chủ đề A' : null, canDelete: true })
  const six = Array.from({ length: 6 }, (_, index) => resource(index + 1))
  const eleven = Array.from({ length: 11 }, (_, index) => resource(index + 1))
  assert.equal(RESOURCE_GROUP_PAGE_SIZE, 5)
  assert.deepEqual(paginateLearningResourceGroup(six.slice(0, 5), 1), { page: 1, pageCount: 1, resources: six.slice(0, 5) })
  assert.deepEqual(paginateLearningResourceGroup(six, 1).resources.map(item => item.id), ['resource-1', 'resource-2', 'resource-3', 'resource-4', 'resource-5'])
  assert.deepEqual(paginateLearningResourceGroup(six, 2).resources.map(item => item.id), ['resource-6'])
  assert.equal(paginateLearningResourceGroup(six, 1).pageCount, 2)
  assert.deepEqual([1, 2, 3].map(page => paginateLearningResourceGroup(eleven, page).resources.length), [5, 5, 1])
  const topic = [{ id: 'topic-a', label: 'Chủ đề A', state: 'ACTIVE' as const }]
  const sixMarkup = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: '1' }, topics: topic, archived: false, resources: six }))
  assert.match(sixMarkup, /Chủ đề A.*6 tài nguyên/)
  assert.match(sixMarkup, new RegExp('Trang 1 / 2'))
  assert.match(sixMarkup, new RegExp('disabled=""[^>]*>← Trước</button>'))
  assert.doesNotMatch(sixMarkup, /Tài nguyên 6/)
  const fiveMarkup = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: '1' }, topics: topic, archived: false, resources: six.slice(0, 5) }))
  assert.doesNotMatch(fiveMarkup, /Trang 1/)

  const groups = groupLearningResources([...eleven, ...Array.from({ length: 6 }, (_, index) => resource(index + 20, null))], topic)
  assert.deepEqual(clampResourceGroupPages(groups, { 'topic-a': 3, topicless: 2 }), { 'topic-a': 3, topicless: 2 })
  assert.deepEqual(clampResourceGroupPages(groupLearningResources(eleven.slice(0, 10), topic), { 'topic-a': 3, topicless: 2 }), { 'topic-a': 2 })

  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /const \[resourcePages, setResourcePages\] = useState<Record<string, number>>\(\{\}\)/)
  assert.match(source, /clampResourceGroupPages\(groupLearningResources\(resourceItems, topics\), current\)/)
  assert.match(source, /← Trước/)
  assert.match(source, /Trang \{pagination\.page\} \/ \{pagination\.pageCount\}/)
  assert.match(source, /Sau →/)
  assert.doesNotMatch(source, /Xem thêm|loadMore|page=|limit=/)
})

test('file upload can optionally associate the same active topic selector used by links', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const responses = [
    Response.json({ resourceId: 'file-1', upload: { url: 'https://upload.example.test', fields: { key: 'opaque' } } }, { status: 201 }),
    new Response(null, { status: 204 }),
    Response.json({ resourceId: 'file-1', status: 'READY' }),
    Response.json({ resources: [], quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) } }),
  ]
  const request = (async (input: string | URL | Request, init?: RequestInit) => { calls.push({ input: String(input), init }); return responses.shift()! }) as typeof fetch

  await uploadLearningFile('space', new File(['%PDF-'], 'valid.pdf', { type: 'application/pdf' }), request, 'topic-1')
  assert.match(String(calls[0].init?.body), /"topicId":"topic-1"/)
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /const \[fileTopicId, setFileTopicId\] = useState\(''\)/)
  assert.match(source, /uploadLearningFile\(spaceId, file, fetch, fileTopicId \|\| null\)/)
  assert.match(source, /<option value="">Không gắn chủ đề<\/option>\{activeTopics\.map/)
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

test('resource deletion uses an anchored confirmation popover and preserves LINK and FILE DELETE contracts', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const request = (async (input: string | URL | Request, init?: RequestInit) => { calls.push({ input: String(input), init }); return new Response(null, { status: 204 }) }) as typeof fetch
  const link = { id: 'link/id', kind: 'LINK' as const, title: 'Liên kết' }
  const file = { id: 'file/id', kind: 'FILE' as const, title: 'Tệp riêng tư.pdf' }

  await deleteLearningResource('space/id', link, request)
  await deleteLearningResource('space/id', file, request)
  assert.deepEqual(calls.map(call => call.input), [
    '/api/learning/spaces/space%2Fid/resources/link%2Fid',
    '/api/learning/spaces/space%2Fid/files/file%2Fid',
  ])
  assert.deepEqual(calls.map(call => call.init?.method), ['DELETE', 'DELETE'])

  const failedRequest = (async () => Response.json({ error: 'Không thể xóa tài nguyên' }, { status: 502 })) as typeof fetch
  await assert.rejects(() => deleteLearningResource('space', link, failedRequest), { message: 'Không thể xóa tài nguyên' })
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /role="dialog"/)
  assert.match(source, /Xóa tài nguyên này\?/)
  assert.match(source, /setDeleteCandidate\(resource\)/)
  assert.match(source, /onClick=\{closeDeleteConfirmation\}/)
  assert.match(source, /event\.key !== 'Escape'/)
  assert.match(source, /Đang xóa\.\.\./)
  assert.match(source, /setResourceItems\(items => items\.filter\(item => item\.id !== resource\.id\)\)/)
  assert.match(source, /const deleteInFlight = useRef<string \| null>\(null\)/)
  assert.match(source, /setDeleteError\('Không thể xóa tài nguyên\. Kiểm tra kết nối và thử lại\.'\)/)
  assert.doesNotMatch(source, /window\.confirm|reloadPage|location\.reload|Failed to fetch/)
})

test('successful deletion revalidates the authoritative resource list and quota without client-side quota math', async () => {
  const refreshed = { resources: [{ id: 'remaining-file', bookingId: null, topicId: null, kind: 'FILE', title: 'Còn lại.pdf', description: null, externalUrl: null, mimeType: 'application/pdf', sizeBytes: '5242880', status: 'READY', createdAt: '2030-01-01T00:00:00.000Z', uploaderName: 'An', topicLabel: null, canDelete: true }], quota: { usedBytes: '5242880', maxBytes: String(500 * 1024 * 1024) } }
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const request = (async (input: string | URL | Request, init?: RequestInit) => { calls.push({ input: String(input), init }); return Response.json(refreshed) }) as typeof fetch

  assert.deepEqual(await fetchLearningResources('space/id', request), refreshed)
  assert.deepEqual(calls.map(call => call.input), ['/api/learning/spaces/space%2Fid/resources'])
  assert.equal(calls[0].init?.cache, 'no-store')
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/components/learning/LearningResources.tsx', 'utf8'))
  assert.match(source, /const refreshed = await fetchLearningResources\(spaceId\)/)
  assert.match(source, /setResourceItems\(refreshed\.resources\.map\(item => \(\{ \.\.\.item, createdAt: new Date\(item\.createdAt\) \}\)\)\)/)
  assert.match(source, /setResourceQuota\(refreshed\.quota\)/)
  assert.match(source, /Tài nguyên đã được xóa nhưng danh sách chưa thể cập nhật\./)
  assert.doesNotMatch(source, /resourceQuota.*sizeBytes|sizeBytes.*resourceQuota|location\.reload/)
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
