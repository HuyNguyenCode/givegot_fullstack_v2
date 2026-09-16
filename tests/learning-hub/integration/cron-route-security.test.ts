import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { createAutoCompleteRouteHandler } from '../../../src/app/api/cron/auto-complete/route'
import { authorizeCronRequest } from '../../../src/lib/cron-auth'

type Dependencies = Parameters<typeof createAutoCompleteRouteHandler>[0]

function createHandler(cronSecret: string | undefined) {
  let queried = false
  const handler = createAutoCompleteRouteHandler({
    prisma: {
      booking: {
        findMany: async () => {
          queried = true
          return []
        },
      },
    } as unknown as Dependencies['prisma'],
    createNotification: async () => {},
    authorizeCronRequest: (request) => authorizeCronRequest(request, {
      nodeEnv: 'production',
      cronSecret,
    }),
  })

  return { handler, wasQueried: () => queried }
}

function request(authorization?: string) {
  return new NextRequest('http://local/api/cron/auto-complete', {
    headers: authorization ? { authorization } : undefined,
  })
}

test('auto-complete rejects missing or invalid cron authentication before data access', async () => {
  const missingSecret = createHandler(undefined)
  const missingResponse = await missingSecret.handler(request())
  assert.equal(missingResponse.status, 500)
  assert.equal(missingSecret.wasQueried(), false)

  const invalidSecret = createHandler('cron-secret-value')
  const invalidResponse = await invalidSecret.handler(request('Bearer wrong'))
  assert.equal(invalidResponse.status, 401)
  assert.equal(invalidSecret.wasQueried(), false)
})

test('auto-complete accepts a valid cron request without changing its empty-batch behavior', async () => {
  const validSecret = createHandler('cron-secret-value')
  const response = await validSecret.handler(request('Bearer cron-secret-value'))
  const payload = await response.json() as { ok: boolean; processed: number }

  assert.equal(response.status, 200)
  assert.equal(validSecret.wasQueried(), true)
  assert.deepEqual(payload, {
    ok: true,
    processed: 0,
    message: 'Không có booking nào cần chốt sổ.',
  })
})
