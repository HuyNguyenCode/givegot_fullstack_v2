import assert from 'node:assert/strict'

const legacyModules = [
  '../src/app/api/conversations/route',
  '../src/app/api/messages/route',
  '../src/app/api/cron/auto-complete/route',
] as const

async function main() {
  for (const modulePath of legacyModules) {
    const route = await import(modulePath)
    assert.equal(typeof route.GET, 'function', `${modulePath} must export GET`)
  }

  // This suite never loads dotenv or invokes Prisma. Future database tests must
  // use an explicit disposable URL, never DATABASE_URL.
  console.log('PASS: legacy route imports: conversations, messages, auto-complete.')
  console.log('Prerequisites (values are never printed): Node.js; installed dependencies; optional DISPOSABLE_TEST_DATABASE_URL for future database tests.')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
