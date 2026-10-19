import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { createLearningActivityGet } from '../../../src/app/api/learning/spaces/[spaceId]/activity/route'
import { AuthorizationError } from '../../../src/lib/server-authorization'

const context = { params: Promise.resolve({ spaceId: 'space' }) }
test('activity route forwards cursor, prevents caching, and returns only service output', async () => {
  const calls: Array<[string, string | null]> = []
  const GET = createLearningActivityGet({ list: async (space: string, cursor: string | null) => { calls.push([space, cursor]); return { events: [{ id: 'activity-1', actorName: 'Nguyễn Văn A' }], nextCursor: null } } } as never)
  const response = await GET(new NextRequest('https://givegot.test/api/learning/spaces/space/activity?cursor=abc'), context)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await response.json(), { events: [{ id: 'activity-1', actorName: 'Nguyễn Văn A' }], nextCursor: null })
  assert.deepEqual(calls, [['space', 'abc']])
})
test('activity route denies nonmembers and redacts unexpected server errors', async () => {
  const denied = createLearningActivityGet({ list: async () => { throw new AuthorizationError(403, 'Learning space membership required') } } as never)
  assert.equal((await denied(new NextRequest('https://givegot.test/api/learning/spaces/space/activity'), context)).status, 403)
  const broken = createLearningActivityGet({ list: async () => { throw new Error('private feedback') } } as never)
  const response = await broken(new NextRequest('https://givegot.test/api/learning/spaces/space/activity'), context)
  assert.equal(response.status, 500)
  assert.doesNotMatch(await response.text(), /private feedback/)
})
