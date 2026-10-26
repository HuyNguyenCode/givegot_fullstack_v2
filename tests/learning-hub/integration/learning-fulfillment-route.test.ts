import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { createLearningFulfillmentHandlers } from '../../../src/lib/learning-fulfillment-route-handlers'
import { LearningFulfillmentError, fulfillmentInput, type learningFulfillmentService } from '../../../src/lib/learning-fulfillment-service'
import { AuthorizationError } from '../../../src/lib/server-authorization'

test('fulfillment route forwards only space/booking targets and validated body to the service', async () => {
  const calls: unknown[] = []
  const handlers = createLearningFulfillmentHandlers({
    read: async (spaceId: string, bookingId: string) => { calls.push(['read', spaceId, bookingId]); return { bookingId, status: 'NOT_STARTED', version: 0, deliveredAt: null, acceptedAt: null } },
    transition: async (spaceId: string, bookingId: string, body: Record<string, unknown>) => { calls.push(['transition', spaceId, bookingId, body]); return { bookingId, status: 'IN_PROGRESS', version: 1, deliveredAt: null, acceptedAt: null } },
  } as typeof learningFulfillmentService)
  const context = { params: Promise.resolve({ spaceId: 'space', bookingId: 'booking' }) }
  const get = await handlers.GET(new NextRequest('http://localhost/api/learning/spaces/space/bookings/booking/fulfillment'), context)
  assert.equal(get.status, 200)
  assert.equal(get.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await get.json(), { bookingId: 'booking', status: 'NOT_STARTED', version: 0, deliveredAt: null, acceptedAt: null })
  const post = await handlers.POST(new NextRequest('http://localhost/api/learning/spaces/space/bookings/booking/fulfillment', { method: 'POST', body: JSON.stringify({ action: 'START', expectedVersion: 0 }) }), context)
  assert.equal(post.status, 200)
  assert.deepEqual(await post.json(), { bookingId: 'booking', status: 'IN_PROGRESS', version: 1, deliveredAt: null, acceptedAt: null })
  assert.deepEqual(calls, [['read', 'space', 'booking'], ['transition', 'space', 'booking', { action: 'START', expectedVersion: 0 }]])
})

test('fulfillment route rejects malformed JSON and maps service conflict without exposing internals', async () => {
  const handlers = createLearningFulfillmentHandlersForFailure()
  const context = { params: Promise.resolve({ spaceId: 'space', bookingId: 'booking' }) }
  const bad = await handlers.POST(new NextRequest('http://localhost/test', { method: 'POST', body: '{' }), context)
  assert.equal(bad.status, 400)
  const conflict = await handlers.POST(new NextRequest('http://localhost/test', { method: 'POST', body: '{}' }), context)
  assert.equal(conflict.status, 409)
  assert.equal((await conflict.json()).error, 'Fulfillment version conflict')
})

function createLearningFulfillmentHandlersForFailure() {
  return createLearningFulfillmentHandlers({
    read: async () => { throw new Error('unused') },
    transition: async () => { throw new LearningFulfillmentError(409, 'Fulfillment version conflict') },
  } as typeof learningFulfillmentService)
}

test('fulfillment route returns the exact validation and authorization JSON contracts', async () => {
  const handlers = createLearningFulfillmentHandlers({
    read: async () => { throw new AuthorizationError(403, 'Active learning space membership required') },
    transition: async (_spaceId: string, _bookingId: string, body: Record<string, unknown>) => {
      fulfillmentInput(body)
      throw new AuthorizationError(403, 'Active learning space membership required')
    },
  } as typeof learningFulfillmentService)
  const context = { params: Promise.resolve({ spaceId: 'space', bookingId: 'booking' }) }
  const url = 'http://localhost/api/learning/spaces/space/bookings/booking/fulfillment'
  const post = (body: unknown) => handlers.POST(new NextRequest(url, { method: 'POST', body: JSON.stringify(body) }), context)

  for (const [body, message] of [
    [{ action: 'START', expectedVersion: 0, fulfillmentStatus: 'ACCEPTED' }, 'Unsupported fulfillment field'],
    [{ action: 'BOGUS', expectedVersion: 0 }, 'Invalid fulfillment action'],
    [{ action: 'START', expectedVersion: '0' }, 'Invalid expectedVersion'],
  ] as const) {
    const response = await post(body)
    assert.equal(response.status, 400)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.deepEqual(await response.json(), { error: message })
  }

  const get = await handlers.GET(new NextRequest(url), context)
  assert.equal(get.status, 403)
  assert.deepEqual(await get.json(), { error: 'Active learning space membership required' })
  const deniedPost = await post({ action: 'START', expectedVersion: 0 })
  assert.equal(deniedPost.status, 403)
  assert.deepEqual(await deniedPost.json(), { error: 'Active learning space membership required' })
})
