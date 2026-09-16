import assert from 'node:assert/strict'

const routeModules = [
  ['../src/app/api/conversations/route', 'GET'],
  ['../src/app/api/messages/route', 'GET'],
  ['../src/app/api/cron/auto-complete/route', 'GET'],
  ['../src/app/api/cron/reminders/route', 'GET'],
  ['../src/app/api/cron/review-deadlines/route', 'GET'],
  ['../src/app/api/pusher/auth/route', 'POST'],
] as const

async function main() {
  for (const [modulePath, method] of routeModules) {
    const route = await import(modulePath)
    assert.equal(typeof route[method], 'function', `${modulePath} must export ${method}`)
  }

  // This suite never loads dotenv or invokes Prisma. Future database tests must
  // use an explicit disposable URL, never DATABASE_URL.
  console.log('PASS: route imports: conversations, messages, Pusher auth, and cron routes.')
  console.log('Prerequisites (values are never printed): Node.js; installed dependencies; optional DISPOSABLE_TEST_DATABASE_URL for future database tests.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
