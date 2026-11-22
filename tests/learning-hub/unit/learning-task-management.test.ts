import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { editTaskPayload, patchTask, taskEditDraft, taskPermissions, TaskConflict, TaskManagement, TaskTopicSelector } from '../../../src/components/learning/LearningTaskManagement'
import type { Task } from '../../../src/components/learning/LearningSubmissions'
const task: Task = { id: 't', version: 3, title: 'Bài tập', description: null, acceptanceCriteria: 'Đạt', assigneeId: 'b', creatorId: 'a', status: 'OPEN', dueAt: null }
const props = { task, viewerId: 'a', archived: false, spaceId: 's', topics: [], onUpdated() {}, onRefresh: async () => task }
test('creator controls respect task state and archived space', () => {
  assert.deepEqual(taskPermissions(task, 'a', false), { edit: true, cancel: true })
  assert.deepEqual(taskPermissions({ ...task, status: 'IN_PROGRESS' }, 'a', false), { edit: false, cancel: true })
  for (const status of ['SUBMITTED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED']) assert.deepEqual(taskPermissions({ ...task, status }, 'a', false), { edit: false, cancel: false })
  for (const [viewer, archived] of [['b', false], ['a', true]] as const) assert.deepEqual(taskPermissions(task, viewer, archived), { edit: false, cancel: false })
  const html = renderToStaticMarkup(createElement(TaskManagement, props)); assert.match(html, /Chỉnh sửa công việc/); assert.match(html, /Hủy công việc/); assert.doesNotMatch(html, /Xác nhận hủy công việc/)
})
test('edit payload validates fields, preserves untouched deadline and converts changed deadlines', () => {
  const draft = { title: ' title ', description: '', acceptanceCriteria: ' done ', dueAt: '', dueChanged: false }
  assert.deepEqual(editTaskPayload(draft, 3), { expectedVersion: 3, title: 'title', description: null, acceptanceCriteria: 'done' })
  assert.equal(editTaskPayload({ ...draft, dueChanged: true }, 3).dueAt, null)
  assert.match(editTaskPayload({ ...draft, dueChanged: true, dueAt: '2035-01-01T10:00' }, 3, 0).dueAt!, /T\d\d:\d\d:\d\d\.\d{3}Z/)
  assert.throws(() => editTaskPayload({ ...draft, title: ' ' }, 3)); assert.throws(() => editTaskPayload({ ...draft, acceptanceCriteria: 'x'.repeat(10001) }, 3)); assert.throws(() => editTaskPayload({ ...draft, dueChanged: true, dueAt: '2020-01-01T00:00' }, 3, Date.now()))
})
test('PATCH transmits version and cancel action, returns server row and distinguishes conflicts', async () => {
  let sent: RequestInit | undefined
  const request = (async (_url: string | URL | Request, init?: RequestInit) => { sent = init; return new Response(JSON.stringify({ ...task, version: 4, status: 'CANCELLED' }), { status: 200 }) }) as typeof fetch
  const updated = await patchTask('s', 't', { expectedVersion: 3, action: 'CANCEL' }, request)
  assert.deepEqual(JSON.parse(String(sent?.body)), { expectedVersion: 3, action: 'CANCEL' }); assert.equal(updated.version, 4); assert.equal(updated.status, 'CANCELLED')
  await assert.rejects(patchTask('s', 't', {}, (async () => new Response('', { status: 409 })) as typeof fetch), TaskConflict)
  await assert.rejects(patchTask('s', 't', {}, (async () => { throw new Error('offline') }) as typeof fetch), /kiểm tra mạng/)
})


test('topic changes send only an active choice or explicit null, preserving unchanged archived association', () => {
  const topics = [{ id: 'active', label: 'Âm nhạc', state: 'ACTIVE' as const }, { id: 'old', label: 'Cũ', state: 'ARCHIVED' as const }]
  const draft = { title: 'T', description: '', acceptanceCriteria: 'Đạt', dueAt: '', dueChanged: false, originalTopicId: 'old', topicId: 'old' }
  assert.equal('topicId' in editTaskPayload(draft, 3, 0, topics), false)
  assert.equal(editTaskPayload({ ...draft, topicId: 'active' }, 3, 0, topics).topicId, 'active')
  assert.equal(editTaskPayload({ ...draft, topicId: null }, 3, 0, topics).topicId, null)
  assert.throws(() => editTaskPayload({ ...draft, topicId: 'foreign' }, 3, 0, topics), /không còn khả dụng/)
  assert.throws(() => editTaskPayload({ ...draft, originalTopicId: null }, 3, 0, topics), /không còn khả dụng/)
})

test('topic selector preselects current topic and excludes archived alternatives', () => {
  const topics = [{ id: 'active', label: 'Âm nhạc', state: 'ACTIVE' as const }, { id: 'old', label: 'Cũ', state: 'ARCHIVED' as const }, { id: 'other', label: 'Khác', state: 'ARCHIVED' as const }]
  const render = (value: string | null) => renderToStaticMarkup(createElement(TaskTopicSelector, { value, topics, onChange() {} }))
  assert.match(render('active'), /value="active" selected=""/)
  assert.match(render('old'), /value="old" disabled="" selected=""/)
  assert.doesNotMatch(render('old'), /value="other"/)
  assert.match(render('missing'), /Chủ đề không khả dụng/)
  assert.match(render(null), /Không gắn chủ đề/)
})

test('refreshed task replaces every edit field and establishes the next PATCH baseline', () => {
  const latest: Task = { ...task, version: 5, title: 'Mới', description: 'Mô tả mới', acceptanceCriteria: 'Tiêu chí mới', dueAt: '2035-01-01T10:00:00.000Z', topicId: 'topic-a' }
  const draft = taskEditDraft(latest)
  assert.equal(draft.title, latest.title)
  assert.equal(draft.description, latest.description)
  assert.equal(draft.acceptanceCriteria, latest.acceptanceCriteria)
  assert.equal(new Date(draft.dueAt).getTime(), new Date(latest.dueAt!).getTime())
  assert.equal(draft.dueChanged, false)
  assert.equal(draft.topicId, 'topic-a')
  assert.equal(draft.originalTopicId, 'topic-a')
  const payload = editTaskPayload(draft, latest.version!)
  assert.equal(payload.expectedVersion, 5)
  assert.equal('topicId' in payload, false)
  assert.equal('dueAt' in payload, false)
  assert.equal(taskPermissions({ ...latest, status: 'SUBMITTED' }, 'a', false).edit, false)
})
