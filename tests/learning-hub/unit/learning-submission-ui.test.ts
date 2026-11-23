import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { resolve } from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { applySubmissionRefresh, downloadSubmissionAttachment, fetchReadyLearningFiles, fetchSubmissionRequirements, Form, learningTaskStatusLabel, paginateLearningTasks, submitLearningTask, submitTaskDraft, TaskListRow, TaskRequirements, TASK_PAGE_SIZE, uploadTaskAttachment, viewedSubmission, type Draft, type SubmitState, type Task, type TaskRequestState } from '../../../src/components/learning/LearningSubmissions'
import { finalizeLearningFileUpload, initiateLearningFileUpload, uploadLearningFileToProvider } from '../../../src/components/learning/LearningResources'

const source = readFileSync(resolve('src/components/learning/LearningSubmissions.tsx'), 'utf8')
const sections = readFileSync(resolve('src/components/learning/LearningSpaceSections.tsx'), 'utf8')
const page = readFileSync(resolve('src/app/learning/[spaceId]/page.tsx'), 'utf8')
const rowA = { task: { id: 'A', version: 1, title: 'Task A', description: null, acceptanceCriteria: null, assigneeId: 'learner', status: 'OPEN', dueAt: null }, submission: null }
const freshnessA = viewedSubmission(rowA)

test('G2 refresh keeps the Task baseline on late, older, or cross-Task responses', async () => {
  const rowB = { ...rowA, task: { ...rowA.task, id: 'B', title: 'Task B' } }
  const newerA = { ...rowA, task: { ...rowA.task, title: 'Updated A', version: 3 }, archived: false }
  const current = {
    rows: [newerA, rowB],
    viewed: { A: freshnessA, B: viewedSubmission(rowB) },
    submitStates: { A: { busy: false, error: 'Conflict', conflict: 'TASK_REQUIREMENTS_CHANGED' as const } },
  }
  const controller = new AbortController()
  const late = Promise.withResolvers<Response>()
  const pending = fetchSubmissionRequirements('space', 'A', controller.signal, async () => late.promise)
  controller.abort()
  const accepted = applySubmissionRefresh(current, 'A', newerA, new AbortController().signal)
  late.resolve(Response.json({ ...rowA, archived: false }))
  assert.equal(applySubmissionRefresh(accepted, 'A', await pending, controller.signal), accepted)
  assert.equal(applySubmissionRefresh(accepted, 'A', rowB, new AbortController().signal), accepted)
  const rejected = applySubmissionRefresh(current, 'A', rowA, new AbortController().signal)
  assert.equal(rejected.rows, current.rows)
  assert.equal(rejected.viewed, current.viewed)
  assert.equal(rejected.submitStates.A.conflict, 'TASK_REQUIREMENTS_CHANGED')
  assert.match(rejected.submitStates.A.refreshError ?? '', /thử lại/)
  assert.equal(accepted.viewed.A.requirements.title, 'Updated A')
  assert.equal(accepted.viewed.B, current.viewed.B)
  assert.equal(accepted.submitStates.A.error, null)
  assert.match(source, /baseline\.requirements/)
  assert.match(source, /taskId !== selectedTaskId\) \{\s+cancelSubmissionRefresh\(\)/)
  assert.match(source, /delete nextViewed\[taskId\]/)
})

test('G2 typed conflict allows a failed refresh and then a fresh manual revision retry with the same draft', async () => {
  const draft = Object.freeze({ content: 'Bài làm', linkUrl: 'https://example.test/answer', attachmentResourceId: 'ready-file', attachmentTitle: 'original.pdf', directAttachment: null })
  const revision = { id: 'submission-A', content: 'Previous', linkUrl: null, attachmentResourceId: null, revisionCount: 2, status: 'REVISION_REQUESTED', submittedAt: '2030-01-01T00:00:00Z' }
  const latest = { task: { ...rowA.task, version: 5, status: 'REVISION_REQUESTED', dueAt: '2030-02-03T00:00:00Z', topicId: 'topic-A' }, submission: revision, archived: false }
  const baseline = viewedSubmission({ ...rowA, submission: { ...revision, revisionCount: 1 } })
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const request: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init })
    if (calls.length === 1) return Response.json({ error: 'Task requirements changed', code: 'TASK_REQUIREMENTS_CHANGED' }, { status: 409 })
    if (calls.length === 2) return Response.json({ error: 'Forbidden' }, { status: 403 })
    if (calls.length === 3) return Response.json(latest)
    return Response.json({ submission: { ...revision, revisionCount: 3, status: 'SUBMITTED' } }, { status: 201 })
  }
  const states: SubmitState[] = []
  const locks = new Set<string>()
  let saves = 0
  const submit = (freshness: typeof baseline) => submitTaskDraft('space', 'A', draft, freshness, locks, state => states.push(state), () => { saves++ }, request)
  await submit(baseline)
  const conflict = states.at(-1)!
  assert.equal(conflict.conflict, 'TASK_REQUIREMENTS_CHANGED')
  assert.equal(conflict.error, 'Yêu cầu của công việc đã thay đổi. Hãy cập nhật và xem lại yêu cầu mới trước khi gửi bài.')
  const current = { rows: [rowA], viewed: { A: baseline }, submitStates: { A: conflict } }
  const { signal } = new AbortController()
  await assert.rejects(fetchSubmissionRequirements('space', 'A', signal, request), /Forbidden/)
  assert.equal(current.viewed.A, baseline)
  assert.equal(saves, 0)
  const refreshed = applySubmissionRefresh(current, 'A', await fetchSubmissionRequirements('space', 'A', signal, request), signal)
  assert.equal(calls.length, 3)
  assert.equal(saves, 0)
  assert.equal(calls[2].url, '/api/learning/spaces/space/tasks/A/submission?view=requirements')
  assert.equal(calls[2].init?.cache, 'no-store')
  assert.deepEqual(refreshed.viewed.A.previousSubmission, { submissionId: revision.id, revisionCount: 2 })
  await submit(refreshed.viewed.A)
  assert.deepEqual(calls.map(call => call.init?.method ?? 'GET'), ['POST', 'GET', 'GET', 'POST'])
  const body = { content: draft.content, linkUrl: draft.linkUrl, attachmentResourceId: draft.attachmentResourceId }
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { ...body, freshness: baseline })
  assert.deepEqual(JSON.parse(String(calls[3].init?.body)), { ...body, freshness: viewedSubmission(latest) })
  assert.equal(draft.attachmentTitle, 'original.pdf')
  assert.equal(saves, 1)
})

test('G2 generic and revision-window 409s use distinct learner feedback', async () => {
  const input = { content: 'Answer', linkUrl: '', attachmentResourceId: '', freshness: freshnessA }
  await assert.rejects(submitLearningTask('space', 'A', input, async () => Response.json({ error: 'Try again' }, { status: 409 })), { code: 'OTHER', message: 'Try again' })
  await assert.rejects(submitLearningTask('space', 'A', input, async () => Response.json({ error: 'Revision changed', code: 'STALE_SUBMISSION_REVISION' }, { status: 409 })), { code: 'STALE_SUBMISSION_REVISION', message: /Phiên bản bài nộp đã thay đổi/ })
})

test('D0d sections use accessible hash links, responsive rows, and mounted panels for draft retention', () => {
  for (const label of ['Tài liệu', 'Công việc & bài nộp', 'Ghi chú', 'Lịch sử']) assert.match(sections, new RegExp(label))
  assert.match(sections, /href=\{`#\$\{section\.id\}`\}/)
  assert.match(sections, /aria-current=\{selected === section\.id/)
  assert.match(sections, /hashchange/)
  assert.match(sections, /grid-cols-2 gap-2 sm:grid-cols-4/)
  assert.match(sections, /focus-visible:ring-2/)
  assert.match(sections, /hidden=\{selected !== 'tasks'\}/)
  assert.match(sections, /break-words/)
  assert.match(page, /listLearningResources\(spaceId, 'materials'\)/)
  assert.doesNotMatch(sections, /resources=\{resources\}[^>]*LearningSubmissions/)
})
test('D0d-UX1 uses desktop master/detail and mobile list/detail navigation while retaining drafts', () => {
  assert.match(source, /selectedTaskId/)
  assert.match(source, /setDrafts\(previous =>/)
  assert.match(source, /\[taskId\]/)
  assert.match(source, /lg:grid-cols-\[minmax\(0,7fr\)_minmax\(0,13fr\)\]/)
  assert.match(source, /window\.matchMedia\('\(min-width: 1024px\)'\)\.matches/)
  assert.match(source, /row \? 'hidden lg:block' : 'block'/)
  assert.match(source, /row \? 'block' : 'hidden lg:block'/)
  assert.match(source, /selectTask\(item\.task\.id\)/)
  assert.match(source, /← Quay lại danh sách/)
  assert.match(source, /detailHeading\.current\?\.focus\(\)/)
  assert.match(source, /listHeading\.current\?\.focus\(\)/)
  assert.match(source, /\{editable && <Form key=\{row\.task\.id\}/)
  assert.match(source, /whitespace-pre-wrap break-words/)
  assert.doesNotMatch(source, /rows\.map\(row =>[\s\S]*<Form/)
})
test('D0d-UX1 task rows render authoritative titles, Vietnamese status, due date, and eight-row pages', () => {
  const task = (id: number) => ({ task: { id: String(id), title: `Công việc ${id}`, description: null, acceptanceCriteria: null, assigneeId: 'learner', status: 'IN_PROGRESS', dueAt: null }, submission: null })
  const rows = Array.from({ length: 17 }, (_, index) => task(index + 1))
  assert.equal(TASK_PAGE_SIZE, 8)
  assert.deepEqual([1, 2, 3].map(page => paginateLearningTasks(rows, page).rows.length), [8, 8, 1])
  assert.equal(paginateLearningTasks(rows, 4).page, 3)
  assert.equal(learningTaskStatusLabel('OPEN'), 'Chưa bắt đầu')
  assert.equal(learningTaskStatusLabel('IN_PROGRESS'), 'Đang thực hiện')
  assert.equal(learningTaskStatusLabel('SUBMITTED'), 'Đã nộp')
  assert.equal(learningTaskStatusLabel('REVISION_REQUESTED'), 'Cần chỉnh sửa')
  assert.match(source, /<TaskListRow task=\{item\.task\}/)
  assert.match(source, /Hạn: \{formatDateTime\(task\.dueAt\)\}/)
  assert.match(source, /Trang \{taskPagination\.page\} \/ \{taskPagination\.pageCount\}/)
})
test('D0d-UX2 renders task title, status, requirements, and optional deadline from realistic G1 rows', () => {
  const first: Task = {
    id: 'task-one', title: 'Luyện phát âm tiếng Việt rất dài '.repeat(8),
    description: 'Đọc đoạn một.\nGhi âm đoạn hai.',
    acceptanceCriteria: 'Nộp một bản ghi rõ tiếng.\nGiải thích cách sửa lỗi.',
    assigneeId: 'learner', status: 'IN_PROGRESS', dueAt: '2030-01-02T00:00:00.000Z',
  }
  const second: Task = {
    id: 'task-two', title: 'Viết đoạn hội thoại', description: null,
    acceptanceCriteria: null, assigneeId: 'learner', status: 'OPEN', dueAt: null,
  }
  const list = renderToStaticMarkup(createElement(TaskListRow, { task: first, selected: true, onSelect: () => undefined }))
  assert.ok(list.includes(first.title.trim()))
  assert.ok(list.indexOf(first.title.trim()) < list.indexOf('Đang thực hiện'))
  assert.match(list, /aria-current="true"/)
  assert.match(list, /Hạn:/)
  assert.match(list, /overflow-wrap:anywhere/)
  const firstDetail = renderToStaticMarkup(createElement(TaskRequirements, { task: first }))
  assert.ok(firstDetail.includes(first.title.trim()))
  assert.match(firstDetail, /Mô tả bài tập/)
  assert.match(firstDetail, /Đọc đoạn một\.\nGhi âm đoạn hai\./)
  assert.match(firstDetail, /Yêu cầu hoàn thành/)
  assert.match(firstDetail, /Nộp một bản ghi rõ tiếng\.\nGiải thích cách sửa lỗi\./)
  assert.match(firstDetail, /Hạn nộp:/)
  assert.match(firstDetail, /whitespace-pre-wrap/)
  const secondList = renderToStaticMarkup(createElement(TaskListRow, { task: second, selected: false, onSelect: () => undefined }))
  const secondDetail = renderToStaticMarkup(createElement(TaskRequirements, { task: second }))
  assert.ok(secondList.includes(second.title))
  assert.ok(secondDetail.includes(second.title))
  assert.doesNotMatch(secondDetail, /Luyện phát âm|Hạn nộp:/)
  assert.match(secondDetail, /Chưa có mô tả\./)
  assert.match(secondDetail, /Chưa có yêu cầu hoàn thành\./)
  assert.doesNotMatch(secondList, /Hạn:/)
  assert.doesNotMatch(secondList, /aria-current="true"/)
})
test('D0d-UX2 displays an explicit accessible fallback for an invalid missing title', () => {
  const task: Task = { id: 'legacy', title: '', description: null, acceptanceCriteria: null, dueAt: null, assigneeId: 'learner', status: 'OPEN' }
  const list = renderToStaticMarkup(createElement(TaskListRow, { task, selected: false, onSelect: () => undefined }))
  const detail = renderToStaticMarkup(createElement(TaskRequirements, { task }))
  assert.match(list, /Tiêu đề công việc không khả dụng/)
  assert.match(detail, /Tiêu đề công việc không khả dụng/)
  assert.ok(list.indexOf('Tiêu đề công việc không khả dụng') < list.indexOf('Chưa bắt đầu'))
})
test('task metadata uses authorized members and topics with explicit fallbacks', () => {
  const task: Task = { id: 't', title: 'Bài tập', description: null, acceptanceCriteria: null, assigneeId: 'a', creatorId: 'c', bookingId: 'b', topicId: 'topic', status: 'OPEN', dueAt: null }
  const card = (value: Task) => renderToStaticMarkup(createElement(TaskListRow, { task: value, selected: false, onSelect: () => undefined }))
  const detail = (value: Task) => renderToStaticMarkup(createElement(TaskRequirements, { task: value, members: [{ id: 'c', name: 'An', email: null }], topics: [{ id: 'topic', label: 'Phát âm', state: 'ARCHIVED' }] }))
  assert.match(card(task), />Gắn buổi học</)
  assert.match(card({ ...task, bookingId: null }), />Không gắn buổi học</)
  assert.match(detail(task), /Người giao: An/)
  assert.match(detail(task), /Chủ đề: Phát âm/)
  assert.match(detail({ ...task, topicId: null }), /Chủ đề: Không chọn/)
  const unavailable = detail({ ...task, creatorId: 'missing', topicId: 'missing' })
  assert.match(unavailable, /Người giao: Không khả dụng/)
  assert.match(unavailable, /Chủ đề: Không khả dụng/)
})
test('creation feedback has an isolated timed lifecycle and navigation dismissals', () => {
  const createSource = readFileSync('src/components/learning/LearningTaskCreate.tsx', 'utf8')
  assert.match(source, /setCreatedMessage\(\+\+creationSequence\.current\)/)
  assert.match(source, /current === createdMessage \? null : current/)
  assert.match(source, /4000\)/)
  assert.match(source, /return \(\) => window\.clearTimeout\(timer\)/)
  assert.match(source, /function changeFilter\(next: TaskFilter\) \{\s*setCreatedMessage\(null\)/)
  assert.match(source, /if \(taskId !== selectedTaskId\) \{\s+cancelSubmissionRefresh\(\)\s+setCreatedMessage\(null\)/)
  assert.match(source, /onOpen=\{\(\) => setCreatedMessage\(null\)\}/)
  assert.match(createSource, /if \(!open\) onOpen\?\.\(\)/)
  assert.match(source, /Đã tạo công việc\./)
  assert.match(source, /setRows\(previous => \[\{ task, submission: null \}/)
})
test('D0d-UX2 renders accessible styled file selection and a distinct READY card', () => {
  const task: Task = { id: 'task', title: 'Bài tập', description: null, acceptanceCriteria: 'Nộp bài', dueAt: null, assigneeId: 'learner', status: 'OPEN' }
  const row = { task, submission: null }
  const base = { spaceId: 'space', row, updateDraft: () => undefined, uploadState: { busy: false, error: null }, submitState: { busy: false, error: null }, uploadAttachment: () => undefined, submitDraft: () => undefined, clearUploadError: () => undefined, clearSubmitError: () => undefined }
  const draft = { content: '', linkUrl: '', attachmentResourceId: '', attachmentTitle: '', directAttachment: null }
  const empty = renderToStaticMarkup(createElement(Form, { ...base, draft }))
  assert.match(empty, /Bài làm của bạn/)
  assert.match(empty, /Nội dung bài làm/)
  assert.match(empty, /Liên kết bài làm/)
  assert.match(empty, /<label[^>]*focus-within:ring-2[^>]*>.*Chọn tệp từ thiết bị.*<input[^>]*type="file"[^>]*class="sr-only"/)
  assert.match(empty, /Dùng tệp đã tải lên trước đó/)
  assert.doesNotMatch(empty, /aria-expanded="true"/)
  const ready = renderToStaticMarkup(createElement(Form, { ...base, draft: { ...draft, attachmentResourceId: 'ready', attachmentTitle: 'Bài nộp.pdf' } }))
  assert.match(ready, /Bài nộp\.pdf/)
  assert.match(ready, /Sẵn sàng đính kèm/)
  assert.doesNotMatch(ready, /type="file"/)
})
test('D0d optional picker fetches fresh READY files on every open without using materials props', async () => {
  const calls: Array<{ url: string; cache?: RequestCache }> = []
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), cache: init?.cache })
    return Response.json({ resources: [{ id: String(calls.length), title: 'Bài nộp.pdf', kind: 'FILE', status: 'READY' }] })
  }) as typeof fetch
  assert.deepEqual((await fetchReadyLearningFiles('space/id', request)).map(file => file.id), ['1'])
  assert.deepEqual((await fetchReadyLearningFiles('space/id', request)).map(file => file.id), ['2'])
  assert.deepEqual(calls, [1, 2].map(() => ({ url: '/api/learning/spaces/space%2Fid/resources?view=ready-files', cache: 'no-store' })))
  assert.match(source, /if \(pickerOpen\) setPickerOpen\(false\); else void openPicker\(\)/)
  assert.match(source, /setPickerFiles\(await fetchReadyLearningFiles\(spaceId\)\)/)
  assert.match(source, /Dùng tệp đã tải lên trước đó/)
  assert.doesNotMatch(source, /LearningSubmissions\(\{[^}]*resources:/)
})
test('D0d direct upload stamps purpose and G2 retry reuses the finalized ID without picker selection', async () => {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const responses = [
    Response.json({ resourceId: 'ready-file', upload: { url: 'https://upload.example.test', fields: { key: 'opaque' }, expiresAt: '2099-01-01T00:00:00.000Z' } }, { status: 201 }),
    new Response(null, { status: 204 }),
    Response.json({ resourceId: 'ready-file', status: 'READY' }),
    Response.json({ error: 'Attachment must be a ready file in this learning space' }, { status: 400 }),
    Response.json({ submission: { id: 'submission-1', attachmentResourceId: 'ready-file' } }, { status: 201 }),
  ]
  const request = (async (input: string | URL | Request, init?: RequestInit) => { calls.push({ input: String(input), init }); return responses.shift()! }) as typeof fetch
  const file = new File(['%PDF-'], `Bài nộp tiếng Việt ${'rất dài '.repeat(20)}.pdf`, { type: 'application/pdf' })
  const reservation = await initiateLearningFileUpload('space', file, request, null, 'SUBMISSION_ATTACHMENT')
  await uploadLearningFileToProvider(file, reservation.upload, request)
  await finalizeLearningFileUpload('space', reservation.resourceId, request)
  await assert.rejects(() => submitLearningTask('space', 'task', { content: 'Bài nộp', linkUrl: '', attachmentResourceId: reservation.resourceId, freshness: freshnessA }, request), /Attachment must be a ready file/)
  const result = await submitLearningTask('space', 'task', { content: 'Bài nộp', linkUrl: '', attachmentResourceId: reservation.resourceId, freshness: freshnessA }, request)
  assert.equal(result.submission.attachmentResourceId, 'ready-file')
  assert.equal(calls.filter(call => call.input === 'https://upload.example.test').length, 1)
  assert.deepEqual(calls.slice(3).map(call => JSON.parse(String(call.init?.body)).attachmentResourceId), ['ready-file', 'ready-file'])
  assert.equal(JSON.parse(String(calls[0].init?.body)).purpose, 'SUBMISSION_ATTACHMENT')
  assert.match(source, /updateDraft\(\{ attachmentResourceId: finalized\.resourceId, attachmentTitle: current\.file\.name, directAttachment: null \}\)/)
  assert.match(source, /uploadAttachment\(selected\)/)
  assert.match(source, /Sẵn sàng đính kèm/)
  assert.match(source, /Bỏ tệp \/ chọn tệp khác/)
  assert.match(source, /if \(inFlight\.has\(taskId\) \|\| draft\.directAttachment\) return/)
  assert.doesNotMatch(source, /setDrafts\(\{\}\)/)
})
test('D0d preserves F1 credential and finalize retry paths, G2 gates, and private download', async () => {
  assert.match(source, /hasCurrentLearningUploadCredential\(current\.reservation\.upload\)/)
  assert.match(source, /current\.phase !== 'FINALIZING'/)
  assert.match(source, /Thử lại xác nhận/)
  assert.match(source, /Thử lại tải lên/)
  assert.match(source, /row\.task\.assigneeId === viewerId/)
  assert.match(source, /\['OPEN', 'IN_PROGRESS'\]/)
  assert.match(source, /row\.submission\?\.status === 'REVISION_REQUESTED'/)
  assert.match(source, /!archived/)
  assert.match(source, /Tệp đính kèm không còn khả dụng/)
  assert.match(source, /Không thể kiểm tra tệp đính kèm/)
  assert.doesNotMatch(source, /storageKey|signedUrl/)
  const navigated: string[] = []
  await downloadSubmissionAttachment('space id', 'file/id', async () => Response.json({ url: 'https://signed.example/download' }), url => navigated.push(url))
  assert.deepEqual(navigated, ['https://signed.example/download'])
  assert.match(source, /aria-label=\{`Tải tệp đính kèm \$\{attachment\.title\}`\}/)
  await assert.rejects(downloadSubmissionAttachment('space', 'file', async () => Response.json({ error: 'Tệp không còn khả dụng' }, { status: 404 }), () => { throw new Error('unexpected navigation') }), /Tệp không còn khả dụng/)
})
test('D0d-UX1 separates upload and submit feedback and presents successful submissions read-only', () => {
  assert.match(source, /Bài làm của bạn/)
  assert.match(source, /Nội dung bài làm/)
  assert.match(source, /Liên kết bài làm \(nếu có\)/)
  assert.match(source, /Tệp đính kèm/)
  assert.match(source, /Đang tải lên…/)
  assert.match(source, /Đang xác nhận tệp…/)
  assert.match(source, /Đang gửi bài…/)
  assert.match(source, /uploadError && <p role="alert"/)
  assert.match(source, /submitError && <p role="alert"/)
  assert.match(source, /Đã nộp · bản \{row\.submission\.revisionCount\}/)
  assert.match(source, /dateTime=\{row\.submission\.submittedAt\}/)
  assert.doesNotMatch(source, /deleteLearningResource|method: 'DELETE'/)
  assert.doesNotMatch(source, /storageKey|signedUrl/)
})
test('the removed render/loading assertion is replaced by explicit metadata and click-only download coverage', () => {
  assert.match(source, /fetchReadyLearningFiles\(spaceId\)/)
  assert.match(source, /onClick=\{\(\) => void downloadAttachment\(attachment\)\}/)
  assert.equal((source.match(/downloadSubmissionAttachment\(spaceId, resource\.id\)/g) ?? []).length, 1)
  assert.doesNotMatch(source, /attachmentResourceId && <a href=/)
})

test('D0d-F1 upload settlement after task remount clears parent busy state and preserves task-specific READY IDs', async () => {
  const fileA = new File(['A'], 'task-a.pdf', { type: 'application/pdf' })
  const fileB = new File(['B'], 'task-b.pdf', { type: 'application/pdf' })
  const blank = (): Draft => ({ content: '', linkUrl: '', attachmentResourceId: '', attachmentTitle: '', directAttachment: null })
  const drafts: Record<string, Draft> = { A: { ...blank(), content: 'A', directAttachment: { file: fileA, reservation: null, phase: 'SELECTED' } }, B: { ...blank(), content: 'B', directAttachment: { file: fileB, reservation: null, phase: 'SELECTED' } } }
  const states: Record<string, TaskRequestState> = {}
  const ready: string[] = []
  const inFlight = new Set<string>()
  let rejectFirstA!: (error: Error) => void
  const firstA = new Promise<Response>((_resolve, reject) => { rejectFirstA = reject })
  let aProviderCalls = 0
  const initiation: string[] = []
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('/files')) {
      const name = JSON.parse(String(init?.body)).fileName as string
      const id = name === fileA.name ? 'resource-A' : 'resource-B'
      initiation.push(id)
      return Response.json({ resourceId: id, upload: { url: 'https://upload.example/' + id, fields: {}, expiresAt: '2099-01-01T00:00:00.000Z' } }, { status: 201 })
    }
    if (url === 'https://upload.example/resource-A') return ++aProviderCalls === 1 ? firstA : new Response(null, { status: 204 })
    if (url === 'https://upload.example/resource-B') return new Response(null, { status: 204 })
    if (url.endsWith('/finalize')) return Response.json({ resourceId: url.includes('resource-A') ? 'resource-A' : 'resource-B', status: 'READY' })
    throw new Error('Unexpected request ' + url)
  }) as typeof fetch
  const upload = (id: 'A' | 'B', selected: NonNullable<Draft['directAttachment']>) => uploadTaskAttachment('space', id, selected, inFlight, state => { states[id] = state }, change => { drafts[id] = { ...drafts[id], ...change } }, file => ready.push(file.id), request)
  const pendingA = upload('A', drafts.A.directAttachment!)
  assert.equal(states.A.busy, true)
  await upload('A', drafts.A.directAttachment!)
  const completedB = upload('B', drafts.B.directAttachment!)
  await completedB
  assert.equal(states.B.busy, false)
  assert.equal(drafts.B.attachmentResourceId, 'resource-B')
  assert.equal(states.A.busy, true)
  const rowA = { task: { id: 'A', title: 'Task A', description: null, acceptanceCriteria: null, assigneeId: 'learner', status: 'OPEN', dueAt: null }, submission: null }
  const props = { spaceId: 'space', row: rowA, updateDraft: () => undefined, uploadAttachment: () => undefined, submitDraft: () => undefined, clearUploadError: () => undefined, clearSubmitError: () => undefined }
  const during = renderToStaticMarkup(createElement(Form, { ...props, draft: drafts.A, uploadState: states.A, submitState: { busy: false, error: null } }))
  assert.match(during, /Đang tải lên/)
  assert.match(during, /<button[^>]*disabled=""[^>]*>Thử lại tải lên<\/button>/)
  rejectFirstA(new Error('Provider failed after task switch'))
  await pendingA
  assert.deepEqual(states.A, { busy: false, error: 'Provider failed after task switch' })
  assert.equal(inFlight.has('A'), false)
  const after = renderToStaticMarkup(createElement(Form, { ...props, draft: drafts.A, uploadState: states.A, submitState: { busy: false, error: null } }))
  assert.match(after, /Provider failed after task switch/)
  const retry = after.match(/<button[^>]*>Thử lại tải lên<\/button>/)?.[0]
  assert.ok(retry)
  assert.doesNotMatch(retry, /\sdisabled(?:=|\s|>)/)
  await upload('A', drafts.A.directAttachment!)
  assert.equal(drafts.A.attachmentResourceId, 'resource-A')
  assert.equal(drafts.A.directAttachment, null)
  assert.equal(drafts.B.attachmentResourceId, 'resource-B')
  assert.deepEqual(ready, ['resource-B', 'resource-A'])
  assert.deepEqual(initiation, ['resource-A', 'resource-B'])
})

test('D0d-F1 pending G2 locks remounted task inputs, rejects duplicate POST, and retains failed draft for retry', async () => {
  const draft: Draft = { content: 'Version 1', linkUrl: 'https://example.test/v1', attachmentResourceId: 'ready-A', attachmentTitle: 'ready-A.pdf', directAttachment: null }
  const states: Record<string, TaskRequestState> = {}
  const inFlight = new Set<string>()
  let rejectFirst!: (error: Error) => void
  const first = new Promise<Response>((_resolve, reject) => { rejectFirst = reject })
  const calls: Array<{ url: string; body: { content: string; linkUrl: string; attachmentResourceId: string } }> = []
  const authoritative = { id: 'submission-A', content: 'Version 1', linkUrl: 'https://example.test/v1', attachmentResourceId: 'ready-A', revisionCount: 1, status: 'SUBMITTED', submittedAt: '2030-01-01T00:00:00.000Z' }
  const request = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), body: JSON.parse(String(init?.body)) })
    return calls.length === 1 ? first : Response.json({ submission: authoritative }, { status: 201 })
  }) as typeof fetch
  let saved: typeof authoritative | null = null
  const submit = () => submitTaskDraft('space', 'A', draft, freshnessA, inFlight, state => { states.A = state }, submission => { saved = submission as typeof authoritative }, request)
  const pending = submit()
  assert.equal(states.A.busy, true)
  const rowA = { task: { id: 'A', title: 'Task A', description: null, acceptanceCriteria: null, assigneeId: 'learner', status: 'OPEN', dueAt: null }, submission: null }
  const props = { spaceId: 'space', row: rowA, draft, uploadState: { busy: false, error: null }, updateDraft: () => undefined, uploadAttachment: () => undefined, submitDraft: () => undefined, clearUploadError: () => undefined, clearSubmitError: () => undefined }
  const remountedA = renderToStaticMarkup(createElement(Form, { ...props, submitState: states.A }))
  assert.match(remountedA, /<textarea disabled=""/)
  assert.match(remountedA, /<input disabled=""[^>]*type="url"/)
  assert.match(remountedA, /<button[^>]*disabled=""[^>]*>Bỏ tệp \/ chọn tệp khác<\/button>/)
  assert.match(remountedA, /<button[^>]*disabled=""[^>]*>Dùng tệp đã tải lên trước đó<\/button>/)
  assert.match(remountedA, /<button type="submit" disabled=""/)
  const rowB = { ...rowA, task: { ...rowA.task, id: 'B' } }
  const taskB = renderToStaticMarkup(createElement(Form, { ...props, row: rowB, draft: { ...draft, content: 'B' }, submitState: { busy: false, error: null } }))
  assert.doesNotMatch(taskB, /<textarea disabled=""/)
  await submit()
  assert.equal(calls.length, 1)
  rejectFirst(new Error('G2 temporarily unavailable'))
  await pending
  assert.deepEqual(states.A, { busy: false, error: 'G2 temporarily unavailable' })
  assert.equal(draft.content, 'Version 1')
  assert.equal(draft.attachmentResourceId, 'ready-A')
  const unlocked = renderToStaticMarkup(createElement(Form, { ...props, submitState: states.A }))
  assert.doesNotMatch(unlocked, /<textarea disabled=""/)
  assert.match(unlocked, /G2 temporarily unavailable/)
  await submit()
  assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(call => call.body.attachmentResourceId), ['ready-A', 'ready-A'])
  assert.deepEqual(calls.map(call => call.body.content), ['Version 1', 'Version 1'])
  assert.deepEqual(saved, authoritative)
  assert.deepEqual(states.A, { busy: false, error: null })
})

test('D0d-F1 original upload can complete READY after selecting another task', async () => {
  const file = new File(['A'], 'original-A.pdf', { type: 'application/pdf' })
  let releaseProvider!: (response: Response) => void
  const provider = new Promise<Response>(resolve => { releaseProvider = resolve })
  const request = (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/files')) return Response.json({ resourceId: 'original-A', upload: { url: 'https://upload.example/original-A', fields: {}, expiresAt: '2099-01-01T00:00:00.000Z' } }, { status: 201 })
    if (url === 'https://upload.example/original-A') return provider
    if (url.endsWith('/finalize')) return Response.json({ resourceId: 'original-A', status: 'READY' })
    throw new Error('Unexpected request ' + url)
  }) as typeof fetch
  let draft: Draft = { content: 'Task A', linkUrl: '', attachmentResourceId: '', attachmentTitle: '', directAttachment: null }
  const states: Record<string, TaskRequestState> = {}
  const pending = uploadTaskAttachment('space', 'A', { file, reservation: null, phase: 'SELECTED' }, new Set<string>(), state => { states.A = state }, change => { draft = { ...draft, ...change } }, () => undefined, request)
  let selectedTaskId = 'B'
  assert.equal(states.A.busy, true)
  assert.equal(selectedTaskId, 'B')
  selectedTaskId = 'A'
  releaseProvider(new Response(null, { status: 204 }))
  await pending
  assert.equal(selectedTaskId, 'A')
  assert.deepEqual(states.A, { busy: false, error: null })
  assert.equal(draft.attachmentResourceId, 'original-A')
  assert.equal(draft.directAttachment, null)
})
