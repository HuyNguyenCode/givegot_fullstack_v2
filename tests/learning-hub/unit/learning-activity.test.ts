import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { activityLabels, LearningActivity } from '../../../src/components/learning/LearningActivity'
import assert from 'node:assert/strict'
import test from 'node:test'
import { appendLearningActivity, createLearningActivityService, safeActivityMetadata, activityActorName, activityCursor } from '../../../src/lib/learning-activity-service'

type Row = { id: string; learningSpaceId: string; eventType: string; entityType: string; entityId: string | null; actorId: string | null; occurredAt: Date; metadata: Record<string, unknown>; eventKey: string }
function fixture() {
  const rows: Row[] = []
  let actor = 'a'
  let archived = false
  const db = {
    learningSpaceMember: { findUnique: async ({ where }: { where: { learningSpaceId_userId: { userId: string } } }) => ['a', 'b'].includes(where.learningSpaceId_userId.userId) ? { status: 'ACTIVE', user: { isSuspended: false }, learningSpace: { state: archived ? 'ARCHIVED' : 'ACTIVE' } } : null },
    learningActivity: {
      upsert: async ({ where, create }: { where: { eventKey: string }; create: Omit<Row, 'id'> }) => {
        const previous = rows.find(row => row.eventKey === where.eventKey)
        if (previous) return previous
        const row = { ...create, id: String(rows.length + 1).padStart(3, '0'), occurredAt: create.occurredAt ?? new Date('2030-01-01T00:00:00Z') } as Row
        rows.push(row); return row
      },
      findMany: async ({ where, take }: { where: { learningSpaceId: string; OR?: Array<Record<string, unknown>> }; take: number }) => {
        const sorted = rows.filter(row => row.learningSpaceId === where.learningSpaceId).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime() || b.id.localeCompare(a.id))
        const cursor = where.OR
        return sorted.filter(row => !cursor || row.occurredAt < (cursor[0].occurredAt as { lt: Date }).lt || row.occurredAt.getTime() === (cursor[1].occurredAt as Date).getTime() && row.id < (cursor[1].id as { lt: string }).lt).slice(0, take).map(row => ({ ...row, actor: row.actorId === 'a' ? { name: 'Nguyễn Văn A' } : row.actorId === 'b' ? { name: 'Trần Thị B' } : null }))
      },
    },
  }
  const service = createLearningActivityService({ db: db as never, actor: async () => ({ id: actor, email: null, name: null }) })
  return { db, service, rows, setActor: (id: string) => { actor = id }, archive: () => { archived = true } }
}
const event = (key: string, occurredAt = new Date('2030-01-01T00:00:00Z')) => ({ learningSpaceId: 'space', actorId: 'a', eventType: 'LEARNING_RESOURCE_CREATED', entityType: 'LearningResource', entityId: key, eventKey: key, occurredAt, metadata: { kind: 'LINK', chat: 'full conversation', content: 'private note', feedback: 'private review', storageKey: 'secret', signedUrl: 'secret' } })

test('event creation, retry and repeated provider webhook dedupe by eventKey', async () => {
  const f = fixture()
  await appendLearningActivity(f.db as never, event('provider:delivery:42'))
  await appendLearningActivity(f.db as never, event('provider:delivery:42'))
  assert.equal(f.rows.length, 1)
  assert.equal(f.rows[0].eventType, 'LEARNING_RESOURCE_CREATED')
  assert.equal(f.rows[0].actorId, 'a')
  assert.deepEqual(f.rows[0].metadata, { kind: 'LINK' })
})
test('activity events include actor names and safe fallbacks', async () => {
  const f = fixture()
  await appendLearningActivity(f.db as never, event('actor-a'))
  await appendLearningActivity(f.db as never, { ...event('actor-b'), actorId: 'b' })
  await appendLearningActivity(f.db as never, { ...event('deleted-actor'), actorId: 'deleted' })
  await appendLearningActivity(f.db as never, { ...event('system-event'), actorId: null })
  const names = (await f.service.list('space')).events.map(row => row.actorName)
  assert.deepEqual(names, ['Hệ thống', 'Thành viên GiveGot', 'Trần Thị B', 'Nguyễn Văn A'])
  assert.equal(activityActorName('a', { name: ' Nguyễn Văn A ' }), 'Nguyễn Văn A')
})
test('ordering and pagination boundary use timestamp plus id, with no duplicates', async () => {
  const f = fixture()
  for (let n = 0; n < 22; n++) await appendLearningActivity(f.db as never, event('e' + n))
  const first = await f.service.list('space')
  assert.equal(first.events.length, 20)
  assert.ok(first.nextCursor)
  const second = await f.service.list('space', first.nextCursor)
  assert.equal(second.events.length, 2)
  assert.equal(second.nextCursor, null)
  assert.equal(new Set([...first.events, ...second.events].map(row => row.id)).size, 22)
  assert.equal(first.events[0].id, '022')
  assert.equal(activityCursor({ id: '003', occurredAt: new Date('2030-01-01T00:00:00Z') }).length > 0, true)
  await assert.rejects(() => f.service.list('space', 'bad'), { status: 400 })
})
test('redaction, deleted entities, archived history and nonmember access', async () => {
  const f = fixture()
  await appendLearningActivity(f.db as never, event('deleted-resource'))
  f.rows[0].metadata = { kind: 'FILE', content: 'secret note', feedback: 'secret review', url: 'https://private.example', revisionCount: 2 }
  const before = await f.service.list('space')
  assert.equal(before.events[0].entityId, 'deleted-resource')
  assert.deepEqual(before.events[0].metadata, { kind: 'FILE', revisionCount: 2 })
  f.archive()
  assert.equal((await f.service.list('space')).events.length, 1)
  f.setActor('outsider')
  await assert.rejects(() => f.service.list('space'), { status: 403 })
  assert.deepEqual(safeActivityMetadata({ message: 'full chat', note: 'private', title: 'sensitive', outcome: 'REVIEWED' }), { outcome: 'REVIEWED' })
})

test('mobile timeline has loading and compact controls without sidebar', () => { const html = renderToStaticMarkup(createElement(LearningActivity, { spaceId: 'space' })); assert.match(html, /Đang tải hoạt động/); assert.match(html, /sm:p-5/); assert.doesNotMatch(html, /<aside/); })


test('space detail event uses the Vietnamese activity label', () => {
  assert.equal(activityLabels.LEARNING_SPACE_DETAILS_UPDATED, 'Đã cập nhật thông tin không gian học tập')
})
