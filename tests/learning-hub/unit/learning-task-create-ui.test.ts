import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { BookingContext, counterpart, createTaskPayload, CreateTask } from '../../../src/components/learning/LearningTaskCreate'
import { filterLearningTasks, paginateLearningTasks } from '../../../src/components/learning/LearningSubmissions'

const members = [{ id: 'a', name: 'An', email: null }, { id: 'b', name: 'Bình', email: null }]
const booking = { id: 'booking', startTime: new Date('2030-01-01T00:00:00Z'), endTime: new Date('2030-01-01T01:00:00Z'), status: 'CONFIRMED', mentorId: 'a', menteeId: 'b' }
const draft = { title: ' Bài tập ', acceptanceCriteria: ' Hoàn thành ', description: '', topicId: '', bookingId: '', dueAt: '' }
test('both members derive only the other active participant; ambiguous pairs cannot create', () => {
  assert.equal(counterpart(members, 'a')?.id, 'b'); assert.equal(counterpart(members, 'b')?.id, 'a')
  assert.equal(counterpart([members[0]], 'a'), null); assert.equal(counterpart([...members, members[1]], 'a'), null)
  for (const viewerId of ['a', 'b']) assert.match(renderToStaticMarkup(createElement(CreateTask, { spaceId: 's', viewerId, members, topics: [], bookings: [booking], onCreated() {} })), /Tạo công việc/)
})
test('payload validates required fields and optional future instant without actor identity', () => {
  assert.deepEqual(createTaskPayload(draft, 'b'), { assigneeId: 'b', title: 'Bài tập', acceptanceCriteria: 'Hoàn thành' })
  const full = createTaskPayload({ ...draft, description: 'mô tả', topicId: 't', bookingId: 'booking', dueAt: '2030-01-02T12:00' }, 'b', 0)
  assert.equal(full.topicId, 't'); assert.equal(full.bookingId, 'booking'); assert.match(full.dueAt!, /T\d\d:\d\d:\d\d\.\d{3}Z$/)
  assert.equal('creatorId' in full, false); assert.equal('actorId' in full, false)
  assert.throws(() => createTaskPayload({ ...draft, title: ' ' }, 'b')); assert.throws(() => createTaskPayload({ ...draft, acceptanceCriteria: ' ' }, 'b'))
  assert.throws(() => createTaskPayload({ ...draft, title: 'x'.repeat(256) }, 'b')); assert.throws(() => createTaskPayload({ ...draft, description: 'x'.repeat(10001) }, 'b'))
  assert.throws(() => createTaskPayload({ ...draft, dueAt: '2020-01-01T00:00' }, 'b', Date.now()))
})
test('ownership filters precede eight-item pagination and retain completed tasks', () => {
  const rows = Array.from({ length: 20 }, (_, i) => ({ task: { id: String(i), title: 'T', description: null, acceptanceCriteria: 'ok', assigneeId: i % 2 ? 'a' : 'b', creatorId: i % 2 ? 'b' : 'a', status: 'COMPLETED', dueAt: null }, submission: null }))
  assert.equal(filterLearningTasks(rows, 'a', 'all').length, 20)
  const assigned = filterLearningTasks(rows, 'a', 'assigned'); const created = filterLearningTasks(rows, 'a', 'created')
  assert.equal(assigned.length, 10); assert.equal(created.length, 10); assert.deepEqual(paginateLearningTasks(assigned, 2).rows.map(row => row.task.id), ['17', '19'])
})
test('Booking direction and frozen status are explained without blocking', () => {
  const html = renderToStaticMarkup(createElement(BookingContext, { booking: { ...booking, status: 'MISSED' }, members, creatorId: 'b', assigneeId: 'a' }))
  assert.match(html, /Mentor: An/); assert.match(html, /Mentee: Bình/); assert.match(html, /có thể không được tính/); assert.match(html, /chặn đánh giá/)
  assert.doesNotMatch(renderToStaticMarkup(createElement(BookingContext, { booking, members, creatorId: 'a', assigneeId: 'b' })), /đảo với/)
})
test('creation guards duplicates, preserves errors, inserts success and keeps submission state in parent', () => {
  const form = readFileSync('src/components/learning/LearningTaskCreate.tsx', 'utf8')
  const parent = readFileSync('src/components/learning/LearningSubmissions.tsx', 'utf8')
  assert.match(form, /if \(pending\.current \|\| !peer\) return/); assert.match(form, /catch \(cause\) \{ setError/)
  assert.match(parent, /setRows\(previous => \[\{ task, submission: null \}/); assert.match(parent, /setFilter\('created'\)/)
  assert.match(parent, /filterLearningTasks\(rows, viewerId, filter\)/); assert.match(parent, /paginateLearningTasks\(filteredRows, taskPage\)/)
  assert.match(parent, /!archived && !loading && !error && <CreateTask/); assert.match(parent, /const \[drafts, setDrafts\]/)
})
