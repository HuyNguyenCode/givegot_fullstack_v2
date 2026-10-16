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
  const notes: Array<Record<string, any>> = []
  const db = {
    learningSpaceMember: { findUnique: async ({ where }: any) => ['member-a', 'member-b'].includes(where.learningSpaceId_userId.userId) ? { status: 'ACTIVE', learningSpace: { state }, user: { isSuspended: false } } : null },
    booking: { findFirst: async ({ where }: any) => where.id === 'booking-a' && where.learningSpaceId === 'space' ? { mentorId: 'member-a', menteeId: 'member-b' } : where.id === 'booking-other' && where.learningSpaceId === 'space' ? { mentorId: 'other-a', menteeId: 'other-b' } : null },
    learningNote: {
      create: async ({ data }: any) => { const row = { id: String(notes.length + 1), ...data, version: 1, deletedAt: null, deletedById: null, createdAt: new Date(), updatedAt: new Date(), author: { name: data.authorId } }; notes.push(row); return row },
      findMany: async ({ where }: any) => notes.filter(n => n.learningSpaceId === where.learningSpaceId && !n.deletedAt),
      findFirst: async ({ where }: any) => notes.find(n => n.id === where.id && n.learningSpaceId === where.learningSpaceId) ?? null,
      updateMany: async ({ where, data }: any) => { const n = notes.find(n => n.id === where.id && n.version === where.version && !n.deletedAt); if (!n) return { count: 0 }; Object.assign(n, data); n.version = where.version + 1; n.updatedAt = new Date(); return { count: 1 } },
      findUniqueOrThrow: async ({ where }: any) => notes.find(n => n.id === where.id),
    },
  }
  const service = createLearningNoteService({ db: db as never, actor: async () => ({ id: actorId, email: null, name: null }), now: () => new Date('2030-01-01T00:00:00Z') })
  return { service, actor: (value: string) => { actorId = value }, archive: () => { state = 'ARCHIVED' }, notes }
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