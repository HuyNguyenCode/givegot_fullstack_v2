import assert from 'node:assert/strict'
import test from 'node:test'

test('legacy API route modules remain importable', async () => {
  const [conversations, messages, autoComplete, reminders, reviewDeadlines, pusherAuth] =
    await Promise.all([
      import('../../../src/app/api/conversations/route'),
      import('../../../src/app/api/messages/route'),
      import('../../../src/app/api/cron/auto-complete/route'),
      import('../../../src/app/api/cron/reminders/route'),
      import('../../../src/app/api/cron/review-deadlines/route'),
      import('../../../src/app/api/pusher/auth/route'),
    ])

  for (const route of [conversations, messages, autoComplete, reminders, reviewDeadlines]) {
    assert.equal(typeof route.GET, 'function')
  }
  assert.equal(typeof pusherAuth.POST, 'function')
})
