import assert from 'node:assert/strict'
import test from 'node:test'
import { createSpaceListingHandler } from '../../../src/lib/learning-space-listing-handler'
import { createSpaceListing } from '../../../src/lib/learning-space-listing'
import { AuthorizationError } from '../../../src/lib/server-authorization'

test('GET rejects unauthenticated requests before querying', async () => {
  let queried = false
  const handler = createSpaceListingHandler(createSpaceListing({ authenticate: async () => { throw new AuthorizationError(401, 'Authentication required') }, findAccount: async () => { throw new Error('unexpected account query') }, findSpaces: async () => { queried = true; return [] } }))
  assert.equal((await handler()).status, 401)
  assert.equal(queried, false)
})
test('GET uses session identity even when client supplies another userId', async () => {
  const spaces = [{ id: 'a', title: 'A', state: 'ACTIVE' as const, primarySkillName: 'Nói', partnerName: null }, { id: 'archived', title: 'Cũ', state: 'ARCHIVED' as const, primarySkillName: 'Viết', partnerName: null }]
  let identity = ''
  const handler = createSpaceListingHandler(createSpaceListing({ authenticate: async () => ({ id: 'user-a' }), findAccount: async () => ({ isSuspended: false, trustScore: 30 }), findSpaces: async id => { identity = id; return spaces } }))
  const response = await (handler as (request: Request) => Promise<Response>)(new Request('http://localhost/api/learning/spaces?userId=user-b'))
  assert.equal(identity, 'user-a')
  assert.deepEqual(await response.json(), { spaces })
  assert.equal(response.headers.get('cache-control'), 'private, no-store')
})

test('GET evaluates current account status before reading private spaces', async () => {
  const privateSpaces = [
    { id: 'active', title: 'Active', state: 'ACTIVE' as const, primarySkillName: 'Nói', partnerName: 'B' },
    { id: 'archived', title: 'Archived', state: 'ARCHIVED' as const, primarySkillName: 'Viết', partnerName: null },
  ]
  let account: { isSuspended: boolean; trustScore: number } | null = { isSuspended: false, trustScore: 30 }
  let reads = 0
  const accountLookups: string[] = []
  const handler = createSpaceListingHandler(createSpaceListing({
    authenticate: async () => ({ id: 'user-a' }),
    findAccount: async id => { accountLookups.push(id); return account },
    findSpaces: async id => { reads++; assert.equal(id, 'user-a'); return privateSpaces },
  }))

  const eligible = await handler()
  assert.equal(eligible.status, 200)
  assert.deepEqual(await eligible.json(), { spaces: privateSpaces })
  assert.equal(eligible.headers.get('cache-control'), 'private, no-store')
  assert.equal(reads, 1)

  for (const ineligible of [{ isSuspended: true, trustScore: 50 }, { isSuspended: false, trustScore: 29 }, null]) {
    account = ineligible
    const denied = await (handler as (request: Request) => Promise<Response>)(new Request('http://localhost/api/learning/spaces?userId=eligible-user'))
    assert.equal(denied.status, 403)
    assert.deepEqual(await denied.json(), { error: 'Account access required' })
    assert.equal(denied.headers.get('cache-control'), 'private, no-store')
    assert.equal(reads, 1, 'ineligible accounts must not trigger the listing query')
  }
  assert.deepEqual(accountLookups, ['user-a', 'user-a', 'user-a', 'user-a'])
})

test('eligible nonmember receives no other user spaces', async () => {
  const handler = createSpaceListingHandler(createSpaceListing({
    authenticate: async () => ({ id: 'user-c' }),
    findAccount: async id => { assert.equal(id, 'user-c'); return { isSuspended: false, trustScore: 50 } },
    findSpaces: async id => id === 'user-a' ? [{ id: 'private', title: 'Private', state: 'ACTIVE', primarySkillName: 'Nói', partnerName: null }] : [],
  }))
  const response = await (handler as (request: Request) => Promise<Response>)(new Request('http://localhost/api/learning/spaces?userId=user-a'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { spaces: [] })
})
