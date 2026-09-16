import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const baselineSql = path.join(repositoryRoot, 'tests', 'learning-hub', 'fixtures', 'pre-b1-legacy-schema.sql')
const legacyRowsSql = path.join(repositoryRoot, 'tests', 'learning-hub', 'fixtures', 'representative-legacy-bookings.sql')
const migrationSql = path.join(repositoryRoot, 'prisma', 'migrations-manual', '004_learning_hub_domain_schema.sql')
const rollbackSql = path.join(repositoryRoot, 'prisma', 'migrations-manual', '004_learning_hub_domain_schema.rollback.sql')

const expectedBookingStatuses = ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'MISSED', 'DISPUTED']
const learningTables = [
  'LearningSpace',
  'LearningSpaceMember',
  'LearningTopic',
  'LearningInvite',
  'LearningResource',
  'LearningTask',
  'Submission',
  'SubmissionReview',
  'LearningNote',
  'LearningActivity',
]
const bookingColumns = [
  'learningSpaceId',
  'topicId',
  'learningMode',
  'objective',
  'definitionOfDone',
  'fulfillmentStatus',
  'deliveredAt',
  'acceptedAt',
]

function requireDisposableDatabaseUrl(): string {
  const value = process.env.DISPOSABLE_TEST_DATABASE_URL
  assert.ok(value, 'DISPOSABLE_TEST_DATABASE_URL is required; shared DATABASE_URL values are never used')

  const parsed = new URL(value)
  assert.ok(
    ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname),
    'Task B1 migration verification only accepts a local disposable PostgreSQL endpoint',
  )
  return value
}

function urlForSchema(baseUrl: string, schema: string): string {
  const parsed = new URL(baseUrl)
  parsed.searchParams.set('schema', schema)
  return parsed.toString()
}

function runSqlFile(databaseUrl: string, file: string): void {
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx'
  const result = spawnSync(executable, ['prisma', 'db', 'execute', '--url', databaseUrl, '--file', file], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, DATABASE_URL: databaseUrl, DIRECT_URL: databaseUrl },
  })

  assert.equal(result.status, 0, `SQL application failed for ${path.basename(file)}`)
}

function safeSchemaName(prefix: string): string {
  const name = `${prefix}_${process.pid}_${Date.now()}`.toLowerCase()
  assert.match(name, /^[a-z][a-z0-9_]+$/)
  return name
}

function quoteIdentifier(identifier: string): string {
  assert.match(identifier, /^[a-z][a-z0-9_]+$/)
  return `"${identifier}"`
}

async function withClient<T>(databaseUrl: string, action: (client: PrismaClient) => Promise<T>): Promise<T> {
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
  try {
    return await action(client)
  } finally {
    await client.$disconnect()
  }
}

async function enumLabels(client: PrismaClient): Promise<string[]> {
  const rows = await client.$queryRawUnsafe<Array<{ enumlabel: string }>>(`
    SELECT e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = current_schema() AND t.typname = 'BookingStatus'
    ORDER BY e.enumsortorder
  `)
  return rows.map((row) => row.enumlabel)
}

async function matchingObjectCount(client: PrismaClient, kind: 'tables' | 'columns'): Promise<number> {
  const values = kind === 'tables' ? learningTables : bookingColumns
  const valueList = values.map((value) => `'${value}'`).join(', ')
  const rows = kind === 'tables'
    ? await client.$queryRawUnsafe<Array<{ count: number }>>(`
        SELECT COUNT(*)::int AS count
        FROM information_schema.tables
        WHERE table_schema = current_schema() AND table_name IN (${valueList})
      `)
    : await client.$queryRawUnsafe<Array<{ count: number }>>(`
        SELECT COUNT(*)::int AS count
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'Booking'
          AND column_name IN (${valueList})
      `)
  return Number(rows[0]?.count ?? 0)
}

async function verifyCleanPath(databaseUrl: string): Promise<void> {
  await withClient(databaseUrl, async (client) => {
    assert.equal(await matchingObjectCount(client, 'tables'), learningTables.length)
    assert.equal(await matchingObjectCount(client, 'columns'), bookingColumns.length)
    assert.deepEqual(await enumLabels(client), expectedBookingStatuses)

    const rows = await client.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT COUNT(*)::int AS count FROM "Booking"',
    )
    assert.equal(Number(rows[0]?.count ?? -1), 0)
  })
}

async function verifyLegacyPath(databaseUrl: string): Promise<void> {
  await withClient(databaseUrl, async (client) => {
    const rows = await client.$queryRawUnsafe<Array<{
      id: string
      status: string
      note: string | null
      meetingUrl: string | null
    }>>(`
      SELECT "id", "status"::text, "note", "meetingUrl"
      FROM "Booking"
      WHERE "mentorId" = 'legacy-mentor' AND "menteeId" = 'legacy-mentee'
      ORDER BY "startTime"
    `)
    assert.equal(rows.length, expectedBookingStatuses.length)
    assert.deepEqual(rows.map((row) => row.status), expectedBookingStatuses)
    assert.equal(rows[1]?.meetingUrl, 'https://meet.example.test/confirmed')
    assert.equal(rows[3]?.note, 'cancelled note')

    const nullRows = await client.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM "Booking"
      WHERE "learningSpaceId" IS NULL
        AND "topicId" IS NULL
        AND "learningMode" IS NULL
        AND "objective" IS NULL
        AND "definitionOfDone" IS NULL
        AND "fulfillmentStatus" IS NULL
        AND "deliveredAt" IS NULL
        AND "acceptedAt" IS NULL
    `)
    assert.equal(Number(nullRows[0]?.count ?? -1), expectedBookingStatuses.length)
    assert.deepEqual(await enumLabels(client), expectedBookingStatuses)

    await client.$executeRawUnsafe(`
      INSERT INTO "LearningSpace" ("id", "title", "primarySkillId", "createdById") VALUES
        ('space-one', 'First learning phase', 'legacy-skill', 'legacy-mentor'),
        ('space-two', 'Separate learning phase', 'legacy-skill', 'legacy-mentor')
    `)
    await client.$executeRawUnsafe(`
      INSERT INTO "LearningSpaceMember" ("learningSpaceId", "userId") VALUES
        ('space-one', 'legacy-mentor'),
        ('space-one', 'legacy-mentee'),
        ('space-two', 'legacy-mentor'),
        ('space-two', 'legacy-mentee')
    `)
    await client.$executeRawUnsafe(`
      UPDATE "LearningSpace"
      SET "state" = 'ARCHIVED', "archivedAt" = CURRENT_TIMESTAMP
      WHERE "id" = 'space-two'
    `)
    await client.$executeRawUnsafe(`
      INSERT INTO "LearningTopic" (
        "id", "learningSpaceId", "label", "normalizedLabel", "state", "creatorId", "provenance", "archivedAt"
      ) VALUES (
        'archived-topic', 'space-two', 'Historical topic', 'historical topic', 'ARCHIVED',
        'legacy-mentee', 'USER_CREATED', CURRENT_TIMESTAMP
      )
    `)

    const pairSpaces = await client.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM "LearningSpace" s
      JOIN "LearningSpaceMember" mentor
        ON mentor."learningSpaceId" = s."id" AND mentor."userId" = 'legacy-mentor'
      JOIN "LearningSpaceMember" mentee
        ON mentee."learningSpaceId" = s."id" AND mentee."userId" = 'legacy-mentee'
      WHERE s."primarySkillId" = 'legacy-skill'
    `)
    assert.equal(Number(pairSpaces[0]?.count ?? -1), 2)

    const archivedRows = await client.$queryRawUnsafe<Array<{ count: number }>>(`
      SELECT COUNT(*)::int AS count
      FROM "LearningSpace" s
      JOIN "LearningTopic" t ON t."learningSpaceId" = s."id"
      WHERE s."state" = 'ARCHIVED' AND t."state" = 'ARCHIVED'
    `)
    assert.equal(Number(archivedRows[0]?.count ?? -1), 1)

    const skillRows = await client.$queryRawUnsafe<Array<{ count: number }>>(
      'SELECT COUNT(*)::int AS count FROM "Skill"',
    )
    assert.equal(Number(skillRows[0]?.count ?? -1), 1, 'free-form topics must not auto-publish Skill rows')
  })
}

async function verifyRollback(databaseUrl: string): Promise<void> {
  await withClient(databaseUrl, async (client) => {
    assert.equal(await matchingObjectCount(client, 'tables'), 0)
    assert.equal(await matchingObjectCount(client, 'columns'), 0)
    assert.deepEqual(await enumLabels(client), expectedBookingStatuses)
  })
}

async function main(): Promise<void> {
  const baseUrl = requireDisposableDatabaseUrl()
  const cleanSchema = safeSchemaName('b1_clean')
  const legacySchema = safeSchemaName('b1_legacy')
  const schemas = [cleanSchema, legacySchema]

  const admin = new PrismaClient({ datasources: { db: { url: baseUrl } } })
  try {
    for (const schema of schemas) {
      await admin.$executeRawUnsafe(`CREATE SCHEMA ${quoteIdentifier(schema)}`)
    }

    const cleanUrl = urlForSchema(baseUrl, cleanSchema)
    const legacyUrl = urlForSchema(baseUrl, legacySchema)

    runSqlFile(cleanUrl, baselineSql)
    runSqlFile(cleanUrl, migrationSql)
    await verifyCleanPath(cleanUrl)

    runSqlFile(legacyUrl, baselineSql)
    runSqlFile(legacyUrl, legacyRowsSql)
    runSqlFile(legacyUrl, migrationSql)
    await verifyLegacyPath(legacyUrl)

    runSqlFile(cleanUrl, rollbackSql)
    await verifyRollback(cleanUrl)

    console.log('PASS: B1 clean migration, representative legacy migration, legacy queries, invariants, and rollback rehearsal')
  } finally {
    for (const schema of schemas.reverse()) {
      try {
        await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`)
      } catch {
        // The disposable database is destroyed after the test; cleanup is best effort.
      }
    }
    await admin.$disconnect()
  }
}

await main()
