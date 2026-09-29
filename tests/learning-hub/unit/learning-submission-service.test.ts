import assert from 'node:assert/strict'
import test from 'node:test'
import { createLearningSubmissionService, submissionInput } from '../../../src/lib/learning-submission-service'

const now = new Date('2030-01-01T00:00:00.000Z')
function fixture() {
  let actor = 'learner'
  const task: Record<string, unknown> = { id: 'task', learningSpaceId: 'space', creatorId: 'mentor', assigneeId: 'learner', bookingId: null, status: 'OPEN', version: 1 }
  let submission: Record<string, unknown> | null = null
  const events: Record<string, unknown>[] = []
  const members = new Map([['learner', true], ['mentor', true]])
  let spaceState = 'ACTIVE'
  const tx = {
    learningTask: {
      findFirst: async ({ where }: { where: { id: string; learningSpaceId: string } }) => task.id === where.id && task.learningSpaceId === where.learningSpaceId ? { ...task } : null,
      updateMany: async ({ where, data }: { where: { version: number; status: string }; data: { status: string } }) => {
        if (task.version !== where.version || task.status !== where.status) return { count: 0 }
        task.version = Number(task.version) + 1; task.status = data.status; return { count: 1 }
      },
    },
    learningSpace: { findUnique: async () => ({ state: spaceState }) },
    learningSpaceMember: { findMany: async () => [...members].filter(([, active]) => active).map(([userId]) => ({ userId, user: { isSuspended: false } })) },
    learningResource: { findFirst: async ({ where }: { where: { id: string; learningSpaceId: string; kind: string; status: string } }) => where.id === 'file' && where.learningSpaceId === 'space' && where.kind === 'FILE' && where.status === 'READY' ? { id: 'file' } : null },
    submission: {
      findUnique: async () => submission ? { ...submission } : null,
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
  const service = createLearningSubmissionService({ db: db as never, actor: async () => ({ id: actor }), now: () => now })
  return { service, task, events, members, setActor: (id: string) => { actor = id }, setSpace: (state: string) => { spaceState = state }, requestRevision: () => { task.status = 'REVISION_REQUESTED'; if (submission) submission.status = 'REVISION_REQUESTED' }, getSubmission: () => submission }
}

test('first submit records time, author, current row, task transition and one safe event', async () => {
  const f = fixture()
  const created = await f.service.submit('space', 'task', { content: '  My answer  ' })
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
  await f.service.submit('space', 'task', { content: 'One' })
  await assert.rejects(f.service.submit('space', 'task', { content: 'Silent edit' }), { status: 409 })
  f.requestRevision()
  const revised = await f.service.submit('space', 'task', { content: 'Two', linkUrl: 'https://example.com/path#private' })
  assert.equal(revised.id, 'submission')
  assert.equal(revised.revisionCount, 2)
  assert.equal(revised.linkUrl, 'https://example.com/path')
  assert.equal(f.task.status, 'SUBMITTED')
  assert.deepEqual(f.events.map(event => event.eventKey), ['learning-submission:submission:revision:1', 'learning-submission:submission:revision:2'])
  assert.equal(f.events[1].eventType, 'LEARNING_SUBMISSION_REVISED')
})

test('author is session assignee; spoofed author, creator and outsider cannot submit', async () => {
  const f = fixture()
  await assert.rejects(f.service.submit('space', 'task', { content: 'X', authorId: 'mentor' }), { status: 400 })
  f.setActor('mentor')
  await assert.rejects(f.service.submit('space', 'task', { content: 'X' }), { status: 403 })
  f.setActor('outsider')
  await assert.rejects(f.service.submit('space', 'task', { content: 'X' }), { status: 403 })
  await assert.rejects(f.service.current('space', 'task'), { status: 403 })
})

test('wrong-space, nonready and nonfile attachment references are denied', async () => {
  const f = fixture()
  for (const id of ['other-space-file', 'pending-file', 'link-resource']) await assert.rejects(f.service.submit('space', 'task', { attachmentResourceId: id }), { status: 400 })
  const result = await f.service.submit('space', 'task', { attachmentResourceId: 'file' })
  assert.equal(result.attachmentResourceId, 'file')
})

test('dangerous URL and empty submission are denied', () => {
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'data:text/plain,x']) assert.throws(() => submissionInput({ linkUrl: url }), { status: 400 })
  for (const input of [{}, { content: '  ', linkUrl: '' }, { attachmentResourceId: ' ' }]) assert.throws(() => submissionInput(input), { status: 400 })
})

test('closed task and archived space reject submission', async () => {
  for (const status of ['CANCELLED', 'COMPLETED', 'SUBMITTED']) {
    const f = fixture(); f.task.status = status
    await assert.rejects(f.service.submit('space', 'task', { content: 'X' }), { status: 409 })
  }
  const f = fixture(); f.setSpace('ARCHIVED')
  await assert.rejects(f.service.submit('space', 'task', { content: 'X' }), { status: 409 })
})

test('concurrent first submit claims once, revisionCount and activity remain deduplicated', async () => {
  const f = fixture()
  const results = await Promise.allSettled([f.service.submit('space', 'task', { content: 'A' }), f.service.submit('space', 'task', { content: 'B' })])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
  assert.equal(f.getSubmission()?.revisionCount, 1)
  assert.equal(f.events.length, 1)
  f.requestRevision()
  const revised = await Promise.allSettled([f.service.submit('space', 'task', { content: 'C' }), f.service.submit('space', 'task', { content: 'D' })])
  assert.equal(revised.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.getSubmission()?.revisionCount, 2)
  assert.equal(f.events.length, 2)
})

