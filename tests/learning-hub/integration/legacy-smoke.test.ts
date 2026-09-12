import assert from 'node:assert/strict'
import test from 'node:test'

test('legacy API route modules remain importable', async () => {
  const routes = await Promise.all([
    import('../../../src/app/api/conversations/route'),
    import('../../../src/app/api/messages/route'),
    import('../../../src/app/api/cron/auto-complete/route'),
  ])

  for (const route of routes) assert.equal(typeof route.GET, 'function')
})
