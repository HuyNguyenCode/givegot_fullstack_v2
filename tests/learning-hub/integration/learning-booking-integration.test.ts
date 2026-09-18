import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  LearningBookingAuthorizationError,
  LearningBookingValidationError,
  loadLearningBookingContext,
  prepareLearningBookingSnapshot,
  type LearningBookingRecord,
  type LearningBookingRepository,
} from '../../../src/lib/learning-booking-service'

const startTime = new Date('2030-01-02T03:00:00.000Z')
const endTime = new Date('2030-01-02T04:00:00.000Z')

function fixture() {
  const space: LearningBookingRecord = {
    id: 'space-1',
    title: 'Pair space',
    state: 'ACTIVE',
    objective: 'Ship the demo',
    definitionOfDone: 'The demo passes review',
    members: [
      { userId: 'mentee', status: 'ACTIVE' },
      { userId: 'mentor', status: 'ACTIVE' },
    ],
    topics: [
      { id: 'topic-1', label: 'Original topic', state: 'ACTIVE' },
      { id: 'topic-old', label: 'Archived topic', state: 'ARCHIVED' },
    ],
  }
  let locks = 0
  let privateReads = 0
  const repository: LearningBookingRepository = {
    lockSpace: async (id) => {
      assert.equal(id, space.id)
      locks += 1
    },
    isActiveMember: async (id, userId) => id === space.id && space.members.some(
      (member) => member.userId === userId && member.status === 'ACTIVE',
    ),
    findSpace: async (id) => {
      privateReads += 1
      return id === space.id ? space : null
    },
  }
  return { repository, space, lockCount: () => locks, privateReadCount: () => privateReads }
}

test('a linked Booking is authorized against the server-session actor and both active pair members', async () => {
  const { repository, lockCount } = fixture()
  const snapshot = await prepareLearningBookingSnapshot(repository, {
    actorId: 'mentee', mentorId: 'mentor', menteeId: 'mentee', startTime, endTime,
    selection: { learningSpaceId: 'space-1', learningMode: 'LIVE', topicId: 'topic-1' },
  })
  assert.equal(lockCount(), 1)
  assert.deepEqual(snapshot, {
    learningSpaceId: 'space-1',
    topicId: 'topic-1',
    learningMode: 'LIVE',
    objective: 'Ship the demo',
    definitionOfDone: 'The demo passes review',
    fulfillmentStatus: 'NOT_STARTED',
  })
})

test('nonmembers, mismatched pairs, and topics outside the active member space are rejected', async () => {
  const outsider = fixture()
  await assert.rejects(
    () => prepareLearningBookingSnapshot(outsider.repository, {
      actorId: 'outsider', mentorId: 'mentor', menteeId: 'outsider', startTime, endTime,
      selection: { learningSpaceId: 'space-1', learningMode: 'HYBRID' },
    }),
    LearningBookingAuthorizationError,
  )
  assert.equal(outsider.privateReadCount(), 0, 'membership must be checked before private metadata')

  const wrongMentor = fixture()
  await assert.rejects(
    () => prepareLearningBookingSnapshot(wrongMentor.repository, {
      actorId: 'mentee', mentorId: 'third-user', menteeId: 'mentee', startTime, endTime,
      selection: { learningSpaceId: 'space-1', learningMode: 'EXERCISE_REVIEW' },
    }),
    LearningBookingAuthorizationError,
  )

  const selfBooking = fixture()
  await assert.rejects(
    () => prepareLearningBookingSnapshot(selfBooking.repository, {
      actorId: 'mentee', mentorId: 'mentee', menteeId: 'mentee', startTime, endTime,
      selection: { learningSpaceId: 'space-1', learningMode: 'LIVE' },
    }),
    LearningBookingAuthorizationError,
  )

  const archivedTopic = fixture()
  await assert.rejects(
    () => prepareLearningBookingSnapshot(archivedTopic.repository, {
      actorId: 'mentee', mentorId: 'mentor', menteeId: 'mentee', startTime, endTime,
      selection: { learningSpaceId: 'space-1', learningMode: 'LIVE', topicId: 'topic-old' },
    }),
    LearningBookingValidationError,
  )
})

test('Booking topic and objective snapshots remain stable after the space changes', async () => {
  const { repository, space } = fixture()
  const snapshot = await prepareLearningBookingSnapshot(repository, {
    actorId: 'mentee', mentorId: 'mentor', menteeId: 'mentee', startTime, endTime,
    selection: { learningSpaceId: 'space-1', learningMode: 'LIVE', topicId: 'topic-1' },
  })
  space.objective = 'Changed later'
  space.topics[0].label = 'Renamed later'
  assert.equal('objective' in snapshot && snapshot.objective, 'Ship the demo')
  assert.equal('topicId' in snapshot && snapshot.topicId, 'topic-1')
})

test('all three modes initialize workflow state without changing legacy null-mode creation', async () => {
  for (const learningMode of ['LIVE', 'EXERCISE_REVIEW', 'HYBRID'] as const) {
    const { repository } = fixture()
    const snapshot = await prepareLearningBookingSnapshot(repository, {
      actorId: 'mentee', mentorId: 'mentor', menteeId: 'mentee', startTime, endTime,
      selection: { learningSpaceId: 'space-1', learningMode },
    })
    assert.equal('learningMode' in snapshot && snapshot.learningMode, learningMode)
    assert.equal('fulfillmentStatus' in snapshot && snapshot.fulfillmentStatus, 'NOT_STARTED')
  }

  let queried = false
  const legacy = await prepareLearningBookingSnapshot({
    lockSpace: async () => { queried = true },
    isActiveMember: async () => { queried = true; return false },
    findSpace: async () => { queried = true; return null },
  }, {
    actorId: 'mentee', mentorId: 'mentor', menteeId: 'mentee', startTime, endTime,
  })
  assert.deepEqual(legacy, {})
  assert.equal(queried, false)
})

test('context loading exposes active topics only after pair membership succeeds', async () => {
  const { repository } = fixture()
  const context = await loadLearningBookingContext(repository, {
    learningSpaceId: 'space-1', actorId: 'mentee', mentorId: 'mentor',
  })
  assert.deepEqual(context.topics, [{ id: 'topic-1', label: 'Original topic' }])
})

test('AvailableSlot locking, Calendar/Meet, cancellation, dispute, and fixed one-GP escrow remain intact', () => {
  const bookingSource = readFileSync('src/actions/booking.ts', 'utf8')
  const cronSource = readFileSync('src/app/api/cron/auto-complete/route.ts', 'utf8')

  const lockIndex = bookingSource.indexOf('FOR UPDATE')
  const takenIndex = bookingSource.indexOf('if (lockedSlot.isBooked)')
  const createIndex = bookingSource.indexOf('const booking = await tx.booking.create')
  assert.ok(lockIndex >= 0 && lockIndex < takenIndex && takenIndex < createIndex)
  assert.match(bookingSource, /createGoogleMeetForMentor\(/)
  assert.match(bookingSource, /status: BookingStatus\.CONFIRMED, meetingUrl/)
  assert.match(bookingSource, /status: BookingStatus\.CANCELLED/)
  assert.match(bookingSource, /status: 'DISPUTED'/)

  assert.equal((bookingSource.match(/givePoints: \{ decrement: 1 \}/g) ?? []).length, 2)
  assert.ok((bookingSource.match(/amount:\s+-1/g) ?? []).length >= 2)
  assert.doesNotMatch(bookingSource, /learningMode[^\n]*(?:givePoints|amount)|(?:givePoints|amount)[^\n]*learningMode/)
  assert.doesNotMatch(cronSource, /learningMode/)
})
