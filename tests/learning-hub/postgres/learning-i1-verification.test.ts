// Explicit disposable TEST runner. I1_POSTGRES_EXECUTE=1 is required for writes.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

const root = '/mnt/f/givegot/givegot-v2'
const files = ['prisma/schema.prisma', 'src/lib/learning-fulfillment-service.ts', 'src/lib/learning-activity-service.ts', 'tests/learning-hub/postgres/learning-i1-verification.test.ts']
const hash = (data: Buffer | string) => createHash('sha256').update(data).digest('hex')
for (const file of files) assert.equal(hash(readFileSync(file)), hash(readFileSync(resolve(root, file))), `Source parity: ${file}`)
assert.equal(readFileSync('prisma/schema.prisma', 'utf8').replace(/\s+/g, ''), readFileSync('node_modules/.prisma/client/schema.prisma', 'utf8').replace(/\s+/g, ''), 'Linux Prisma client schema stale')
console.log(JSON.stringify({ evidence: 'SOURCE_PARITY', files }))

const env = parse(readFileSync('.env'))
const testUrl = env.DISPOSABLE_TEST_DATABASE_URL
assert.ok(testUrl && process.env.I1_POSTGRES_EXECUTE === '1', 'Explicit disposable TEST execution required')
const target = (raw: string) => { const u = new URL(raw); return `${u.hostname}|${u.port}|${decodeURIComponent(u.username)}|${u.pathname}` }
assert.match(target(testUrl), /yxyipetjooqsysdhruut/)
for (const name of ['DATABASE_URL', 'DIRECT_URL']) if (env[name]) assert.notEqual(target(testUrl), target(env[name]), `${name} targets TEST`)
process.env.DATABASE_URL = testUrl

const db = new PrismaClient({ datasources: { db: { url: testUrl } } })
const marker = `i1-verify-${randomUUID()}`
const mentor = randomUUID(), mentee = randomUUID(), skill = randomUUID(), space = randomUUID()
const legacy = randomUUID(), linked = randomUUID(), fresh = randomUUID(), note = randomUUID()
const bookings = [legacy, linked, fresh]
const sql = readFileSync('prisma/migrations-manual/008_learning_fulfillment_state.sql', 'utf8')
assert.match(sql, /BEGIN;[\s\S]*ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'DISPUTED';[\s\S]*ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';[\s\S]*ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "fulfillmentVersion" INTEGER;[\s\S]*COMMIT;/)
const expectedMigration = [
  'ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS \'DISPUTED\'',
  'ALTER TYPE "FulfillmentStatus" ADD VALUE IF NOT EXISTS \'CANCELLED\'',
  'ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "fulfillmentVersion" INTEGER',
]
const statements = sql.split(';').map(x => x.trim()).filter(x => x.startsWith('ALTER '))
assert.deepEqual(statements, expectedMigration, 'Unexpected 008 migration statement')

type Shape = { column: boolean; disputed: boolean; cancelled: boolean }
async function shape(): Promise<Shape> {
  const rows = await db.$queryRaw<Shape[]>`SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Booking' AND column_name='fulfillmentVersion') AS column,
    EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='FulfillmentStatus' AND e.enumlabel='DISPUTED') AS disputed,
    EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='FulfillmentStatus' AND e.enumlabel='CANCELLED') AS cancelled`
  return rows[0]
}
async function apply008() {
  await db.$transaction(async tx => { for (const statement of statements) await tx.$executeRawUnsafe(statement) })
}
async function bookingRows() {
  return db.$queryRaw<Array<{ id: string; status: string; learningMode: string | null; fulfillmentStatus: string | null; fulfillmentVersion: number | null; deliveredAt: Date | null; acceptedAt: Date | null }>>`
    SELECT id, status::text, "learningMode"::text, "fulfillmentStatus"::text, "fulfillmentVersion", "deliveredAt", "acceptedAt" FROM "Booking" WHERE id IN (${legacy}, ${linked}, ${fresh}) ORDER BY id`
}
async function activity() {
  return db.$queryRaw<Array<{ eventKey: string; metadata: unknown }>>`SELECT "eventKey", metadata FROM "LearningActivity" WHERE "bookingId"=${linked} ORDER BY "eventKey"`
}
async function money() {
  const rows = await db.$queryRaw<Array<{ id: string; givePoints: number }>>`SELECT id, "givePoints" FROM "User" WHERE id IN (${mentor}, ${mentee}) ORDER BY id`
  const logs = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM "TransactionLog" WHERE "bookingId" IN (${legacy}, ${linked}, ${fresh})`
  return { users: rows, logCount: Number(logs[0].count) }
}
async function cleanup() {
  await db.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM "LearningActivity" WHERE "learningSpaceId"=${space}`
    await tx.$executeRaw`DELETE FROM "LearningNote" WHERE "learningSpaceId"=${space}`
    await tx.$executeRaw`DELETE FROM "Booking" WHERE id IN (${legacy}, ${linked}, ${fresh})`
    await tx.$executeRaw`DELETE FROM "LearningSpaceMember" WHERE "learningSpaceId"=${space}`
    await tx.$executeRaw`DELETE FROM "LearningSpace" WHERE id=${space}`
    await tx.$executeRaw`DELETE FROM "Skill" WHERE id=${skill}`
    await tx.$executeRaw`DELETE FROM "User" WHERE id IN (${mentor}, ${mentee})`
  })
  const rows = await db.$queryRaw<Array<{ n: bigint }>>`SELECT
    (SELECT count(*) FROM "Booking" WHERE id IN (${legacy}, ${linked}, ${fresh})) +
    (SELECT count(*) FROM "LearningActivity" WHERE "learningSpaceId"=${space}) +
    (SELECT count(*) FROM "LearningNote" WHERE "learningSpaceId"=${space}) +
    (SELECT count(*) FROM "LearningSpaceMember" WHERE "learningSpaceId"=${space}) +
    (SELECT count(*) FROM "LearningSpace" WHERE id=${space}) +
    (SELECT count(*) FROM "Skill" WHERE id=${skill}) +
    (SELECT count(*) FROM "User" WHERE id IN (${mentor}, ${mentee})) AS n`
  assert.equal(Number(rows[0].n), 0)
  console.log(JSON.stringify({ evidence: 'FIXTURE_CLEANUP', remaining: 0 }))
}
const settle = <T>(p: Promise<T>) => p.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, status: error?.status, code: error?.code, message: error?.message }))
function gate(client: PrismaClient) {
  let reach!: () => void, release!: () => void, armed = true
  const reached = new Promise<void>(r => { reach = r })
  const released = new Promise<void>(r => { release = r })
  let transaction = false, version: number | null = null
  client.$use(async (params, next) => {
    const row = await next(params)
    if (armed && params.model === 'Booking' && params.action === 'findFirst' && params.args?.where?.id === linked) {
      armed = false; transaction = !!params.runInTransaction; version = row?.fulfillmentVersion ?? null
      reach(); await released
    }
    return row
  })
  return { reached, release: () => release(), observed: () => ({ transaction, version }) }
}
async function bounded<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([p, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Timeout: ${label}`)), 15000) })]) }
  finally { if (timer) clearTimeout(timer) }
}

async function main() {
  let fixtures = false, migrated = false
  try {
    assert.deepEqual(await shape(), { column: false, disputed: false, cancelled: false }, '008 must be absent at start')
    const prerequisites = await db.$queryRaw<Array<{ m005: boolean; m006: boolean; m007: boolean }>>`SELECT
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='LearningTask' AND column_name='version') AS m005,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='LearningResource' AND column_name='purpose') AS m006,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='LearningNote' AND column_name='deletedAt') AS m007`
    assert.deepEqual(prerequisites[0], { m005: true, m006: true, m007: true })
    console.log(JSON.stringify({ evidence: 'PREREQUISITES', migrations: ['004', '005', '006', '007'], migration008: 'absent' }))

    await db.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO "User" (id,email,"createdAt","updatedAt") VALUES (${mentor},${`${marker}-mentor@example.invalid`},now(),now()),(${mentee},${`${marker}-mentee@example.invalid`},now(),now())`
      await tx.$executeRaw`INSERT INTO "Skill" (id,name,slug,"createdAt","updatedAt") VALUES (${skill},${marker},${marker},now(),now())`
      await tx.$executeRaw`INSERT INTO "LearningSpace" (id,title,"primarySkillId","createdById") VALUES (${space},${marker},${skill},${mentor})`
      await tx.$executeRaw`INSERT INTO "LearningSpaceMember" ("learningSpaceId","userId") VALUES (${space},${mentor}),(${space},${mentee})`
      await tx.$executeRaw`INSERT INTO "Booking" (id,"mentorId","menteeId","startTime","endTime",status) VALUES (${legacy},${mentor},${mentee},now()-interval '3 days',now()-interval '2 days','CONFIRMED')`
      await tx.$executeRaw`INSERT INTO "Booking" (id,"mentorId","menteeId","startTime","endTime",status,"learningSpaceId","learningMode",objective,"meetingUrl") VALUES (${linked},${mentor},${mentee},now()-interval '3 days',now()-interval '2 days','CONFIRMED',${space},'LIVE','Synthetic learning objective','https://meet.example.invalid/i1')`
      await tx.$executeRaw`INSERT INTO "LearningNote" (id,"learningSpaceId","bookingId","authorId",content,type) VALUES (${note},${space},${linked},${mentor},'Synthetic recap','RECAP')`
    })
    fixtures = true
    const before = await db.$queryRaw<Array<{ id: string; status: string; learningMode: string | null; fulfillmentStatus: string | null }>>`SELECT id,status::text,"learningMode"::text,"fulfillmentStatus"::text FROM "Booking" WHERE id IN (${legacy},${linked}) ORDER BY id`
    assert.equal(before.length, 2)
    assert.ok(before.every(r => r.status === 'CONFIRMED' && r.fulfillmentStatus === null))
    assert.equal(before.find(r => r.id === legacy)?.learningMode, null)
    assert.equal(before.find(r => r.id === linked)?.learningMode, 'LIVE')
    console.log(JSON.stringify({ evidence: 'PRE008_FIXTURES', legacy: true, linked: true, bookingStatus: 'CONFIRMED' }))

    await assert.rejects(db.$transaction(async tx => { await tx.$executeRawUnsafe(statements[0]); throw new Error('INJECTED_ABORT') }), /INJECTED_ABORT/)
    assert.deepEqual(await shape(), { column: false, disputed: false, cancelled: false }, 'Failed transaction mutated schema')
    console.log(JSON.stringify({ evidence: 'MIGRATION_FAILURE_ATOMICITY', pass: true }))

    await apply008(); migrated = true
    assert.deepEqual(await shape(), { column: true, disputed: true, cancelled: true })
    const column = await db.$queryRaw<Array<{ is_nullable: string; column_default: string | null; data_type: string }>>`SELECT is_nullable,column_default,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='Booking' AND column_name='fulfillmentVersion'`
    assert.deepEqual(column[0], { is_nullable: 'YES', column_default: null, data_type: 'integer' })
    const post = await bookingRows()
    assert.equal(post.length, 2)
    assert.ok(post.every(r => r.fulfillmentVersion === null && r.fulfillmentStatus === null && r.deliveredAt === null && r.acceptedAt === null && r.status === 'CONFIRMED'))
    const enumBooking = await db.$queryRaw<Array<{ enumlabel: string }>>`SELECT e.enumlabel FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='BookingStatus' ORDER BY e.enumsortorder`
    assert.deepEqual(enumBooking.map(r => r.enumlabel), ['PENDING','CONFIRMED','COMPLETED','CANCELLED','MISSED','DISPUTED'])
    console.log(JSON.stringify({ evidence: 'MIGRATION_FORWARD', nullableVersion: true, default: null, oldRowsPreserved: 2, bookingStatusUnchanged: true, backfill: false }))

    // Rollback guidance permits dropping the version column only before I1 writes and after export.
    const exportDigest = hash(JSON.stringify(post))
    assert.ok(post.every(r => r.fulfillmentVersion === null))
    await db.$executeRawUnsafe('ALTER TABLE "Booking" DROP COLUMN "fulfillmentVersion"')
    assert.deepEqual(await shape(), { column: false, disputed: true, cancelled: true })
    // Only schema-compatible raw SQL is used while the generated model has a removed column.
    const rolled = await db.$queryRaw<Array<{ id: string; status: string; fulfillmentStatus: string | null }>>`SELECT id,status::text,"fulfillmentStatus"::text FROM "Booking" WHERE id IN (${legacy},${linked}) ORDER BY id`
    assert.equal(rolled.length, 2)
    assert.ok(rolled.every(r => r.status === 'CONFIRMED' && r.fulfillmentStatus === null))
    await apply008()
    assert.equal(hash(JSON.stringify(await bookingRows())), exportDigest)
    console.log(JSON.stringify({ evidence: 'ROLLBACK_REHEARSAL', versionColumnDroppedBeforeWrites: true, enumLabelsRetained: true, fixturesPreserved: true, reforward: true }))

    await db.$executeRaw`INSERT INTO "Booking" (id,"mentorId","menteeId","startTime","endTime",status,"learningSpaceId","learningMode",objective,"meetingUrl","fulfillmentStatus","fulfillmentVersion") VALUES (${fresh},${mentor},${mentee},now()-interval '3 days',now()-interval '2 days','CONFIRMED',${space},'LIVE','Synthetic new booking','https://meet.example.invalid/new','NOT_STARTED',0)`
    const created = (await bookingRows()).find(r => r.id === fresh)!
    assert.equal(created.fulfillmentStatus, 'NOT_STARTED'); assert.equal(created.fulfillmentVersion, 0)
    console.log(JSON.stringify({ evidence: 'NEW_LINKED_BOOKING', status: created.fulfillmentStatus, version: created.fulfillmentVersion }))

    const { createLearningFulfillmentService } = await import('../../../src/lib/learning-fulfillment-service')
    const service = (client: PrismaClient, actorId: string) => createLearningFulfillmentService({ db: client as never, actor: (async () => ({ id: actorId })) as never, now: () => new Date() })
    const baselineMoney = await money()
    async function state(expectedStatus: string, expectedVersion: number, expectedActivity: number) {
      const row = (await bookingRows()).find(r => r.id === linked)!
      const events = await activity()
      assert.equal(row.status, 'CONFIRMED'); assert.equal(row.fulfillmentStatus, expectedStatus); assert.equal(row.fulfillmentVersion, expectedVersion)
      assert.equal(events.length, expectedActivity); assert.equal(new Set(events.map(e => e.eventKey)).size, events.length)
      assert.deepEqual(await money(), baselineMoney, 'GP or TransactionLog changed')
      return row
    }
    async function overlap(action: 'START' | 'DELIVER' | 'ACCEPT', version: number, actorId: string, finalStatus: string) {
      const ca = new PrismaClient({ datasources: { db: { url: testUrl } } }), cb = new PrismaClient({ datasources: { db: { url: testUrl } } })
      const ga = gate(ca), gb = gate(cb)
      let pa: ReturnType<typeof settle> | undefined, pb: ReturnType<typeof settle> | undefined
      try {
        await Promise.all([ca.$connect(), cb.$connect()])
        const started = await db.$queryRaw<Array<{ at: Date }>>`SELECT clock_timestamp() AS at`
        pa = settle(service(ca, actorId).transition(space, linked, { action, expectedVersion: version }))
        pb = settle(service(cb, actorId).transition(space, linked, { action, expectedVersion: version }))
        await bounded(Promise.all([ga.reached, gb.reached]), `${action} reads`)
        assert.deepEqual(ga.observed(), { transaction: true, version: version === 0 ? null : version })
        assert.deepEqual(gb.observed(), ga.observed())
        const active = await db.$queryRaw<Array<{ pid: number }>>`SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND state='idle in transaction' AND query LIKE '%"Booking"%' AND xact_start >= ${started[0].at}`
        assert.equal(new Set(active.map(r => r.pid)).size, 2, 'Two overlapping independent transactions not proven')
        ga.release(); gb.release()
        const outcomes = await Promise.all([pa, pb])
        assert.equal(outcomes.filter(x => x.ok).length, 1, `${action} exactly one winner`)
        const loser = outcomes.find(x => !x.ok)
        assert.ok(loser && !loser.ok)
        assert.equal(loser.status, 409, `${action} loser conflict`)
        await state(finalStatus, version + 1, version + 1)
        console.log(JSON.stringify({ evidence: 'REAL_CONCURRENCY', action, independentTransactions: 2, winners: 1, conflicts: 1, finalStatus, version: version + 1, auditEvents: version + 1 }))
      } finally {
        ga.release(); gb.release()
        await Promise.allSettled([pa, pb].filter(Boolean) as Promise<unknown>[])
        await Promise.all([ca.$disconnect(), cb.$disconnect()])
      }
    }

    await overlap('START', 0, mentor, 'IN_PROGRESS')
    const stale = await settle(service(db, mentor).transition(space, linked, { action: 'START', expectedVersion: 0 }))
    assert.equal(stale.ok, false)
    if (stale.ok) throw new Error('Stale START unexpectedly succeeded')
    assert.equal(stale.status, 409)
    await state('IN_PROGRESS', 1, 1)
    console.log(JSON.stringify({ evidence: 'STALE_VERSION_AND_REPLAY', rejected: true, auditEvents: 1 }))
    await overlap('DELIVER', 1, mentor, 'DELIVERED')
    const replayDeliver = await settle(service(db, mentor).transition(space, linked, { action: 'DELIVER', expectedVersion: 1 }))
    assert.equal(replayDeliver.ok, false)
    if (replayDeliver.ok) throw new Error('Repeated DELIVER unexpectedly succeeded')
    assert.equal(replayDeliver.status, 409)
    await state('DELIVERED', 2, 2)
    await overlap('ACCEPT', 2, mentee, 'ACCEPTED')
    const replayAccept = await settle(service(db, mentee).transition(space, linked, { action: 'ACCEPT', expectedVersion: 2 }))
    assert.equal(replayAccept.ok, false)
    if (replayAccept.ok) throw new Error('Repeated ACCEPT unexpectedly succeeded')
    assert.equal(replayAccept.status, 409)
    const final = await state('ACCEPTED', 3, 3)
    assert.ok(final.deliveredAt && final.acceptedAt)
    const nonNullVersions = await db.$queryRaw<Array<{ n: bigint }>>`SELECT count(*) AS n FROM "Booking" WHERE id=${linked} AND "fulfillmentVersion" IS NOT NULL`
    assert.equal(Number(nonNullVersions[0].n), 1)
    // The reviewed guidance refuses a destructive rollback once version writes exist.
    const rollbackAllowed = Number(nonNullVersions[0].n) === 0 && (await activity()).length === 0
    assert.equal(rollbackAllowed, false)
    assert.deepEqual(await shape(), { column: true, disputed: true, cancelled: true })
    await state('ACCEPTED', 3, 3)
    console.log(JSON.stringify({ evidence: 'ROLLBACK_REFUSAL', refusedAfterI1Writes: true, schemaAndDataPreserved: true }))
    console.log(JSON.stringify({ evidence: 'FINAL_ASSERTIONS', fulfilled: true, gpUnchanged: true, settlementConcurrencyClaimed: false }))
  } finally {
    if (fixtures) await cleanup()
    if (migrated) assert.deepEqual(await shape(), { column: true, disputed: true, cancelled: true }, 'Final 008 schema missing')
    await db.$disconnect()
  }
}
main().catch(error => { console.error('I1_VERIFICATION_FAILED', error?.code || error?.message || error?.name); process.exitCode = 1 })
