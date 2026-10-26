import assert from 'node:assert/strict'
import test from 'node:test'
import type { PrismaClient } from '@prisma/client'
import { createLearningFulfillmentService, fulfillmentInput, mirrorTerminalFulfillment } from '../../../src/lib/learning-fulfillment-service'

const at = new Date('2030-05-02T12:00:00Z')
type Row = {
  id: string; learningSpaceId: string | null; learningMode: 'LIVE' | 'EXERCISE_REVIEW' | 'HYBRID' | null
  mentorId: string; menteeId: string; status: string; fulfillmentStatus: string | null; fulfillmentVersion: number | null
  objective: string | null; startTime: Date; endTime: Date; meetingUrl: string | null
  deliveredAt: Date | null; acceptedAt: Date | null
}

function fixture(mode: Row['learningMode'] = 'LIVE') {
  const row: Row = {
    id: 'booking', learningSpaceId: 'space', learningMode: mode, mentorId: 'mentor', menteeId: 'mentee',
    status: 'CONFIRMED', fulfillmentStatus: null, fulfillmentVersion: null, objective: 'Learn',
    startTime: new Date('2030-05-01T09:00:00Z'), endTime: new Date('2030-05-01T10:00:00Z'),
    meetingUrl: 'https://meet.google.com/test', deliveredAt: null, acceptedAt: null,
  }
  let actorId = 'mentor'
  let spaceState = 'ACTIVE'
  let recap = true
  let feedback = true
  let submittedAt = new Date('2030-05-01T08:00:00Z')
  let reviewedAt = new Date('2030-05-01T11:00:00Z')
  const suspended = new Set<string>()
  const events: Array<{ eventKey: string; eventType: string; metadata: unknown }> = []
  let claims = 0
  const tx = {
    learningSpaceMember: { findUnique: async ({ where }: { where: { learningSpaceId_userId: { learningSpaceId: string; userId: string } } }) => {
      const { learningSpaceId, userId } = where.learningSpaceId_userId
      return learningSpaceId === 'space' && ['mentor', 'mentee'].includes(userId)
        ? { status: 'ACTIVE', user: { isSuspended: suspended.has(userId) }, learningSpace: { state: spaceState } } : null
    } },
    booking: {
      findFirst: async ({ where }: { where: { id: string; learningSpaceId: string } }) => where.id === row.id && where.learningSpaceId === row.learningSpaceId ? { ...row } : null,
      findUnique: async ({ where }: { where: { id: string } }) => where.id === row.id ? { ...row } : null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Row> }) => {
        claims++
        if (Object.entries(where).some(([key, value]) => row[key as keyof Row] !== value)) return { count: 0 }
        Object.assign(row, data)
        return { count: 1 }
      },
    },
    learningNote: { count: async ({ where }: { where: Record<string, unknown> }) => {
      assert.equal(where.bookingId, 'booking'); assert.equal(where.authorId, 'mentor')
      assert.equal(where.deletedAt, null); assert.equal(where.type, 'RECAP')
      return recap ? 1 : 0
    } },
    learningTask: { findMany: async ({ where }: { where: Record<string, unknown> }) => {
      assert.equal(where.learningSpaceId, 'space'); assert.equal(where.bookingId, 'booking')
      assert.equal(where.creatorId, 'mentor'); assert.equal(where.assigneeId, 'mentee')
      assert.equal(where.status, 'COMPLETED')
      return feedback ? [{ submission: { authorId: 'mentee', status: 'REVIEWED', submittedAt, review: { outcome: 'REVIEWED', reviewedAt } } }] : []
    } },
    learningActivity: { upsert: async ({ where, create }: { where: { eventKey: string }; create: { eventKey: string; eventType: string; metadata: unknown } }) => {
      if (!events.some(event => event.eventKey === where.eventKey)) events.push({ eventKey: create.eventKey, eventType: create.eventType, metadata: create.metadata })
    } },
  }
  const db = { ...tx, $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient
  const service = createLearningFulfillmentService({ db, actor: async () => ({ id: actorId, email: null, name: null }), now: () => at })
  return { row, events, service, tx, actor: (id: string) => { actorId = id }, archive: () => { spaceState = 'ARCHIVED' }, suspend: (id: string) => suspended.add(id), recap: (value: boolean) => { recap = value }, feedback: (value: boolean) => { feedback = value }, submittedAt: (value: Date) => { submittedAt = value }, reviewedAt: (value: Date) => { reviewedAt = value }, claims: () => claims }
}

test('all normal edges, revision loop, old null fulfillment row, and versioned audit', async () => {
  const f = fixture()
  assert.deepEqual(await f.service.read('space', 'booking'), { bookingId: 'booking', status: 'NOT_STARTED', version: 0, deliveredAt: null, acceptedAt: null })
  for (const [action, version, status, who] of [
    ['START', 0, 'IN_PROGRESS', 'mentee'], ['DELIVER', 1, 'DELIVERED', 'mentor'],
    ['REQUEST_REVISION', 2, 'REVISION_REQUESTED', 'mentee'], ['RESUME', 3, 'IN_PROGRESS', 'mentor'],
    ['DELIVER', 4, 'DELIVERED', 'mentor'], ['ACCEPT', 5, 'ACCEPTED', 'mentee'],
  ] as const) {
    f.actor(who)
    const result = await f.service.transition('space', 'booking', { action, expectedVersion: version })
    assert.equal(result.status, status)
    assert.equal(result.version, version + 1)
  }
  assert.equal(f.row.fulfillmentStatus, 'ACCEPTED')
  assert.equal(f.row.acceptedAt?.toISOString(), at.toISOString())
  assert.deepEqual(f.events.map(event => event.eventKey), Array.from({ length: 6 }, (_, index) => `learning-fulfillment:booking:version:${index + 1}`))
  assert.ok(f.events.every(event => event.eventType === 'LEARNING_FULFILLMENT_CHANGED'))
  assert.doesNotMatch(JSON.stringify(f.events), /https:\/\/|"Learn"|feedback|note content/i)
})

test('forbidden edges, wrong roles, spoofed state, retry, stale version, and terminal states', async () => {
  const f = fixture()
  for (const action of ['DELIVER', 'ACCEPT', 'REQUEST_REVISION', 'RESUME']) await assert.rejects(f.service.transition('space', 'booking', { action, expectedVersion: 0 }), { status: 409 })
  await assert.rejects(f.service.transition('space', 'booking', { action: 'SETTLED', expectedVersion: 0 }), { status: 400 })
  await assert.rejects(f.service.transition('space', 'booking', { action: 'START', expectedVersion: 0, fulfillmentStatus: 'ACCEPTED' }), { status: 400 })
  await f.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 })
  await assert.rejects(f.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 }), { status: 409 })
  f.actor('mentee')
  await assert.rejects(f.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 403 })
  f.actor('mentor')
  await f.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 })
  await assert.rejects(f.service.transition('space', 'booking', { action: 'ACCEPT', expectedVersion: 2 }), { status: 403 })
  f.actor('mentee')
  await f.service.transition('space', 'booking', { action: 'ACCEPT', expectedVersion: 2 })
  for (const action of ['START', 'DELIVER', 'ACCEPT', 'REQUEST_REVISION', 'RESUME']) await assert.rejects(f.service.transition('space', 'booking', { action, expectedVersion: 3 }), { status: 409 })
  assert.equal(f.events.length, 3)
})

test('every state rejects actions outside its transition matrix', async () => {
  const permitted: Record<string, string[]> = {
    NOT_STARTED: ['START'], IN_PROGRESS: ['DELIVER'], DELIVERED: ['ACCEPT', 'REQUEST_REVISION'],
    REVISION_REQUESTED: ['RESUME'], ACCEPTED: [], DISPUTED: [], CANCELLED: [], SETTLED: [],
  }
  for (const [status, allowed] of Object.entries(permitted)) {
    for (const action of ['START', 'DELIVER', 'ACCEPT', 'REQUEST_REVISION', 'RESUME']) {
      if (allowed.includes(action)) continue
      const f = fixture()
      f.row.fulfillmentStatus = status
      f.row.fulfillmentVersion = 7
      await assert.rejects(f.service.transition('space', 'booking', { action, expectedVersion: 7 }), { status: 409 }, `${status} -> ${action}`)
      assert.equal(f.events.length, 0)
    }
  }
})

test('LIVE, EXERCISE_REVIEW and HYBRID require their own delivery evidence', async () => {
  const live = fixture('LIVE'); await live.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 })
  live.recap(false); await assert.rejects(live.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  live.recap(true); live.row.endTime = new Date('2030-05-03T10:00:00Z')
  await assert.rejects(live.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  const exercise = fixture('EXERCISE_REVIEW'); exercise.row.endTime = new Date('2030-05-03T10:00:00Z')
  await exercise.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 })
  exercise.feedback(false); await assert.rejects(exercise.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  exercise.feedback(true); exercise.reviewedAt(new Date('2030-04-30T11:00:00Z'))
  await assert.rejects(exercise.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  exercise.reviewedAt(new Date('2030-05-01T11:00:00Z'))
  await exercise.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 })
  const hybrid = fixture('HYBRID'); await hybrid.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 })
  hybrid.feedback(false); await assert.rejects(hybrid.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  hybrid.feedback(true); hybrid.submittedAt(new Date('2030-05-01T09:30:00Z'))
  await assert.rejects(hybrid.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  hybrid.submittedAt(new Date('2030-05-01T08:00:00Z'))
  hybrid.recap(false); await assert.rejects(hybrid.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }), { status: 409 })
  hybrid.recap(true); await hybrid.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 })
})

test('concurrent deliver and accept cannot bypass ordering; conditional claims admit one deliver', async () => {
  const f = fixture('LIVE'); await f.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 })
  const results = await Promise.allSettled([
    f.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }),
    f.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 1 }),
    f.service.transition('space', 'booking', { action: 'ACCEPT', expectedVersion: 1 }),
  ])
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1)
  assert.equal(f.row.fulfillmentStatus, 'DELIVERED')
  assert.equal(f.events.length, 2)
  f.actor('mentee'); await f.service.transition('space', 'booking', { action: 'ACCEPT', expectedVersion: 2 })
  assert.equal(f.row.fulfillmentStatus, 'ACCEPTED')
  await assert.rejects(f.service.transition('space', 'booking', { action: 'ACCEPT', expectedVersion: 2 }), { status: 409 })
})

test('cancellation, dispute, archived/suspended pair, and legacy null mode freeze writes', async () => {
  for (const [bookingStatus, terminal] of [['CANCELLED', 'CANCELLED'], ['MISSED', 'CANCELLED'], ['DISPUTED', 'DISPUTED']] as const) {
    const f = fixture('HYBRID'); await f.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 })
    f.row.status = bookingStatus
    await mirrorTerminalFulfillment(f.tx as never, 'booking', terminal, 'mentor')
    await mirrorTerminalFulfillment(f.tx as never, 'booking', terminal, 'mentor')
    assert.equal(f.row.fulfillmentStatus, terminal)
    await assert.rejects(f.service.transition('space', 'booking', { action: 'DELIVER', expectedVersion: 2 }), { status: 409 })
    assert.equal(f.events.length, 2)
  }
  const archived = fixture(); archived.archive(); await assert.rejects(archived.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 }), { status: 409 })
  const suspended = fixture(); suspended.suspend('mentee'); await assert.rejects(suspended.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 }), { status: 403 })
  const outsider = fixture(); outsider.actor('outsider')
  await assert.rejects(outsider.service.read('space', 'booking'), { status: 403 })
  await assert.rejects(outsider.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 }), { status: 403 })
  const legacy = fixture(null); await assert.rejects(legacy.service.transition('space', 'booking', { action: 'START', expectedVersion: 0 }), { status: 404 })
  const oldDispute = fixture('LIVE'); oldDispute.row.status = 'DISPUTED'
  assert.equal((await oldDispute.service.read('space', 'booking')).status, 'DISPUTED')
  assert.equal(oldDispute.row.fulfillmentStatus, null, 'old rows are not backfilled on read')
})

test('input parser rejects malformed version and arbitrary state', () => {
  for (const input of [{ action: 'START', expectedVersion: -1 }, { action: 'START', expectedVersion: 1.5 }, { action: 'START', expectedVersion: '0' }, { action: 'CANCEL', expectedVersion: 0 }]) assert.throws(() => fulfillmentInput(input), { status: 400 })
})
