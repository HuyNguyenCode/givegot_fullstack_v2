import assert from 'node:assert/strict'
import test from 'node:test'

import { FIXED_NOW, authenticatedActor, fixedClock, prismaMock } from '../helpers'

test('fixedClock returns independent deterministic dates', () => {
  const clock = fixedClock()
  const first = clock.now()
  first.setUTCFullYear(1999)
  assert.equal(clock.now().toISOString(), FIXED_NOW.toISOString())
  assert.notEqual(clock.now(), first)
})

test('authenticatedActor is immutable and has no client-controlled identity fields', () => {
  const actor = authenticatedActor('server-session-user', 'ADMIN')
  assert.deepEqual(actor, { id: 'server-session-user', role: 'ADMIN' })
  assert.equal(Object.isFrozen(actor), true)
  assert.equal('userId' in actor, false)
})

test('prismaMock preserves explicitly supplied behavior without a database connection', async () => {
  const prisma = prismaMock({ learningSpace: { findUnique: async () => ({ id: 'space-1' }) } })
  assert.deepEqual(await prisma.learningSpace.findUnique(), { id: 'space-1' })
})
