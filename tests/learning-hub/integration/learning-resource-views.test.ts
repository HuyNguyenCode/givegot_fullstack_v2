import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { createLearningResourceHandlers } from '../../../src/lib/learning-resource-route-handlers'
import { listLearningResources } from '../../../src/lib/learning-resource-service'
import { AuthorizationError } from '../../../src/lib/server-authorization'

type ReadDependencies = NonNullable<Parameters<typeof listLearningResources>[2]>
type Purpose = 'MATERIAL' | 'SUBMISSION_ATTACHMENT' | 'LEGACY_UNCLASSIFIED'
type Status = 'PENDING' | 'READY' | 'QUARANTINED' | 'DELETED'
type Row = {
  id: string; learningSpaceId: string; bookingId: string | null; topicId: string | null
  uploaderId: string; kind: 'FILE' | 'LINK'; title: string; description: string | null
  externalUrl: string | null; mimeType: string | null; sizeBytes: bigint | null
  status: Status; purpose: Purpose; deletedAt: Date | null; createdAt: Date
  uploader: { name: string; email: string }; topic: { label: string } | null
  storageKey: string; signedUrl: string
}
const date = (day: number) => new Date(Date.UTC(2030, 0, day))
const row = (id: string, purpose: Purpose, status: Status, kind: Row['kind'] = 'FILE', day = 1): Row => ({
  id, learningSpaceId: 'space', bookingId: null, topicId: null, uploaderId: 'actor',
  kind, title: id, description: null, externalUrl: kind === 'LINK' ? 'https://example.com' : null,
  mimeType: kind === 'FILE' ? 'application/pdf' : null, sizeBytes: kind === 'FILE' ? BigInt(10) : null,
  status, purpose, deletedAt: status === 'DELETED' ? date(day) : null, createdAt: date(day),
  uploader: { name: 'Actor', email: 'actor@example.com' }, topic: null,
  storageKey: 'private/provider/key', signedUrl: 'https://private.example.com/signed',
})
const rows: Row[] = [
  row('material', 'MATERIAL', 'READY', 'FILE', 1),
  row('attachment', 'SUBMISSION_ATTACHMENT', 'READY', 'FILE', 3),
  row('legacy', 'LEGACY_UNCLASSIFIED', 'READY', 'FILE', 2),
  row('link', 'MATERIAL', 'READY', 'LINK', 4),
  row('pending', 'MATERIAL', 'PENDING', 'FILE', 5),
  row('quarantined', 'LEGACY_UNCLASSIFIED', 'QUARANTINED', 'FILE', 6),
  row('deleted', 'MATERIAL', 'DELETED', 'FILE', 7),
  row('other-space', 'MATERIAL', 'READY', 'FILE', 8),
]
rows[7].learningSpaceId = 'other-space'

function fixture(authorized = true) {
  const findQueries: Array<{ where: Record<string, unknown>; orderBy: unknown; select: Record<string, unknown> }> = []
  const aggregateQueries: Array<{ where: Record<string, unknown> }> = []
  const resource = {
    findMany: async (args: { where: Record<string, unknown>; orderBy: { createdAt: string }; select: Record<string, unknown> }) => {
      findQueries.push(args)
      const status = args.where.status as Status | { in: Status[] }
      const purposes = (args.where.purpose as { in: Purpose[] } | undefined)?.in
      return rows.filter(item =>
        item.learningSpaceId === args.where.learningSpaceId &&
        (typeof status === 'string' ? item.status === status : status.in.includes(item.status)) &&
        (!purposes || purposes.includes(item.purpose)) &&
        (!args.where.kind || item.kind === args.where.kind) &&
        (!Object.hasOwn(args.where, 'deletedAt') || item.deletedAt === args.where.deletedAt)
      ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    },
    aggregate: async (args: { where: Record<string, unknown> }) => {
      aggregateQueries.push(args)
      return { _sum: { sizeBytes: BigInt(50) } }
    },
  } as unknown as ReadDependencies['resource']
  const dependencies: ReadDependencies = {
    authorize: async () => {
      if (!authorized) throw new AuthorizationError(403, 'Learning space membership required')
      return 'actor'
    },
    resource,
  }
  return { dependencies, findQueries, aggregateQueries }
}
const ids = (result: Awaited<ReturnType<typeof listLearningResources>>) => result.resources.map(item => item.id)

test('omitted view preserves all purposes, visible statuses, ordering, quota, and private response shape', async () => {
  const f = fixture()
  const result = await listLearningResources('space', undefined, f.dependencies)
  assert.deepEqual(ids(result), ['quarantined', 'pending', 'link', 'attachment', 'legacy', 'material'])
  assert.deepEqual(f.findQueries[0].where, { learningSpaceId: 'space', status: { in: ['PENDING', 'READY', 'QUARANTINED'] } })
  assert.deepEqual(f.findQueries[0].orderBy, { createdAt: 'desc' })
  assert.equal(f.findQueries[0].select.purpose, undefined)
  assert.equal(f.findQueries[0].select.storageKey, undefined)
  assert.equal(result.quota.usedBytes, '50')
  assert.doesNotMatch(JSON.stringify(result), /purpose|storageKey|signedUrl|private\/provider|private\.example/)
})

test('materials view includes MATERIAL and legacy rows in existing statuses, excluding submissions', async () => {
  const f = fixture()
  const result = await listLearningResources('space', 'materials', f.dependencies)
  assert.deepEqual(ids(result), ['quarantined', 'pending', 'link', 'legacy', 'material'])
  assert.deepEqual(f.findQueries[0].where, {
    learningSpaceId: 'space', status: { in: ['PENDING', 'READY', 'QUARANTINED'] },
    purpose: { in: ['MATERIAL', 'LEGACY_UNCLASSIFIED'] },
  })
  assert.deepEqual(f.findQueries[0].orderBy, { createdAt: 'desc' })
  assert.equal(result.quota.usedBytes, '50')
})

test('ready-files includes READY FILE rows of every purpose and excludes links, pending, quarantined, and deleted rows', async () => {
  const f = fixture()
  const result = await listLearningResources('space', 'ready-files', f.dependencies)
  assert.deepEqual(ids(result), ['attachment', 'legacy', 'material'])
  assert.deepEqual(f.findQueries[0].where, {
    learningSpaceId: 'space', status: 'READY', kind: 'FILE', deletedAt: null,
  })
  assert.deepEqual(f.findQueries[0].orderBy, { createdAt: 'desc' })
  assert.equal(result.quota.usedBytes, '50')
})

test('quota query stays identical across all views and counts full-space FILE usage', async () => {
  const f = fixture()
  await listLearningResources('space', undefined, f.dependencies)
  await listLearningResources('space', 'materials', f.dependencies)
  await listLearningResources('space', 'ready-files', f.dependencies)
  assert.equal(f.aggregateQueries.length, 3)
  for (const query of f.aggregateQueries) assert.deepEqual(query.where, {
    learningSpaceId: 'space', kind: 'FILE', status: { in: ['PENDING', 'READY', 'QUARANTINED'] },
  })
})

test('invalid views use F2 HTTP 400 error style; unauthorized reads query no resources', async () => {
  const f = fixture()
  const handlers = createLearningResourceHandlers((spaceId, view) => listLearningResources(spaceId, view, f.dependencies))
  const context = { params: Promise.resolve({ spaceId: 'space' }) }
  for (const view of ['', 'unknown', 'MATERIAL', 'ready-files,materials']) {
    const response = await handlers.GET(new NextRequest(`http://local/api/learning/spaces/space/resources?view=${encodeURIComponent(view)}`), context)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid view' })
  }
  assert.equal(f.findQueries.length, 0)
  assert.equal(f.aggregateQueries.length, 0)
  const unauthorized = fixture(false)
  const denied = createLearningResourceHandlers((spaceId, view) => listLearningResources(spaceId, view, unauthorized.dependencies))
  const response = await denied.GET(new NextRequest('http://local/api/learning/spaces/space/resources?view=materials'), context)
  assert.equal(response.status, 403)
  assert.equal(unauthorized.findQueries.length, 0)
  assert.equal(unauthorized.aggregateQueries.length, 0)
})

test('GET passes optional view through and omitted GET keeps the existing service caller valid', async () => {
  const calls: Array<[string, string | undefined]> = []
  const handlers = createLearningResourceHandlers(async (spaceId, view) => {
    calls.push([spaceId, view])
    return { resources: [], quota: { usedBytes: '0', maxBytes: '1' } }
  })
  const context = { params: Promise.resolve({ spaceId: 'space' }) }
  for (const suffix of ['', '?view=materials', '?view=ready-files']) {
    const response = await handlers.GET(new NextRequest(`http://local/api/learning/spaces/space/resources${suffix}`), context)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
  }
  assert.deepEqual(calls, [['space', undefined], ['space', 'materials'], ['space', 'ready-files']])
})