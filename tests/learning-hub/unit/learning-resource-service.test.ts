/* eslint-disable @typescript-eslint/no-explicit-any -- Narrow in-memory Prisma mock. */
import assert from 'node:assert/strict'
import test from 'node:test'
import { AuthorizationError } from '../../../src/lib/server-authorization'
import { createLearningLink, deleteLearningLink } from '../../../src/lib/learning-resource-service'

function fixture() {
  let state: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE'
  let active = true
  let suspended = false
  let invalidate: 'MEMBERSHIP' | 'SUSPENSION' | 'ARCHIVE' | null = null
  const resource = { id: 'link', status: 'READY', deletedAt: null as Date | null }
  const created: any[] = []
  const activities: any[] = []
  const db: any = {
    learningSpaceMember: { findUnique: async () => {
      const snapshot = active ? { status: 'ACTIVE', user: { isSuspended: suspended }, learningSpace: { state } } : null
      if (invalidate === 'MEMBERSHIP') active = false
      if (invalidate === 'SUSPENSION') suspended = true
      if (invalidate === 'ARCHIVE') state = 'ARCHIVED'
      invalidate = null
      return snapshot
    } },
    booking: { findFirst: async () => null },
    learningTopic: { findFirst: async () => null },
    learningResource: {
      create: async ({ data }: any) => { const row = { id: `link-${created.length + 1}`, ...data }; created.push(row); return row },
      updateMany: async ({ data }: any) => {
        if (resource.status === 'DELETED') return { count: 0 }
        resource.status = data.status; resource.deletedAt = data.deletedAt
        return { count: 1 }
      },
    },
    learningActivity: {
      create: async ({ data }: any) => { activities.push(data); return data },
      upsert: async ({ create }: any) => { activities.push(create); return create },
    },
  }
  db.$transaction = async (run: (tx: typeof db) => Promise<unknown>) => run(db)
  const authorize = async () => {
    const member = await db.learningSpaceMember.findUnique()
    if (!member || member.status !== 'ACTIVE' || member.user.isSuspended) throw new AuthorizationError(403, 'Learning space membership required')
    if (member.learningSpace.state !== 'ACTIVE') throw new AuthorizationError(403, 'Archived learning spaces are read-only')
    return 'member'
  }
  return {
    resource, created, activities,
    create: () => createLearningLink('space', { title: 'Tài liệu', url: 'https://example.test/resource' }, { db, authorize } as never),
    remove: () => deleteLearningLink('space', 'link', { db, authorize } as never),
    revoke: () => { invalidate = 'MEMBERSHIP' },
    suspend: () => { invalidate = 'SUSPENSION' },
    archive: () => { invalidate = 'ARCHIVE' },
  }
}

test('LINK creation transaction guard rejects post-preflight eligibility changes without resource or activity', async () => {
  for (const change of ['revoke', 'suspend', 'archive'] as const) {
    const f = fixture()
    f[change]()
    await assert.rejects(f.create, { status: 403 })
    assert.deepEqual(f.created, [])
    assert.deepEqual(f.activities, [])
  }
})

test('LINK creation rechecks authorized eligibility and creates one redacted activity atomically', async () => {
  const f = fixture()
  const created = await f.create()
  assert.deepEqual(created, { id: 'link-1', status: 'READY' })
  assert.equal(f.created.length, 1)
  assert.deepEqual(f.activities, [{
    learningSpaceId: 'space', actorId: 'member', eventType: 'LEARNING_RESOURCE_CREATED', entityType: 'LearningResource',
    entityId: 'link-1', eventKey: 'learning-resource:link-1:created', metadata: { kind: 'LINK', status: 'READY' },
  }])
})

test('LINK deletion transaction guard rejects post-preflight membership and archive changes without activity', async () => {
  for (const change of ['revoke', 'archive'] as const) {
    const f = fixture()
    f[change]()
    await assert.rejects(f.remove, { status: 403 })
    assert.equal(f.resource.status, 'READY')
    assert.equal(f.resource.deletedAt, null)
    assert.deepEqual(f.activities, [])
  }
})

test('LINK deletion succeeds once and appends one event', async () => {
  const f = fixture()
  await f.remove()
  assert.equal(f.resource.status, 'DELETED')
  assert.equal(f.activities.length, 1)
  assert.equal(f.activities[0].eventType, 'LEARNING_RESOURCE_DELETED')
})
