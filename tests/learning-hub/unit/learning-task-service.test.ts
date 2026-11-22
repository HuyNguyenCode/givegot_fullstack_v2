import assert from 'node:assert/strict'
import test from 'node:test'
import { createLearningTaskService, taskDueAt, taskTransition } from '../../../src/lib/learning-task-service'

const now = new Date('2030-01-01T00:00:00.000Z')

test('dueAt is an independent future instant with strict boundary and timezone', () => {
  assert.equal(taskDueAt(null, now), null)
  assert.equal(taskDueAt('2030-01-01T07:00:01+07:00', now)?.toISOString(), '2030-01-01T00:00:01.000Z')
  for (const invalid of ['2030-01-01T00:00:00.000Z', '2029-12-31T23:59:59Z', '2030-01-02', 'bad']) assert.throws(() => taskDueAt(invalid, now), { status: 400 })
})

test('only task roles can move G1 states; terminal and submission states are protected', () => {
  assert.equal(taskTransition('OPEN', 'START', 'learner', 'mentor', 'learner'), 'IN_PROGRESS')
  assert.equal(taskTransition('OPEN', 'CANCEL', 'mentor', 'mentor', 'learner'), 'CANCELLED')
  for (const status of ['SUBMITTED', 'REVISION_REQUESTED', 'COMPLETED']) assert.throws(() => taskTransition('OPEN', status, 'mentor', 'mentor', 'learner'), { status: 409 })
  assert.throws(() => taskTransition('OPEN', 'CANCEL', 'learner', 'mentor', 'learner'), { status: 409 })
})

function fixture() {
  const members = new Map([['mentor', { active: true, suspended: false }], ['learner', { active: true, suspended: false }]])
  const spaces = new Map([['space', 'ACTIVE'], ['other', 'ACTIVE']])
  const tasks = new Map<string, Record<string, unknown>>()
  const topics = new Map([['topic', { learningSpaceId: 'space', state: 'ACTIVE' }], ['new', { learningSpaceId: 'space', state: 'ACTIVE' }], ['inactive', { learningSpaceId: 'space', state: 'ARCHIVED' }], ['foreign', { learningSpaceId: 'other', state: 'ACTIVE' }]])
  const booking = { id: 'booking', learningSpaceId: 'space', mentorId: 'mentor', menteeId: 'learner', startTime: new Date('2020-01-01'), endTime: new Date('2020-01-02') }
  let actor = 'mentor'
  let sequence = 0
  const tx = {
    learningActivity: { upsert: async () => ({}) },
    learningSpace: { findUnique: async ({ where }: { where: { id: string } }) => spaces.has(where.id) ? { state: spaces.get(where.id) } : null },
    learningSpaceMember: { findMany: async ({ where }: { where: { learningSpaceId: string; userId: { in: string[] } } }) => where.userId.in.filter(id => members.get(id as 'mentor' | 'learner')?.active).map(userId => ({ userId, user: { isSuspended: members.get(userId as 'mentor' | 'learner')?.suspended } })) },
    booking: { findFirst: async ({ where }: { where: { id: string; learningSpaceId: string } }) => booking.id === where.id && booking.learningSpaceId === where.learningSpaceId ? booking : null },
    learningTopic: { findFirst: async ({ where }: { where: { id: string; learningSpaceId: string; state: string } }) => { const topic = topics.get(where.id); return topic?.learningSpaceId === where.learningSpaceId && topic.state === where.state ? { id: where.id } : null } },
    learningTask: {
      create: async ({ data }: { data: Record<string, unknown> }) => { const row = { ...data, id: `task-${++sequence}`, version: 1, createdAt: now, updatedAt: now }; tasks.set(row.id, row); return row },
      findFirst: async ({ where }: { where: { id: string; learningSpaceId: string } }) => { const row = tasks.get(where.id); return row?.learningSpaceId === where.learningSpaceId ? { ...row } : null },
      updateMany: async ({ where, data }: { where: { id: string; learningSpaceId: string; version: number; status: string }; data: Record<string, unknown> }) => { const row = tasks.get(where.id); if (!row || row.learningSpaceId !== where.learningSpaceId || row.version !== where.version || row.status !== where.status) return { count: 0 }; Object.assign(row, data, { version: Number(row.version) + 1 }); return { count: 1 } },
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => tasks.get(where.id),
    },
  }
  const db = {
    learningSpaceMember: { findUnique: async ({ where }: { where: { learningSpaceId_userId: { learningSpaceId: string; userId: string } } }) => { const { learningSpaceId, userId } = where.learningSpaceId_userId; return members.get(userId as 'mentor' | 'learner')?.active && spaces.has(learningSpaceId) ? { status: 'ACTIVE', learningSpace: { state: spaces.get(learningSpaceId) } } : null } },
    learningTask: { findMany: async ({ where }: { where: { learningSpaceId: string } }) => [...tasks.values()].filter(row => row.learningSpaceId === where.learningSpaceId) },
    $transaction: async <T>(fn: (arg: typeof tx) => Promise<T>) => fn(tx),
  }
  const service = createLearningTaskService({ db: db as never, actor: async () => ({ id: actor }), now: () => now })
  const input = { assigneeId: 'learner', title: 'Practice', description: 'Solve problems', acceptanceCriteria: 'Show working', dueAt: '2030-01-02T00:00:00Z', bookingId: 'booking', topicId: 'topic' }
  return { service, input, tasks, members, spaces, topics, setActor: (id: string) => { actor = id }, booking }
}

test('unchanged archived topic is retained while new topics must be active in the space', async () => {
  const f = fixture()
  const created = await f.service.create('space', f.input)
  f.topics.set('topic', { learningSpaceId: 'space', state: 'ARCHIVED' })
  const edited = await f.service.update('space', created.id, { expectedVersion: 1, title: 'Changed' })
  assert.equal(edited.topicId, 'topic')
  const same = await f.service.update('space', created.id, { expectedVersion: 2, topicId: 'topic' })
  assert.equal(same.topicId, 'topic')
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 3, topicId: 'inactive' }), { status: 400, message: 'Topic must be active in this learning space' })
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 3, topicId: 'foreign' }), { status: 400, message: 'Topic must be active in this learning space' })
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 3, topicId: 123 }), { status: 400 })
  const changed = await f.service.update('space', created.id, { expectedVersion: 3, topicId: 'new' })
  assert.equal(changed.topicId, 'new')
  const cleared = await f.service.update('space', created.id, { expectedVersion: 4, topicId: null })
  assert.equal(cleared.topicId, null)
})

test('archived topic does not bypass creator, status, version, or booking checks', async () => {
  const f = fixture()
  const created = await f.service.create('space', f.input)
  f.topics.set('topic', { learningSpaceId: 'space', state: 'ARCHIVED' })
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 2, title: 'stale' }), { status: 409 })
  f.setActor('learner')
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 1, title: 'not creator' }), { status: 403 })
  await f.service.update('space', created.id, { expectedVersion: 1, action: 'START' })
  f.setActor('mentor')
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 2, title: 'not open' }), { status: 403 })
  const another = await f.service.create('space', { ...f.input, topicId: null })
  await assert.rejects(f.service.update('space', another.id, { expectedVersion: 1, bookingId: 'foreign' }), { status: 400, message: 'Booking does not belong to this learning space' })
})

test('create and edit open task, assign peer, and preserve independent Booking timestamps', async () => {
  const f = fixture()
  const created = await f.service.create('space', f.input)
  assert.equal(created.creatorId, 'mentor')
  assert.equal(created.assigneeId, 'learner')
  assert.equal(created.status, 'OPEN')
  assert.equal(created.dueAt?.toISOString(), '2030-01-02T00:00:00.000Z')
  const edited = await f.service.update('space', created.id, { expectedVersion: 1, title: 'Revised', dueAt: null })
  assert.equal(edited.version, 2)
  assert.equal(edited.title, 'Revised')
  assert.equal(edited.dueAt, null)
  assert.equal(f.booking.endTime.toISOString(), '2020-01-02T00:00:00.000Z')
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 1, title: 'Stale' }), { status: 409 })
  f.setActor('learner')
  const started = await f.service.update('space', created.id, { expectedVersion: 2, action: 'START' })
  assert.equal(started.status, 'IN_PROGRESS')
  await assert.rejects(f.service.update('space', created.id, { expectedVersion: 3, status: 'COMPLETED' }), { status: 400 })
})

test('reject invalid assignee, nonmember, archived space, foreign topic and booking', async () => {
  const f = fixture()
  await assert.rejects(f.service.create('space', { ...f.input, assigneeId: 'outsider' }), { status: 400 })
  await assert.rejects(f.service.create('space', { ...f.input, assigneeId: 'mentor' }), { status: 400 })
  await assert.rejects(f.service.create('space', { ...f.input, topicId: 'foreign' }), { status: 400 })
  await assert.rejects(f.service.create('space', { ...f.input, bookingId: 'foreign' }), { status: 400 })
  f.setActor('outsider')
  await assert.rejects(f.service.list('space'), { status: 403 })
  f.setActor('mentor')
  f.spaces.set('space', 'ARCHIVED')
  await assert.rejects(f.service.create('space', f.input), { status: 409 })
  assert.deepEqual(await f.service.list('space'), [])
})

test('conditional update rejects a concurrent version claim', async () => {
  const f = fixture()
  const created = await f.service.create('space', f.input)
  const results = await Promise.allSettled([
    f.service.update('space', created.id, { expectedVersion: 1, title: 'A' }),
    f.service.update('space', created.id, { expectedVersion: 1, title: 'B' }),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(results.filter(result => result.status === 'rejected').length, 1)
})
