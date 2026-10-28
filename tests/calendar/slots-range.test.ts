import assert from 'node:assert/strict'
import test from 'node:test'
import { BookingStatus } from '@prisma/client'
import { loadSource } from './helpers'

type Actions = typeof import('../../src/actions/slots')
type Range = { start: Date; end: Date }
type Query = {
  where: { mentorId: string; startTime: { lt?: Date; gte?: Date }; endTime?: { gt: Date } }
  include: { booking: { include: { mentee: { select: Record<string, boolean> } } } }
  orderBy: { startTime: string }
}
const range = (start = '2026-09-13T00:00:00+07:00', end = '2026-09-20T00:00:00+07:00'): Range => ({ start: new Date(start), end: new Date(end) })
const slot = (id: string, start: string, end: string, mentorId = 'mentor', isBooked = false) => ({
  id, mentorId, startTime: new Date(start), endTime: new Date(end), isBooked,
  booking: isBooked ? { id: `booking-${id}`, status: 'COMPLETED', mentee: { id: 'learner', name: 'Learner', email: 'learner@example.test', avatarUrl: null } } : null,
})

function fixture() {
  const rows = [
    slot('old', '2026-09-13T08:00:00+07:00', '2026-09-13T09:00:00+07:00'),
    slot('booked', '2026-09-19T10:00:00+07:00', '2026-09-19T11:00:00+07:00', 'mentor', true),
    slot('other', '2026-09-14T08:00:00+07:00', '2026-09-14T09:00:00+07:00', 'other-mentor'),
    slot('cross-start', '2026-09-12T23:00:00+07:00', '2026-09-13T01:00:00+07:00'),
    slot('ends-at-start', '2026-09-12T23:00:00+07:00', '2026-09-13T00:00:00+07:00'),
    slot('starts-at-start', '2026-09-13T00:00:00+07:00', '2026-09-13T01:00:00+07:00'),
    slot('ends-at-end', '2026-09-19T22:00:00+07:00', '2026-09-20T00:00:00+07:00'),
    slot('starts-at-end', '2026-09-20T00:00:00+07:00', '2026-09-20T01:00:00+07:00'),
    slot('cross-end', '2026-09-19T23:00:00+07:00', '2026-09-20T01:00:00+07:00'),
    slot('future', '2099-01-01T08:00:00Z', '2099-01-01T09:00:00Z'),
  ]
  const queries: Query[] = []
  let fail = false
  const actions = loadSource<Actions>('src/actions/slots.ts', {
    '@/lib/prisma': { prisma: { availableSlot: { findMany: async (query: Query) => {
      queries.push(query)
      if (fail) throw new Error('database unavailable')
      const { where } = query
      return rows.filter(row => row.mentorId === where.mentorId
        && (!where.startTime.lt || row.startTime < where.startTime.lt)
        && (!where.startTime.gte || row.startTime >= where.startTime.gte)
        && (!where.endTime || row.endTime > where.endTime.gt))
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    } } } },
    'next/cache': { unstable_noStore() {} },
    '@prisma/client': { BookingStatus },
  })
  return { actions, queries, fail: () => { fail = true } }
}

test('historical overlap query retains linked Booking, mentor filter, and exclusive boundaries', async () => {
  const f = fixture()
  const result = await f.actions.getAllMentorSlots('mentor', range())
  assert.deepEqual(Array.from(result, row => row.id), ['cross-start', 'starts-at-start', 'old', 'booked', 'ends-at-end', 'cross-end'])
  assert.equal(result.find(row => row.id === 'booked')?.booking?.id, 'booking-booked')
  const query = f.queries[0]
  assert.equal(query.where.startTime.lt?.toISOString(), '2026-09-19T17:00:00.000Z')
  assert.equal(query.where.endTime?.gt.toISOString(), '2026-09-12T17:00:00.000Z')
  assert.equal(query.orderBy.startTime, 'asc')
  assert.equal(query.include.booking.include.mentee.select.id, true)
  assert.equal(query.include.booking.include.mentee.select.email, true)
})

test('equivalent offset instants return the same events independently of server timezone', async () => {
  const f = fixture()
  const local = await f.actions.getAllMentorSlots('mentor', range())
  const utc = await f.actions.getAllMentorSlots('mentor', range('2026-09-12T17:00:00Z', '2026-09-19T17:00:00Z'))
  assert.deepEqual(Array.from(local, row => row.id), Array.from(utc, row => row.id))
})

test('future ranges work and a DST day preserves its actual 23-hour interval', async () => {
  const f = fixture()
  const future = await f.actions.getAllMentorSlots('mentor', range('2099-01-01T00:00:00Z', '2099-01-02T00:00:00Z'))
  assert.deepEqual(Array.from(future, row => row.id), ['future'])
  await f.actions.getAllMentorSlots('mentor', range('2026-03-08T00:00:00-05:00', '2026-03-09T00:00:00-04:00'))
  const where = f.queries[1].where
  assert.equal(where.startTime.lt!.getTime() - where.endTime!.gt.getTime(), 23 * 60 * 60 * 1000)
})

test('one-argument callers keep their seven-day cutoff and empty-array failure contract', async () => {
  const f = fixture()
  const before = new Date(); before.setDate(before.getDate() - 7)
  await f.actions.getAllMentorSlots('mentor')
  const after = new Date(); after.setDate(after.getDate() - 7)
  const where = f.queries[0].where
  assert.ok(where.startTime.gte! >= before && where.startTime.gte! <= after)
  assert.equal(where.startTime.lt, undefined)
  assert.equal(where.endTime, undefined)
  f.fail()
  assert.equal((await f.actions.getAllMentorSlots('mentor')).length, 0)
})

test('range failures reject instead of appearing empty, and invalid ranges never query', async () => {
  const f = fixture()
  for (const invalid of [range('invalid'), range('2026-09-13T00:00:00Z', 'invalid'), range('2026-09-20T00:00:00Z', '2026-09-13T00:00:00Z'), range('2026-09-13T00:00:00Z', '2026-09-13T00:00:00Z')]) {
    await assert.rejects(f.actions.getAllMentorSlots('mentor', invalid), /Failed to load mentor calendar slots/)
  }
  assert.equal(f.queries.length, 0)
  f.fail()
  await assert.rejects(f.actions.getAllMentorSlots('mentor', range()), /Failed to load mentor calendar slots/)
})

test('unchanged slot services still reject booked movement/deletion and availability or Booking conflicts', async () => {
  let booked = true
  let ownedConflict = false
  let bookingConflict = false
  let writes = 0
  const actions = loadSource<Actions>('src/actions/slots.ts', {
    '@/lib/prisma': { prisma: {
      availableSlot: {
        findUnique: async () => ({ id: 'slot', mentorId: 'mentor', isBooked: booked }),
        findFirst: async () => ownedConflict ? {} : null,
        findMany: async () => ownedConflict ? [{}] : [],
        update: async () => { writes++ }, delete: async () => { writes++ }, createMany: async () => { writes++; return { count: 1 } },
      },
      booking: { findFirst: async () => bookingConflict ? { mentorId: 'mentor', mentee: { name: 'Learner' } } : null },
    } },
    'next/cache': { revalidatePath() {} }, '@prisma/client': { BookingStatus },
  })
  const start = new Date('2099-01-01T08:00:00Z'), end = new Date('2099-01-01T09:00:00Z')
  assert.equal((await actions.updateMentorSlot('slot', 'mentor', start, end)).success, false)
  assert.equal((await actions.deleteMentorSlot('slot', 'mentor')).success, false)
  booked = false; ownedConflict = true
  assert.equal((await actions.updateMentorSlot('slot', 'mentor', start, end)).success, false)
  assert.equal((await actions.addMentorSlots('mentor', [{ startTime: start, endTime: end }])).success, false)
  ownedConflict = false; bookingConflict = true
  assert.equal((await actions.updateMentorSlot('slot', 'mentor', start, end)).success, false)
  assert.equal(writes, 0)
})
