import assert from 'node:assert/strict'
import test from 'node:test'
import { differenceInHours } from 'date-fns'
import type { DatesSetArg, DateSelectArg, EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import type { SessionInfo } from '../../src/components/SessionDetailDialog'
import { calendarHarness, deferred } from './helpers'

type Range = { start: Date; end: Date }
type Slot = {
  id: string; startTime: Date; endTime: Date; isBooked: boolean
  booking?: { id: string; status: string; meetingUrl: string; note: string; mentorReportedAbsence: boolean; mentee: { id: string; name: string; email: string; avatarUrl: null } }
}
type Calendar = {
  events: EventInput[]
  datesSet: (arg: DatesSetArg) => void
  select: (arg: DateSelectArg) => Promise<void>
  eventDrop: (arg: EventDropArg) => Promise<void>
  eventResize: (arg: EventResizeDoneArg) => Promise<void>
  eventClick: (arg: EventClickArg) => void
  selectAllow: (arg: { start: Date }) => boolean
  selectOverlap: boolean
  eventOverlap: boolean
}
type Dialog = { session: SessionInfo | null; open: boolean; onMutate: () => Promise<void> }
const week = { start: new Date('2026-09-13T00:00:00+07:00'), end: new Date('2026-09-20T00:00:00+07:00') }
const day = { start: new Date('2026-09-15T00:00:00+07:00'), end: new Date('2026-09-16T00:00:00+07:00') }
const future = { start: new Date('2099-01-01T00:00:00+07:00'), end: new Date('2099-01-08T00:00:00+07:00') }
function slot(id: string, status?: string, past = true): Slot {
  return {
    id, startTime: new Date(past ? '2026-09-15T08:00:00+07:00' : '2099-01-01T08:00:00+07:00'),
    endTime: new Date(past ? '2026-09-15T09:00:00+07:00' : '2099-01-01T09:00:00+07:00'), isBooked: !!status,
    ...(status ? { booking: { id: `booking-${id}`, status, meetingUrl: 'https://meet.example.test/session', note: 'Existing note', mentorReportedAbsence: true, mentee: { id: 'learner', name: 'Learner', email: 'learner@example.test', avatarUrl: null } } } : {}),
  }
}

function fixture() {
  const requests: Array<{ mentorId: string; range: Range } & ReturnType<typeof deferred<Slot[]>>> = []
  const writes: Array<{ action: string; args: unknown[] }> = []
  let mutationSuccess = true
  const mutate = (action: string) => async (...args: unknown[]) => {
    writes.push({ action, args })
    return { success: mutationSuccess, message: mutationSuccess ? 'OK' : 'Conflict' }
  }
  const h = calendarHarness({
    'date-fns': { differenceInHours },
    '@/actions/slots': {
      getAllMentorSlots: (mentorId: string, range: Range) => {
        const request = { mentorId, range, ...deferred<Slot[]>() }
        requests.push(request)
        return request.promise
      },
      addMentorSlots: mutate('create'), updateMentorSlot: mutate('update'), deleteMentorSlot: mutate('delete'),
    },
  })
  const calendar = () => h.props<Calendar>('FullCalendar')
  function navigate(range: Range) { calendar().datesSet(range as DatesSetArg); h.flush() }
  async function respond(rows: Slot[], index = requests.length - 1) { requests[index].resolve(rows); await h.settle() }
  const refresh = () => h.props<{ onClick: () => Promise<void> }>('button').onClick()
  return { h, requests, writes, calendar, navigate, respond, refresh, failMutation: () => { mutationSuccess = false } }
}

function eventArg(event: EventInput, revert = () => {}) {
  return { event: { ...event, start: event.start, end: event.end }, revert } as unknown as EventDropArg & EventResizeDoneArg & EventClickArg
}

test('week/day navigation requests FullCalendar absolute boundaries and replaces events without duplicates', async () => {
  const f = fixture()
  assert.equal(f.requests.length, 0, 'do not load today before FullCalendar supplies its range')
  f.navigate(week)
  assert.equal(f.requests[0].mentorId, 'mentor')
  assert.equal(f.requests[0].range.start.toISOString(), '2026-09-12T17:00:00.000Z')
  assert.equal(f.requests[0].range.end.toISOString(), '2026-09-19T17:00:00.000Z')
  await f.respond([slot('past'), slot('booked', 'COMPLETED')])
  assert.deepEqual(Array.from(f.calendar().events, e => e.id), ['slot-past', 'slot-booked'])
  assert.equal(f.calendar().events[1].extendedProps?.bookingId, 'booking-booked')
  f.navigate(day)
  assert.equal(f.requests[1].range.start.getTime(), day.start.getTime())
  assert.equal(f.requests[1].range.end.getTime(), day.end.getTime())
  assert.equal(f.calendar().events.length, 0, 'old range data is cleared while loading')
  await f.respond([slot('booked', 'COMPLETED')])
  assert.equal(f.calendar().events.length, 1)
  f.navigate(future)
  await f.respond([slot('future', undefined, false)])
  assert.equal(f.calendar().events[0].editable, true)
  f.navigate(future)
  assert.equal(f.requests.length, 3, 'same range callback does not refetch repeatedly')
})

test('rapid navigation ignores older successes, failures, and loading completion', async () => {
  const f = fixture()
  f.navigate(week); f.navigate(day)
  await f.respond([slot('new')], 1)
  await f.respond([slot('old')], 0)
  assert.equal(f.calendar().events[0].id, 'slot-new')
  f.navigate(week); f.navigate(future)
  f.requests[2].reject(new Error('stale failure'))
  await f.h.settle()
  assert.equal(f.h.props<{ disabled: boolean }>('button').disabled, true)
  const children = f.h.find('div')?.props.children as Array<{ props?: { role?: string } }>
  assert.equal(children.some(child => child?.props?.role === 'alert'), false)
  await f.respond([slot('future', undefined, false)], 3)
  assert.equal(f.calendar().events[0].id, 'slot-future')
})

test('read failure is explicit, clears unverified events, and refresh retries the visible range', async () => {
  const f = fixture()
  f.navigate(week); await f.respond([slot('valid')])
  const refresh = f.refresh()
  f.requests[1].reject(new Error('offline'))
  await refresh; await f.h.settle()
  assert.equal(f.calendar().events.length, 0)
  const children = f.h.find('div')?.props.children as Array<{ props?: { role?: string; children?: unknown } }>
  const alert = children.find(child => child?.props?.role === 'alert')
  assert.match(String(alert?.props?.children), /Không thể tải lịch/)
  const retry = f.refresh()
  assert.equal(f.requests[2].range, f.requests[0].range)
  await f.respond([slot('valid')]); await retry
  assert.equal(f.calendar().events[0].id, 'slot-valid')
})

test('a superseded successful request cannot repopulate a newer range after its read failed', async () => {
  const f = fixture()
  f.navigate(week); f.navigate(day)
  f.requests[1].reject(new Error('latest read failed'))
  await f.h.settle()
  await f.respond([slot('superseded')], 0)
  assert.equal(f.calendar().events.length, 0)
  const children = f.h.find('div')?.props.children as Array<{ props?: { role?: string } }>
  assert.equal(children.some(child => child?.props?.role === 'alert'), true)
})

test('all Booking statuses keep event identity, colors, noneditable rules, and mentor dialog payload', async () => {
  const f = fixture()
  f.navigate(future)
  const statuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'MISSED', 'DISPUTED']
  await f.respond(statuses.map(status => slot(status, status, false)))
  const colors = ['#7c3aed', '#3b82f6', '#0d9488', '#94a3b8', '#fecaca', '#6366f1']
  for (const [index, event] of f.calendar().events.entries()) {
    assert.equal(event.id, `slot-${statuses[index]}`)
    assert.equal(event.backgroundColor, colors[index])
    assert.equal(event.editable, false)
    f.calendar().eventClick(eventArg(event)); f.h.flush()
    const dialog = f.h.props<Dialog>('SessionDetailDialog')
    assert.equal(dialog.open, true)
    assert.equal(dialog.session?.role, 'mentor')
    assert.equal(dialog.session?.bookingId, `booking-${statuses[index]}`)
    assert.equal(dialog.session?.bookingStatus, statuses[index])
    assert.equal(dialog.session?.meetingUrl, 'https://meet.example.test/session')
    assert.equal(dialog.session?.note, 'Existing note')
    assert.equal(dialog.session?.mentorReportedAbsence, true)
    assert.equal(dialog.session?.partner.name, 'Learner')
  }
  let reverted = 0
  await f.calendar().eventDrop(eventArg(f.calendar().events[0], () => { reverted++ }))
  assert.equal(reverted, 1)
  assert.equal(f.writes.length, 0)
})

test('past availability remains inert and future availability keeps the owner dialog and selection rules', async () => {
  const f = fixture()
  f.navigate(week); await f.respond([slot('past')])
  assert.equal(f.calendar().events[0].editable, false)
  f.calendar().eventClick(eventArg(f.calendar().events[0])); f.h.flush()
  assert.equal(f.h.props<Dialog>('SessionDetailDialog').open, false)
  assert.equal(f.calendar().selectAllow({ start: new Date('2020-01-01') }), false)
  assert.equal(f.calendar().selectOverlap, false)
  assert.equal(f.calendar().eventOverlap, false)
  let unselected = 0
  await f.calendar().select({ start: new Date('2020-01-01'), view: { calendar: { unselect() { unselected++ } } } } as unknown as DateSelectArg)
  assert.equal(unselected, 1)
  assert.equal(f.writes.length, 0)
  f.navigate(future); await f.respond([slot('future', undefined, false)])
  f.calendar().eventClick(eventArg(f.calendar().events[0])); f.h.flush()
  assert.equal(f.h.props<Dialog>('SessionDetailDialog').session?.role, 'owner')
  assert.equal(f.h.props<Dialog>('SessionDetailDialog').session?.slotId, 'future')
})

test('create, move, resize, and dialog mutation/deletion refresh the currently displayed range', async () => {
  for (const operation of ['create', 'move', 'resize', 'dialog-delete']) {
    const f = fixture()
    f.navigate(future); await f.respond([slot('future', undefined, false)])
    const calendar = f.calendar()
    const event = calendar.events[0]
    const pending = operation === 'create'
      ? calendar.select({ start: event.start, end: event.end, view: { calendar: { unselect() {} } } } as unknown as DateSelectArg)
      : operation === 'move' ? calendar.eventDrop(eventArg(event))
        : operation === 'resize' ? calendar.eventResize(eventArg(event))
          : f.h.props<Dialog>('SessionDetailDialog').onMutate()
    // Navigate while the mutation resolves: its captured handler must read the latest range.
    f.navigate(day)
    await f.h.settle()
    assert.equal(f.requests.at(-1)?.range.start.getTime(), day.start.getTime(), operation)
    for (let i = 1; i < f.requests.length; i++) f.requests[i].resolve([])
    await pending; await f.h.settle()
    assert.equal(f.calendar().events.length, 0)
    assert.equal(f.requests.some((request, i) => i > 1 && request.range.start.getTime() === future.start.getTime()), false, operation)
  }
})

test('rejected slot mutation reverts and does not fetch or replace the calendar', async () => {
  const f = fixture()
  f.navigate(future); await f.respond([slot('future', undefined, false)])
  f.failMutation()
  let reverted = 0
  await f.calendar().eventDrop(eventArg(f.calendar().events[0], () => { reverted++ }))
  await f.h.settle()
  assert.equal(reverted, 1)
  assert.equal(f.requests.length, 1)
  assert.equal(f.calendar().events[0].id, 'slot-future')
})

test('mentor change invalidates old responses, and unmount ignores pending requests', async () => {
  const f = fixture()
  f.navigate(week)
  f.h.changeMentor('different-mentor')
  assert.equal(f.requests[1].mentorId, 'different-mentor')
  await f.respond([slot('new-mentor')], 1)
  await f.respond([slot('old-mentor')], 0)
  assert.equal(f.calendar().events[0].id, 'slot-new-mentor')
  const pending = f.refresh()
  f.h.unmount()
  f.requests[2].resolve([slot('after-unmount')])
  await pending; await f.h.settle()
  assert.equal(f.calendar().events.some(event => event.id === 'slot-after-unmount'), false)
})
