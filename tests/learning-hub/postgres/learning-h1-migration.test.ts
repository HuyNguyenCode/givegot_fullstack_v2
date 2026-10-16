import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

const sql = (file: string) => readFileSync(`prisma/migrations-manual/${file}`, 'utf8')
const forward = sql('007_learning_note_type_soft_delete.sql')
const rollback = sql('007_learning_note_type_soft_delete.rollback.sql')

function projectRef(raw: string) {
  const url = new URL(raw)
  return url.hostname.endsWith('.pooler.supabase.com')
    ? decodeURIComponent(url.username).split('.').at(-1)
    : /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1]
}

function apply(url: string, body: string) {
  try {
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'execute', '--stdin', '--url', url], {
      cwd: process.cwd(), input: body, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    })
    return true
  } catch { return false }
}

async function columns(db: PrismaClient) {
  return db.$queryRaw<Array<{ column_name: string; is_nullable: string; column_default: string | null }>>`
    SELECT column_name, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'LearningNote'
    ORDER BY ordinal_position`
}

async function cleanup(db: PrismaClient, values: { notes: string[]; booking: string; space: string; skill: string; users: string[] }) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM "LearningNote" WHERE id = ANY(${values.notes}::text[])`
    await tx.$executeRaw`DELETE FROM "Booking" WHERE id = ${values.booking}`
    await tx.$executeRaw`DELETE FROM "LearningSpaceMember" WHERE "learningSpaceId" = ${values.space}`
    await tx.$executeRaw`DELETE FROM "LearningSpace" WHERE id = ${values.space}`
    await tx.$executeRaw`DELETE FROM "Skill" WHERE id = ${values.skill}`
    await tx.$executeRaw`DELETE FROM "User" WHERE id = ANY(${values.users}::text[])`
  })
  const remaining = await Promise.all([
    db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "LearningNote" WHERE id = ANY(${values.notes}::text[])`,
    db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "Booking" WHERE id = ${values.booking}`,
    db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "LearningSpace" WHERE id = ${values.space}`,
    db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "Skill" WHERE id = ${values.skill}`,
    db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "User" WHERE id = ANY(${values.users}::text[])`,
  ])
  assert.ok(remaining.every(result => result[0].count === BigInt(0)), 'H1 run-owned fixture cleanup failed')
}

async function cleanupResidualFixtures(db: PrismaClient) {
  await db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`DELETE FROM "LearningNote" WHERE "learningSpaceId" IN (SELECT id FROM "LearningSpace" WHERE title LIKE 'h1-migration-%')`)
    await tx.$executeRawUnsafe(`DELETE FROM "Booking" WHERE "learningSpaceId" IN (SELECT id FROM "LearningSpace" WHERE title LIKE 'h1-migration-%')`)
    await tx.$executeRawUnsafe(`DELETE FROM "LearningSpaceMember" WHERE "learningSpaceId" IN (SELECT id FROM "LearningSpace" WHERE title LIKE 'h1-migration-%')`)
    await tx.$executeRawUnsafe(`DELETE FROM "LearningSpace" WHERE title LIKE 'h1-migration-%'`)
    await tx.$executeRawUnsafe(`DELETE FROM "Skill" WHERE name LIKE 'h1-migration-%'`)
    await tx.$executeRawUnsafe(`DELETE FROM "User" WHERE name LIKE 'h1-migration-%'`)
  })
}

async function main() {
  const env = parse(readFileSync('.env'))
  const testUrl = env.DISPOSABLE_TEST_DATABASE_URL
  assert.ok(testUrl && env.DATABASE_URL && env.DIRECT_URL, 'Required TEST/app URLs are absent')
  assert.notEqual(testUrl, env.DATABASE_URL, 'TEST URL must differ from DATABASE_URL')
  assert.notEqual(testUrl, env.DIRECT_URL, 'TEST URL must differ from DIRECT_URL')
  const testRef = projectRef(testUrl)
  assert.ok(testRef && testRef !== projectRef(env.DATABASE_URL) && testRef !== projectRef(env.DIRECT_URL), 'TEST project must differ from both application projects')
  const db = new PrismaClient({ datasources: { db: { url: testUrl } }, log: [] })
  const marker = `h1-migration-${randomUUID()}`
  let fixture: { notes: string[]; booking: string; space: string; skill: string; users: string[] } | undefined
  try {
    await db.$connect()
    await cleanupResidualFixtures(db)
    assert.deepEqual(await db.$queryRaw<Array<{ ok: number }>>`SELECT 1 AS ok`, [{ ok: 1 }])
    const beforeColumns = await columns(db)
    const required = ['id', 'learningSpaceId', 'bookingId', 'topicId', 'authorId', 'content', 'visibility', 'version', 'createdAt', 'updatedAt']
    assert.ok(required.every(name => beforeColumns.some(column => column.column_name === name)), 'Migration 007 prerequisite columns are missing')
    assert.ok(!beforeColumns.some(column => ['type', 'deletedAt', 'deletedById'].includes(column.column_name)), 'Migration 007 is already applied or TEST schema is not pre-H1')
    const visibility = await db.$queryRaw<Array<{ enumlabel: string }>>`SELECT enumlabel FROM pg_enum WHERE enumtypid = '"LearningNoteVisibility"'::regtype ORDER BY enumsortorder`
    assert.deepEqual(visibility.map(row => row.enumlabel), ['SPACE_MEMBERS', 'BOOKING_PARTICIPANTS', 'AUTHOR_ONLY'])
    console.log(JSON.stringify({ evidence: 'H1_PREFLIGHT_PASS', target: 'existing disposable TEST only', preH1: true, select1: true }))

    const [author, partner] = await Promise.all([
      db.user.create({ data: { email: `${marker}-author@example.invalid`, name: marker } }),
      db.user.create({ data: { email: `${marker}-partner@example.invalid`, name: marker } }),
    ])
    const skill = await db.skill.create({ data: { name: marker, slug: marker } })
    const space = await db.learningSpace.create({ data: { title: marker, primarySkillId: skill.id, createdById: author.id } })
    await db.learningSpaceMember.createMany({ data: [{ learningSpaceId: space.id, userId: author.id }, { learningSpaceId: space.id, userId: partner.id }] })
    const booking = await db.booking.create({ data: { mentorId: author.id, menteeId: partner.id, startTime: new Date('2031-01-01T00:00:00.000Z'), endTime: new Date('2031-01-01T01:00:00.000Z'), learningSpaceId: space.id } })
    const legacy = randomUUID()
    fixture = { notes: [legacy], booking: booking.id, space: space.id, skill: skill.id, users: [author.id, partner.id] }
    await db.$executeRaw`INSERT INTO "LearningNote" (id, "learningSpaceId", "bookingId", "authorId", content, visibility, version, "createdAt", "updatedAt") VALUES (${legacy}, ${space.id}, ${booking.id}, ${author.id}, 'legacy H1 fixture', 'SPACE_MEMBERS'::"LearningNoteVisibility", 7, now(), now())`
    const before = await db.$queryRaw<Array<{ content: string; visibility: string; version: number }>>`SELECT content, visibility::text AS visibility, version FROM "LearningNote" WHERE id = ${legacy}`
    assert.deepEqual(before, [{ content: 'legacy H1 fixture', visibility: 'SPACE_MEMBERS', version: 7 }])

    assert.equal(apply(testUrl, forward), true, 'Forward migration failed')
    const afterColumns = await columns(db)
    const typeColumn = afterColumns.find(column => column.column_name === 'type')
    assert.ok(typeColumn && typeColumn.is_nullable === 'NO' && typeColumn.column_default?.includes('GENERAL'), 'type default is incorrect')
    assert.ok(afterColumns.find(column => column.column_name === 'deletedAt')?.is_nullable === 'YES')
    assert.ok(afterColumns.find(column => column.column_name === 'deletedById')?.is_nullable === 'YES')
    const types = await db.$queryRaw<Array<{ enumlabel: string }>>`SELECT enumlabel FROM pg_enum WHERE enumtypid = '"LearningNoteType"'::regtype ORDER BY enumsortorder`
    assert.deepEqual(types.map(row => row.enumlabel), ['GENERAL', 'RECAP'])
    const migrated = await db.$queryRaw<Array<{ type: string; visibility: string; version: number }>>`SELECT type::text AS type, visibility::text AS visibility, version FROM "LearningNote" WHERE id = ${legacy}`
    assert.deepEqual(migrated, [{ type: 'GENERAL', visibility: 'SPACE_MEMBERS', version: 7 }], 'Legacy LearningNote was not preserved')
    const general = randomUUID(), recap = randomUUID(), deleted = randomUUID()
    fixture.notes.push(general, recap, deleted)
    await db.$executeRaw`INSERT INTO "LearningNote" (id, "learningSpaceId", "authorId", content, type, visibility) VALUES (${general}, ${space.id}, ${author.id}, 'general fixture', 'GENERAL'::"LearningNoteType", 'AUTHOR_ONLY'::"LearningNoteVisibility")`
    await db.$executeRaw`INSERT INTO "LearningNote" (id, "learningSpaceId", "bookingId", "authorId", content, type, visibility) VALUES (${recap}, ${space.id}, ${booking.id}, ${author.id}, 'recap fixture', 'RECAP'::"LearningNoteType", 'BOOKING_PARTICIPANTS'::"LearningNoteVisibility")`
    await db.$executeRaw`INSERT INTO "LearningNote" (id, "learningSpaceId", "authorId", content, type, visibility, "deletedAt", "deletedById") VALUES (${deleted}, ${space.id}, ${author.id}, 'deleted fixture', 'GENERAL'::"LearningNoteType", 'SPACE_MEMBERS'::"LearningNoteVisibility", now(), ${author.id})`
    const activeCount = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*)::bigint AS count FROM "LearningNote" WHERE "learningSpaceId" = ${space.id} AND "deletedAt" IS NULL`
    assert.equal(activeCount[0].count, BigInt(3), 'Soft-deleted note must be excluded by active-note query')
    const index = await db.$queryRaw<Array<{ indexname: string }>>`SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'LearningNote' AND indexname = 'LearningNote_learningSpaceId_deletedAt_createdAt_idx'`
    assert.equal(index.length, 1, 'Active-note index is missing')
    console.log(JSON.stringify({ evidence: 'H1_FORWARD_PASS', legacyPreserved: true, general: true, recap: true, softDelete: true, defaults: true }))

    assert.equal(apply(testUrl, rollback), false, 'Unsafe rollback unexpectedly succeeded')
    assert.ok((await columns(db)).some(column => column.column_name === 'type'), 'Unsafe rollback changed the schema')
    console.log(JSON.stringify({ evidence: 'H1_ROLLBACK_REFUSAL_PASS', recapAndDeletedRowsProtected: true }))

    await db.$executeRaw`UPDATE "LearningNote" SET type = 'GENERAL'::"LearningNoteType", "deletedAt" = NULL, "deletedById" = NULL WHERE id IN (${recap}, ${deleted})`
    assert.equal(apply(testUrl, rollback), true, 'Safe rollback failed')
    const rolledBack = await columns(db)
    assert.ok(!rolledBack.some(column => ['type', 'deletedAt', 'deletedById'].includes(column.column_name)), 'Rollback columns remain')
    const restored = await db.$queryRaw<Array<{ content: string; visibility: string; version: number }>>`SELECT content, visibility::text AS visibility, version FROM "LearningNote" WHERE id = ${legacy}`
    assert.deepEqual(restored, before, 'Rollback did not preserve legacy note fields')
    assert.equal(await db.booking.count({ where: { id: booking.id } }), 1, 'Unrelated Booking changed during migration')
    assert.equal(await db.learningSpace.count({ where: { id: space.id } }), 1, 'Unrelated LearningSpace changed during migration')
    console.log(JSON.stringify({ evidence: 'H1_ROLLBACK_PASS', allowed: true, legacyPreserved: true, bookingAndSpaceIntact: true }))
  } finally {
    if (fixture) await cleanup(db, fixture)
    await db.$disconnect()
  }
  console.log(JSON.stringify({ evidence: 'H1_CLEANUP_PASS', runOwnedFixtures: true, finalSchema: 'pre-H1 after rollback' }))
}

main().catch(error => {
  console.error(JSON.stringify({ evidence: 'H1_MIGRATION_BLOCKED', name: error instanceof Error ? error.name : 'UnknownError', code: typeof error === 'object' && error && 'code' in error ? error.code : undefined, assertion: error instanceof assert.AssertionError ? error.message.split('\n')[0] : undefined }))
  process.exitCode = 1
})
