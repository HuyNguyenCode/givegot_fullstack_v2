import assert from 'node:assert/strict'
import test from 'node:test'
import { createLearningSubmissionService, submissionInput } from '../../../src/lib/learning-submission-service'

import { createLearningTaskService } from '../../../src/lib/learning-task-service'
import type { SubmissionFreshness } from '../../../src/lib/learning-submission-contract'

const requirements = { title: 'Task', description: 'Description', acceptanceCriteria: 'Criteria', dueAt: null, topicId: null }
const firstView: SubmissionFreshness = { requirements, previousSubmission: null }
const revisionView: SubmissionFreshness = { requirements, previousSubmission: { submissionId: 'submission', revisionCount: 1 } }
const now = new Date('2030-01-01T00:00:00.000Z')
function fixture() {
  let actor = 'learner'
  const task: Record<string, unknown> = { id: 'task', learningSpaceId: 'space', creatorId: 'mentor', assigneeId: 'learner', bookingId: null, status: 'OPEN', version: 1, ...requirements }
  let submission: Record<string, unknown> | null = null
  const events: Record<string, unknown>[] = []
  const members = new Map([['learner', true], ['mentor', true]])
  let spaceState = 'ACTIVE'
  let beforeSubmissionRead: (() => Promise<void>) | undefined
  let claims = 0
  const tx = {
    learningTask: {
      findFirst: async ({ where }: { where: { id: string; learningSpaceId: string } }) => task.id === where.id && task.learningSpaceId === where.learningSpaceId ? { ...task } : null,
      findUniqueOrThrow: async () => ({ ...task }),
      updateMany: async ({ where, data }: { where: { version: number; status: string }; data: Record<string, unknown> }) => {
        claims++
        if (task.version !== where.version || task.status !== where.status) return { count: 0 }
        Object.assign(task, data, { version: Number(task.version) + 1 }); return { count: 1 }
      },
    },
    learningSpace: { findUnique: async () => ({ state: spaceState }) },
    learningSpaceMember: { findMany: async () => [...members].filter(([, active]) => active).map(([userId]) => ({ userId, user: { isSuspended: false } })) },
    learningResource: { findFirst: async ({ where }: { where: { id: string; learningSpaceId: string; kind: string; status: string } }) => where.id === 'file' && where.learningSpaceId === 'space' && where.kind === 'FILE' && where.status === 'READY' ? { id: 'file' } : null },
    submission: {
      findUnique: async () => { await beforeSubmissionRead?.(); return submission ? { ...submission } : null },
      findUniqueOrThrow: async () => ({ ...submission }),
      create: async ({ data }: { data: Record<string, unknown> }) => { submission = { ...data, id: 'submission' }; return { ...submission } },
      updateMany: async ({ where, data }: { where: { status: string; revisionCount: number; authorId: string }; data: Record<string, unknown> }) => {
        if (!submission || submission.status !== where.status || submission.revisionCount !== where.revisionCount || submission.authorId !== where.authorId) return { count: 0 }
        submission = { ...submission, ...data, revisionCount: Number(submission.revisionCount) + 1 }; return { count: 1 }
      },
    },
    learningActivity: { create: async ({ data }: { data: Record<string, unknown> }) => { if (events.some(event => event.eventKey === data.eventKey)) throw new Error('duplicate'); events.push(data) } },
  }
  const db = {
    learningSpaceMember: { findUnique: async ({ where }: { where: { learningSpaceId_userId: { learningSpaceId: string; userId: string } } }) => where.learningSpaceId_userId.learningSpaceId === 'space' && members.get(where.learningSpaceId_userId.userId) ? { status: 'ACTIVE', learningSpace: { state: spaceState } } : null },
    learningTask: { findFirst: tx.learningTask.findFirst },
    submission: { findUnique: tx.submission.findUnique },
    $transaction: async <T>(fn: (arg: typeof tx) => Promise<T>) => fn(tx),
  }
  const deps = { db: db as never, actor: async () => ({ id: actor }), now: () => now }
  const service = createLearningSubmissionService(deps)
  const tasks = createLearningTaskService(deps)
  return { service, tasks, task, events, claims: () => claims, beforeSubmissionRead: (hook: () => Promise<void>) => { beforeSubmissionRead = hook }, members, setActor: (id: string) => { actor = id }, setSpace: (state: string) => { spaceState = state }, requestRevision: () => { task.status = 'REVISION_REQUESTED'; if (submission) submission.status = 'REVISION_REQUESTED' }, getSubmission: () => submission }
}

test('first submit records time, author, current row, task transition and one safe event', async () => {
  const f = fixture()
  const created = await f.service.submit('space', 'task', { freshness: firstView, content: '  My answer  ' })
  assert.equal(created.content, 'My answer')
  assert.equal(created.authorId, 'learner')
  assert.equal(created.submittedAt, now)
  assert.equal(created.revisionCount, 1)
  assert.equal(f.task.status, 'SUBMITTED')
  assert.equal(f.events.length, 1)
  assert.equal(f.events[0].eventKey, 'learning-submission:submission:revision:1')
  assert.equal(JSON.stringify(f.events).includes('My answer'), false)
  assert.equal((await f.service.current('space', 'task'))?.id, 'submission')
})

test('resubmit only after revision request, increments once and preserves audit events', async () => {
  const f = fixture()
  await f.service.submit('space', 'task', { freshness: firstView, content: 'One' })
  await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, content: 'Silent edit' }), { status: 409 })
  f.requestRevision()
  const revised = await f.service.submit('space', 'task', { freshness: revisionView, content: 'Two', linkUrl: 'https://example.com/path#private' })
  assert.equal(revised.id, 'submission')
  assert.equal(revised.revisionCount, 2)
  assert.equal(revised.linkUrl, 'https://example.com/path')
  assert.equal(f.task.status, 'SUBMITTED')
  assert.deepEqual(f.events.map(event => event.eventKey), ['learning-submission:submission:revision:1', 'learning-submission:submission:revision:2'])
  assert.equal(f.events[1].eventType, 'LEARNING_SUBMISSION_REVISED')
})

test('author is session assignee; spoofed author, creator and outsider cannot submit', async () => {
  const f = fixture()
  await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, content: 'X', authorId: 'mentor' }), { status: 400 })
  f.setActor('mentor')
  await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, content: 'X' }), { status: 403 })
  f.setActor('outsider')
  await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, content: 'X' }), { status: 403 })
  await assert.rejects(f.service.current('space', 'task'), { status: 403 })
})

test('wrong-space, nonready and nonfile attachment references are denied', async () => {
  const f = fixture()
  for (const id of ['other-space-file', 'pending-file', 'link-resource']) await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, attachmentResourceId: id }), { status: 400 })
  const result = await f.service.submit('space', 'task', { freshness: firstView, attachmentResourceId: 'file' })
  assert.equal(result.attachmentResourceId, 'file')
})

test('dangerous URL and empty submission are denied', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'data:text/plain,x']) assert.throws(() => submissionInput({ freshness: firstView, linkUrl: url }), { status: 400 })
  for (const input of [{}, { content: '  ', linkUrl: '' }, { attachmentResourceId: ' ' }]) assert.throws(() => submissionInput({ ...input, freshness: firstView }), { status: 400 })
})

test('closed task and archived space reject submission', async () => {
  for (const status of ['CANCELLED', 'COMPLETED', 'SUBMITTED']) {
    const f = fixture(); f.task.status = status
    await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, content: 'X' }), { status: 409 })
  }
  const f = fixture(); f.setSpace('ARCHIVED')
  await assert.rejects(f.service.submit('space', 'task', { freshness: firstView, content: 'X' }), { status: 409 })
})

test('concurrent first submit claims once, revisionCount and activity remain deduplicated', async () => {
  const f = fixture()
  const results = await Promise.allSettled([f.service.submit('space', 'task', { freshness: firstView, content: 'A' }), f.service.submit('space', 'task', { freshness: firstView, content: 'B' })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert.equal(f.getSubmission()?.revisionCount, 1)
  assert.equal(f.events.length, 1)
  f.requestRevision()
  const revised = await Promise.allSettled([f.service.submit('space', 'task', { freshness: revisionView, content: 'C' }), f.service.submit('space', 'task', { freshness: revisionView, content: 'D' })])
  assert.equal(revised.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.getSubmission()?.revisionCount, 2)
  assert.equal(f.events.length, 2)
})

for (const [field, value] of Object.entries({
  title: 'New title', description: null, acceptanceCriteria: 'New criteria',
  dueAt: new Date('2030-02-01T00:00:00Z'), topicId: 'new-topic',
})) {
  test(`changed ${field} returns a typed conflict before any write`, async () => {
    const f = fixture()
    f.task[field] = value
    const before = { ...f.task }
    await assert.rejects(f.service.submit('space', 'task', { content: 'Answer', freshness: firstView }), { status: 409, code: 'TASK_REQUIREMENTS_CHANGED' })
    assert.deepEqual(f.task, before)
    assert.equal(f.claims(), 0)
    assert.equal(f.getSubmission(), null)
    assert.deepEqual(f.events, [])
  })
}

test('effective requirements survive same-value edit, change and revert, and START', async () => {
  const f = fixture(); f.setActor('mentor')
  await f.tasks.update('space', 'task', { expectedVersion: 1, title: ' Task ' })
  await f.tasks.update('space', 'task', { expectedVersion: 2, title: 'Changed' })
  await f.tasks.update('space', 'task', { expectedVersion: 3, title: 'Task' })
  f.setActor('learner')
  await f.tasks.update('space', 'task', { expectedVersion: 4, action: 'START' })
  assert.equal(f.task.status, 'IN_PROGRESS')
  assert.equal((await f.service.submit('space', 'task', { content: 'Answer', freshness: firstView })).revisionCount, 1)
})

test('unchanged archived Topic ID, nullable fields, and equivalent timestamps match regardless of Booking', async () => {
  const f = fixture()
  Object.assign(f.task, { description: null, acceptanceCriteria: null, topicId: 'archived-topic', dueAt: new Date('2030-02-01T00:00:00Z'), bookingId: 'booking' })
  const freshness = { ...firstView, requirements: { ...requirements, description: null, acceptanceCriteria: null, topicId: 'archived-topic', dueAt: '2030-02-01T07:00:00+07:00' } }
  const result = await f.service.submit('space', 'task', { content: 'Answer', freshness })
  assert.equal(result.revisionCount, 1)
  assert.equal(f.events[0].bookingId, 'booking')
})

test('missing or malformed freshness is rejected without a Task claim', async () => {
  const f = fixture()
  for (const freshness of [
    undefined, null, [], {}, { requirements }, { ...firstView, requirements: { ...requirements, dueAt: '01/02/2030' } },
    { ...firstView, requirements: { ...requirements, dueAt: '2030-02-30T00:00:00Z' } },
    { ...firstView, requirements: { ...requirements, title: 1 } }, { ...firstView, requirements: { ...requirements, topicId: false } },
    { ...firstView, requirements: { ...requirements, bookingId: null } },
    { ...firstView, previousSubmission: {} }, { ...firstView, previousSubmission: { submissionId: '', revisionCount: 1 } },
    { ...firstView, previousSubmission: { submissionId: 'submission', revisionCount: 0 } },
  ]) await assert.rejects(f.service.submit('space', 'task', { content: 'Answer', freshness }), { status: 400 })
  assert.equal(f.claims(), 0)
})

test('first and revision windows reject stale identities before writes', async () => {
  const f = fixture()
  const answer = { content: 'Answer' }
  const stale = { status: 409, code: 'STALE_SUBMISSION_REVISION' }
  await assert.rejects(f.service.submit('space', 'task', { ...answer, freshness: revisionView }), stale)
  assert.equal(f.claims(), 0)
  await f.service.submit('space', 'task', { ...answer, freshness: firstView })
  f.requestRevision()
  const before = { task: { ...f.task }, submission: { ...f.getSubmission() }, events: [...f.events] }
  for (const freshness of [firstView, { requirements, previousSubmission: { submissionId: 'wrong', revisionCount: 1 } }]) {
    await assert.rejects(f.service.submit('space', 'task', { ...answer, freshness }), stale)
  }
  assert.deepEqual({ task: f.task, submission: f.getSubmission(), events: f.events }, before)
  assert.equal(f.claims(), 1)
  await f.service.submit('space', 'task', { ...answer, freshness: revisionView })
  f.requestRevision()
  await assert.rejects(f.service.submit('space', 'task', { ...answer, freshness: revisionView }), stale)
  assert.equal(f.getSubmission()?.revisionCount, 2)
  assert.equal(f.events.length, 2)
  assert.equal(f.claims(), 2)
})

test('G1 edit committed after G2 read defeats the conditional claim with a generic 409', async () => {
  const f = fixture()
  const readTask = Promise.withResolvers<void>()
  const continueSubmit = Promise.withResolvers<void>()
  f.beforeSubmissionRead(() => { readTask.resolve(); return continueSubmit.promise })
  const result = assert.rejects(f.service.submit('space', 'task', { content: 'Answer', freshness: firstView }), { status: 409, message: 'Task changed; refresh and try again' })
  await readTask.promise
  try {
    f.setActor('mentor')
    await f.tasks.update('space', 'task', { expectedVersion: 1, title: 'Concurrent change' })
  } finally { continueSubmit.resolve() }
  await result
  assert.equal(f.claims(), 2)
  assert.equal(f.task.title, 'Concurrent change')
  assert.equal(f.task.status, 'OPEN')
  assert.equal(f.getSubmission(), null)
  assert.deepEqual(f.events, [])
})

test('G1 edit committed before G2 read returns a typed requirements conflict', async () => {
  const f = fixture(); f.setActor('mentor')
  await f.tasks.update('space', 'task', { expectedVersion: 1, title: 'Concurrent change' })
  f.setActor('learner')
  await assert.rejects(f.service.submit('space', 'task', { content: 'Answer', freshness: firstView }), { status: 409, code: 'TASK_REQUIREMENTS_CHANGED' })
  assert.equal(f.claims(), 1)
  assert.equal(f.task.status, 'OPEN')
  assert.equal(f.getSubmission(), null)
  assert.deepEqual(f.events, [])
})

test('G2 winning before the competing G1 edit leaves the submitted work intact', async () => {
  const f = fixture()
  await f.service.submit('space', 'task', { content: 'Answer', freshness: firstView })
  f.setActor('mentor')
  await assert.rejects(f.tasks.update('space', 'task', { expectedVersion: 1, title: 'Concurrent change' }), { status: 409 })
  await assert.rejects(f.tasks.update('space', 'task', { expectedVersion: 2, title: 'Concurrent change' }), { status: 403 })
  assert.equal(f.task.title, requirements.title)
  assert.equal(f.getSubmission()?.content, 'Answer')
  assert.equal(f.events.length, 1)
})

