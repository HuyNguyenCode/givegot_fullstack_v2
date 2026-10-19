/* eslint-disable @typescript-eslint/no-explicit-any -- Narrow in-memory Prisma mock. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createLearningNoteService } from '../../../src/lib/learning-note-service'
import { LearningNotes, canSubmitNoteDraft, reconcileReloadedNotes, requestNotes, submitNoteDraft } from '../../../src/components/learning/LearningNotes'
import { LearningSpaceShell } from '../../../src/components/learning/LearningSpaceShell'

function fixture() {
  let actorId = 'member-a'
  let state: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE'
  let active = true
  let invalidate: 'MEMBERSHIP' | 'ARCHIVE' | null = null
  const notes: Array<Record<string, any>> = []
  const activities: Array<Record<string, any>> = []
  const db = {
    learningSpaceMember: { findUnique: async ({ where }: any) => {
      const member = ['member-a', 'member-b'].includes(where.learningSpaceId_userId.userId) && active ? { status: 'ACTIVE', learningSpace: { state }, user: { isSuspended: false } } : null
      if (invalidate === 'MEMBERSHIP') active = false
      if (invalidate === 'ARCHIVE') state = 'ARCHIVED'
      invalidate = null
      return member
    } },
    booking: { findFirst: async ({ where }: any) => where.id === 'booking-a' && where.learningSpaceId === 'space' ? { mentorId: 'member-a', menteeId: 'member-b' } : where.id === 'booking-other' && where.learningSpaceId === 'space' ? { mentorId: 'other-a', menteeId: 'other-b' } : null },
    learningActivity: { upsert: async ({ where, create }: any) => { const existing = activities.find(activity => activity.eventKey === where.eventKey); if (existing) return existing; activities.push(create); return create } },
    learningNote: {
      create: async ({ data }: any) => { const row = { id: String(notes.length + 1), ...data, version: 1, deletedAt: null, deletedById: null, createdAt: new Date(), updatedAt: new Date(), author: { name: data.authorId } }; notes.push(row); return row },
      findMany: async ({ where }: any) => notes.filter(n => n.learningSpaceId === where.learningSpaceId && !n.deletedAt),
      findFirst: async ({ where }: any) => notes.find(n => n.id === where.id && n.learningSpaceId === where.learningSpaceId) ?? null,
      updateMany: async ({ where, data }: any) => { const n = notes.find(n => n.id === where.id && n.version === where.version && !n.deletedAt); if (!n) return { count: 0 }; Object.assign(n, data); n.version = where.version + 1; n.updatedAt = new Date(); return { count: 1 } },
      findUniqueOrThrow: async ({ where }: any) => notes.find(n => n.id === where.id),
    },
  }
  Object.assign(db, { $transaction: async (fn: (tx: typeof db) => Promise<unknown>) => fn(db) })
  const service = createLearningNoteService({ db: db as never, actor: async () => ({ id: actorId, email: null, name: null }), now: () => new Date('2030-01-01T00:00:00Z') })
  return { service, actor: (value: string) => { actorId = value }, archive: () => { state = 'ARCHIVED' }, revokeAtTransaction: () => { invalidate = 'MEMBERSHIP' }, archiveAtTransaction: () => { invalidate = 'ARCHIVE' }, notes, activities }
}

test('member creates, reads, edits with version; nonmember is denied', async () => {
  const f = fixture()
  await assert.rejects(() => f.service.create('space', { content: 'spoof', authorId: 'member-b' }), { status: 400 })
  const note = await f.service.create('space', { content: 'Xin chào', type: 'GENERAL' })
  assert.equal(note.authorId, 'member-a')
  assert.equal(note.visibility, 'SPACE_MEMBERS')
  f.actor('member-b')
  assert.equal((await f.service.list('space')).length, 1)
  assert.equal((await f.service.read('space', note.id)).content, 'Xin chào')
  await assert.rejects(() => f.service.update('space', note.id, { expectedVersion: 1, content: 'No' }), { status: 403 })
  f.actor('outsider')
  await assert.rejects(() => f.service.list('space'), { status: 403 })
  await assert.rejects(() => f.service.read('space', note.id), { status: 403 })
  f.actor('member-a')
  const edited = await f.service.update('space', note.id, { expectedVersion: 1, content: 'Đã sửa' })
  assert.equal(edited.version, 2)
  await assert.rejects(() => f.service.update('space', note.id, { expectedVersion: 1, content: 'Stale' }), { status: 409 })
})

test('shared note edits and deletion append redacted, deduplicated activity only after success', async () => {
  const f = fixture()
  const note = await f.service.create('space', { content: 'Nội dung riêng của ghi chú' })
  const createdCount = f.activities.length
  await f.service.update('space', note.id, { expectedVersion: 1, content: 'Nội dung đã sửa' })
  await f.service.remove('space', note.id, { expectedVersion: 2 })
  assert.deepEqual(f.activities.slice(createdCount), [
    { learningSpaceId: 'space', bookingId: null, actorId: 'member-a', eventType: 'LEARNING_NOTE_UPDATED', entityType: 'LearningNote', entityId: note.id, eventKey: `learning-note:${note.id}:updated:2`, occurredAt: undefined, metadata: { noteType: 'GENERAL', version: 2 } },
    { learningSpaceId: 'space', bookingId: null, actorId: 'member-a', eventType: 'LEARNING_NOTE_DELETED', entityType: 'LearningNote', entityId: note.id, eventKey: `learning-note:${note.id}:deleted:3`, occurredAt: undefined, metadata: { noteType: 'GENERAL', version: 3 } },
  ])
  await assert.rejects(() => f.service.remove('space', note.id, { expectedVersion: 2 }), { status: 404 })
  assert.equal(f.activities.length, createdCount + 2)
})

test('private note mutations and stale shared mutations do not append activity', async () => {
  const f = fixture()
  const privateNote = await f.service.create('space', { content: 'Chỉ mình tôi', visibility: 'AUTHOR_ONLY' })
  const initial = f.activities.length
  await f.service.update('space', privateNote.id, { expectedVersion: 1, content: 'Vẫn riêng tư' })
  await f.service.remove('space', privateNote.id, { expectedVersion: 2 })
  assert.equal(f.activities.length, initial)

  const shared = await f.service.create('space', { content: 'Công khai trong không gian' })
  const beforeStale = f.activities.length
  await assert.rejects(() => f.service.update('space', shared.id, { expectedVersion: 7, content: 'Không được lưu' }), { status: 409 })
  assert.equal(f.activities.length, beforeStale)
})
test('visibility, booking ownership, archive reads, and soft deletion preserve audit', async () => {
  const f = fixture()
  await assert.rejects(() => f.service.create('space', { content: 'x', bookingId: 'booking-other' }), { status: 400 })
  await assert.rejects(() => f.service.create('space', { content: 'x', visibility: 'BOOKING_PARTICIPANTS' }), { status: 400 })
  const privateNote = await f.service.create('space', { content: 'Only me', visibility: 'AUTHOR_ONLY' })
  const recap = await f.service.create('space', { content: 'Buổi học', type: 'RECAP', bookingId: 'booking-a', visibility: 'BOOKING_PARTICIPANTS' })
  f.actor('member-b')
  assert.deepEqual((await f.service.list('space')).map(n => n.id), [recap.id])
  await assert.rejects(() => f.service.read('space', privateNote.id), { status: 404 })
  f.archive()
  assert.equal((await f.service.read('space', recap.id)).type, 'RECAP')
  await assert.rejects(() => f.service.create('space', { content: 'No' }), { status: 409 })
  f.actor('member-a')
  await assert.rejects(() => f.service.remove('space', recap.id, { expectedVersion: 1 }), { status: 409 })
})

test('long Vietnamese plain text is accepted and XSS remains escaped in React rendering', async () => {
  const f = fixture()
  const text = 'Học tiếng Việt thật kỹ. '.repeat(1200) + '<script>alert(1)</script>'
  const note = await f.service.create('space', { content: text })
  assert.equal(note.content, text)
  const html = renderToStaticMarkup(createElement(LearningNotes, { spaceId: 'space', viewerId: 'member-a', archived: false, bookings: [], initialNotes: [{ ...note, updatedAt: new Date().toISOString() }] }))
  assert.match(html, /min-h-11/)
  assert.match(html, /w-full min-w-0/)
  assert.match(html, /&lt;script&gt;/)
  assert.doesNotMatch(html, /<script>/)
})

test('deleted note is absent from reads and cannot be edited twice', async () => {
  const f = fixture()
  const note = await f.service.create('space', { content: 'archive me' })
  const deleted = await f.service.remove('space', note.id, { expectedVersion: 1 })
  assert.equal(deleted.deletedById, 'member-a')
  assert.equal(deleted.version, 2)
  assert.equal((await f.service.list('space')).length, 0)
  await assert.rejects(() => f.service.read('space', note.id), { status: 404 })
  await assert.rejects(() => f.service.remove('space', note.id, { expectedVersion: 1 }), { status: 404 })
  assert.equal(f.notes.length, 1)
})

test('dashboard and history navigation stay available in shell', () => {
  const shell = { id: 'space', viewerId: 'member-a', title: 'Không gian', state: 'ACTIVE' as const, primarySkillName: 'Việt', objective: null, definitionOfDone: null, members: [{ id: 'member-a', name: 'A', email: null }, { id: 'member-b', name: 'B', email: null }], topics: [], bookings: [] }
  const html = renderToStaticMarkup(createElement(LearningSpaceShell, { space: shell }))
  assert.match(html, /href="\/dashboard"/)
  assert.match(html, /href="#history"/)
  assert.match(html, /Ghi chú riêng tư/)
})

test('notes reload retries GET safely and preserves the edit draft while refreshing its version', async () => {
  const stale = { id: 'note-1', authorId: 'member-a', bookingId: null, content: 'Bản trên máy', type: 'GENERAL' as const, visibility: 'SPACE_MEMBERS' as const, version: 1, updatedAt: '2030-01-01T00:00:00.000Z' }
  const latest = { ...stale, content: 'Bản trên máy chủ', version: 2, updatedAt: '2030-01-02T00:00:00.000Z' }
  const draft = { ...stale, content: 'Bản nháp chưa lưu' }
  let calls = 0
  const methods: Array<string | undefined> = []
  const request = async (_endpoint: string, init?: RequestInit) => {
    calls += 1
    methods.push(init?.method)
    if (calls === 1) throw new TypeError('Failed to fetch')
    return { ok: true, json: async () => ({ notes: [latest] }) } as Response
  }

  await assert.rejects(() => requestNotes('/notes', request as typeof fetch), { message: 'Không thể tải ghi chú. Kiểm tra kết nối rồi thử lại.' })
  const notes = await requestNotes('/notes', request as typeof fetch)
  const reconciled = reconcileReloadedNotes(notes, stale)

  assert.equal(calls, 2)
  assert.deepEqual(methods, [undefined, undefined])
  assert.equal(reconciled.notes.length, 1)
  assert.equal(reconciled.editing?.version, 2)
  assert.equal(draft.content, 'Bản nháp chưa lưu')
  assert.equal(reconciled.refreshedEditing, true)
})

test('notes reload keeps a Vietnamese actionable error when retry still fails and does not create notes', async () => {
  let calls = 0
  const offline = async () => { calls += 1; throw new TypeError('Failed to fetch') }

  await assert.rejects(() => requestNotes('/notes', offline as typeof fetch), { message: 'Không thể tải ghi chú. Kiểm tra kết nối rồi thử lại.' })
  await assert.rejects(() => requestNotes('/notes', offline as typeof fetch), { message: 'Không thể tải ghi chú. Kiểm tra kết nối rồi thử lại.' })

  assert.equal(calls, 2)
})

test('offline note submit keeps the unsaved draft after its failed POST', async () => {
  const draft = { content: 'Bản nháp khi mất mạng', type: 'GENERAL' as const, visibility: 'SPACE_MEMBERS' as const, bookingId: null }
  const before = { ...draft }
  const methods: Array<string | undefined> = []
  const offline = async (_endpoint: string, init?: RequestInit) => { methods.push(init?.method); throw new TypeError('Failed to fetch') }

  await assert.rejects(() => submitNoteDraft('/notes', null, draft, offline as typeof fetch), { message: 'Failed to fetch' })
  assert.deepEqual(draft, before)
  assert.deepEqual(methods, ['POST'])
})
test('reload retires an editor for a note archived in another tab while preserving its draft', async () => {
  const stale = { id: 'note-archived', authorId: 'member-a', bookingId: null, content: 'Nội dung cũ', type: 'GENERAL' as const, visibility: 'SPACE_MEMBERS' as const, version: 3, updatedAt: '2030-01-01T00:00:00.000Z' }
  const draft = { content: 'Bản nháp cần sao chép', type: 'GENERAL' as const, visibility: 'SPACE_MEMBERS' as const, bookingId: null }
  const reloaded = reconcileReloadedNotes([], stale)
  const methods: Array<string | undefined> = []
  const notFound = async (_endpoint: string, init?: RequestInit) => {
    methods.push(init?.method)
    return { ok: false, status: 404, json: async () => ({ error: 'Note not found' }) } as Response
  }

  await assert.rejects(() => submitNoteDraft('/notes', stale, draft, notFound as typeof fetch), { message: 'Ghi chú không còn khả dụng. Tải lại để kiểm tra trạng thái mới nhất.' })
  assert.equal(reloaded.missingEditing, true)
  assert.equal(reloaded.editing, null)
  assert.deepEqual(reloaded.notes, [])
  assert.equal(draft.content, 'Bản nháp cần sao chép')
  assert.equal(canSubmitNoteDraft(draft.content, false, reloaded.missingEditing), false)
  assert.deepEqual(methods, ['PATCH'])
})

test('note transaction guard rejects membership and archive changes without mutations or activity', async () => {
  const create = fixture()
  create.revokeAtTransaction()
  await assert.rejects(() => create.service.create('space', { content: 'Không lưu' }), { status: 403 })
  assert.equal(create.notes.length, 0)
  assert.deepEqual(create.activities, [])

  const update = fixture()
  const note = await update.service.create('space', { content: 'Bản gốc' })
  const activityCount = update.activities.length
  update.archiveAtTransaction()
  await assert.rejects(() => update.service.update('space', note.id, { expectedVersion: 1, content: 'Không lưu' }), { status: 409 })
  assert.equal(update.notes[0].content, 'Bản gốc')
  assert.equal(update.notes[0].version, 1)
  assert.equal(update.activities.length, activityCount)

  const remove = fixture()
  const removable = await remove.service.create('space', { content: 'Giữ lại' })
  const removeActivityCount = remove.activities.length
  remove.revokeAtTransaction()
  await assert.rejects(() => remove.service.remove('space', removable.id, { expectedVersion: 1 }), { status: 403 })
  assert.equal(remove.notes[0].deletedAt, null)
  assert.equal(remove.notes[0].version, 1)
  assert.equal(remove.activities.length, removeActivityCount)
})
