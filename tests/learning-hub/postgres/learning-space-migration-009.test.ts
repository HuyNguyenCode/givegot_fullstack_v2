// T3-B.2: execute only on the authorized disposable TEST project from WSL.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

const sourceRoot = '/mnt/f/givegot/givegot-v2'
const project = 'yxyipetjooqsysdhruut'
const schema = 'prisma/schema.prisma'
const base = 'prisma/migrations-manual/009_learning_space_skill_and_origin'
const forward = `${base}.sql`, rollback = `${base}.rollback.sql`
const cli = 'node_modules/prisma/build/index.js'
const t3Marker = `t3-b2-009-${randomUUID()}`
const [mentor, learner, skill, legacy, booking, invite, automatic, deliberate, unknown, badSkill, badOrigin, badInvite, noSkillGuard, originGuard] =
  Array.from({ length: 14 }, () => randomUUID())
const users = [mentor, learner]
const extraSpaces = [automatic, deliberate, unknown, badSkill, badOrigin, noSkillGuard, originGuard]
const spaces = [legacy, ...extraSpaces]
const invites = [invite, badInvite]
const tokenHash = (id: string) => createHash('sha256').update(`${t3Marker}-${id}`).digest('hex')
const enumName = 'LearningSpaceCreationOrigin'
const resumePost009 = process.env.T3_B2_RESUME_POST_009 === '1'
const previousMarker = 't3-b2-009-7cd474b9-0729-4b6b-a2ba-697f5d0e457c'

let phase = 'local setup'
let lastCompleted = 'none'
const evidence = (event: string, detail: Record<string, unknown> = {}) => console.log(JSON.stringify({ event, ...detail }))
function complete(name: string, detail?: Record<string, unknown>) {
  lastCompleted = name
  evidence(name, detail)
}

// Direct and pooler URLs for the same project must compare as the same identity.
function projectRef(raw: string) {
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) return null
  const direct = /^(?:db\.)?([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname)?.[1]
  if (direct) return direct
  if (!url.hostname.endsWith('.pooler.supabase.com')) return null
  try { return /\.([a-z0-9]{20})$/.exec(decodeURIComponent(url.username))?.[1] ?? null } catch { return null }
}

function setup() {
  assert.equal(process.env.T3_B2_EXECUTE, '1', 'Explicit T3-B.2 opt-in required')
  assert.equal(process.versions.node, '22.23.3', 'Use the established Linux Node runtime')
  assert.equal(process.platform, 'linux', 'Use the established Linux runtime')
  for (const file of [schema, forward, rollback, 'tests/learning-hub/postgres/learning-space-migration-009.test.ts']) {
    assert.ok(readFileSync(file).equals(readFileSync(resolve(sourceRoot, file))), `Windows/Linux file parity failed: ${file}`)
  }
  for (const dep of ['prisma', '@prisma/client']) {
    const version = JSON.parse(readFileSync(`node_modules/${dep}/package.json`, 'utf8')).version
    assert.equal(version, '5.22.0', `Unexpected version of ${dep}`)
  }
  const local = parse(readFileSync('.env'))
  const target = process.env.DISPOSABLE_TEST_DATABASE_URL ?? local.DISPOSABLE_TEST_DATABASE_URL
  assert.ok(target, 'DISPOSABLE_TEST_DATABASE_URL is missing')
  assert.ok(projectRef(target) === project, 'Disposable target does not identify the authorized TEST project')
  const targetUrl = new URL(target)
  assert.ok(/^db\./.test(targetUrl.hostname) || targetUrl.hostname.endsWith('.pooler.supabase.com'), 'Unexpected TEST endpoint format')
  assert.ok(!['host', 'hostaddr', 'port', 'database', 'dbname', 'user', 'options'].some(key => targetUrl.searchParams.has(key)), 'TEST URL has a routing override')
  assert.ok(targetUrl.searchParams.getAll('schema').every(value => value === 'public'), 'TEST URL must target public schema')
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    const effective = process.env[key] ?? local[key]
    assert.ok(effective, `${key} is missing for local target comparison`)
    for (const candidate of [effective, local[key]].filter(Boolean)) {
      const ref = projectRef(candidate)
      assert.ok(ref && ref !== project, `${key} cannot be established as a distinct application project`)
    }
  }
  const clientSchema = 'node_modules/.prisma/client/schema.prisma'
  const normalized = (path: string) => readFileSync(path, 'utf8').replace(/\s+/g, '')
  const engine = 'node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node'
  const regenerated = !existsSync(engine) || !existsSync(clientSchema) || normalized(clientSchema) !== normalized(schema)
  if (regenerated) {
    const placeholder = 'postgresql://local:local@127.0.0.1:1/unused'
    const gen = spawnSync(process.execPath, [cli, 'generate', '--schema', schema], {
      env: { ...process.env, DATABASE_URL: placeholder, DIRECT_URL: placeholder, PRISMA_GENERATE_SKIP_AUTOINSTALL: '1' },
      encoding: 'utf8', timeout: 60_000,
    })
    assert.ok(gen.status === 0, `Linux Prisma generation failed (exit ${gen.status ?? gen.error?.code ?? 'unknown'})`)
  }
  assert.ok(existsSync(engine) && normalized(clientSchema) === normalized(schema), 'Linux client/engine parity failed')
  complete('LOCAL_READY', { project, targetSeparation: true, sourceParity: true, node: process.versions.node, prisma: '5.22.0', regenerated, fixtureMarker: t3Marker })
  return target
}

// The H1 runner uses Prisma CLI db execute for whole scripts. Keep BEGIN/COMMIT
// and the DO block intact. Both schema URL variables resolve to TEST only.
function execute(target: string, file: string, guard?: string) {
  const result = spawnSync(process.execPath, [cli, 'db', 'execute', '--stdin', '--schema', schema], {
    input: readFileSync(file), encoding: 'utf8', timeout: 60_000,
    env: { ...process.env, DATABASE_URL: target, DIRECT_URL: target, NO_COLOR: '1' },
  })
  const diagnostic = `${result.stderr}\n${result.stdout}`
  const code = /\bP\d{4}\b/.exec(diagnostic)?.[0] ?? result.error?.code ?? 'unclassified'
  if (guard) {
    assert.ok(result.status === 1 && diagnostic.includes(`LearningSpace rollback refused: ${guard}`), `Expected rollback guard absent (exit ${result.status}, ${code})`)
  } else {
    assert.ok(result.status === 0, `Prisma CLI db execute failed for ${file} (exit ${result.status}, ${code})`)
  }
}

type Column = { table_name: string; column_name: string; is_nullable: string; udt_name: string; udt_schema: string; column_default: string | null }
async function catalog(db: PrismaClient) {
  const columns = await db.$queryRaw<Column[]>`SELECT table_name, column_name, is_nullable, udt_name, udt_schema, column_default
    FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('LearningSpace','LearningSpaceMember','Booking','LearningInvite')
    ORDER BY table_name, column_name`
  const constraints = await db.$queryRaw<Array<{ name: string; definition: string; valid: boolean }>>`
    SELECT c.conname::text AS name, pg_get_constraintdef(c.oid) AS definition, c.convalidated AS valid
    FROM pg_constraint c JOIN pg_class rel ON rel.oid = c.conrelid JOIN pg_namespace ns ON ns.oid = rel.relnamespace
    WHERE ns.nspname = 'public' AND rel.relname IN ('LearningSpace','LearningSpaceMember','Booking','LearningInvite')
    ORDER BY rel.relname, c.conname`
  const indexes = await db.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname::text, indexdef
    FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('LearningSpace','LearningSpaceMember','Booking','LearningInvite')
    ORDER BY tablename, indexname`
  const [type] = await db.$queryRaw<Array<{ exists: boolean; labels: string[] }>>`SELECT
    to_regtype('public."LearningSpaceCreationOrigin"') IS NOT NULL AS exists,
    ARRAY(SELECT e.enumlabel::text FROM pg_enum e WHERE e.enumtypid = to_regtype('public."LearningSpaceCreationOrigin"') ORDER BY e.enumsortorder) AS labels`
  return { columns, constraints, indexes, type }
}
type Catalog = Awaited<ReturnType<typeof catalog>>
const column = (state: Catalog, table: string, name: string) => state.columns.find(c => c.table_name === table && c.column_name === name)
function stateName(state: Catalog) {
  const origin = column(state, 'LearningSpace', 'creationOrigin')
  const nullable = column(state, 'LearningSpace', 'primarySkillId')?.is_nullable
  if (!origin && !state.type.exists && nullable === 'NO') return 'pre-009'
  if (origin?.udt_name === enumName && origin.udt_schema === 'public' && origin.is_nullable === 'YES' && origin.column_default === null
    && nullable === 'YES' && state.type.exists && state.type.labels.join(',') === 'USER_INITIATED,BOOKING_CONFIRMATION') return '009 applied'
  return `unexpected (primarySkillId nullable=${nullable ?? 'absent'}, origin column=${Boolean(origin)}, enum=${state.type.exists})`
}

function checkBaseline(state: Catalog) {
  assert.equal(stateName(state), 'pre-009', `Expected pre-009 baseline, observed ${stateName(state)}`)
  for (const [table, name, nullable] of [
    ['LearningSpace', 'primarySkillId', 'NO'], ['LearningSpaceMember', 'learningSpaceId', 'NO'],
    ['LearningSpaceMember', 'userId', 'NO'], ['Booking', 'learningSpaceId', 'YES'], ['LearningInvite', 'primarySkillId', 'NO'],
  ]) {
    const field = column(state, table, name)
    assert.ok(field?.udt_name === 'text' && field.is_nullable === nullable, `Missing or incompatible ${table}.${name}`)
  }
  assert.equal(column(state, 'LearningInvite', 'primarySkillId')?.column_default, null, 'Invite skill unexpectedly has a default')
  const targetFks = [
    ['LearningSpace_primarySkillId_fkey', '("primarySkillId")', 'Skill', 'RESTRICT'],
    ['LearningInvite_primarySkillId_fkey', '("primarySkillId")', 'Skill', 'RESTRICT'],
    ['Booking_learningSpaceId_fkey', '("learningSpaceId")', 'LearningSpace', 'SET NULL'],
    ['LearningSpaceMember_learningSpaceId_fkey', '("learningSpaceId")', 'LearningSpace', 'RESTRICT'],
    ['LearningSpaceMember_userId_fkey', '("userId")', 'User', 'RESTRICT'],
  ]
  for (const [name, key, referenced, action] of targetFks) {
    const definition = `FOREIGN KEY ${key} REFERENCES "${referenced}"(id) ON UPDATE CASCADE ON DELETE ${action}`
    const actual = state.constraints.find(c => c.name === name)
    assert.ok(actual?.valid && actual.definition.replace('public.', '') === definition, `Missing or incompatible ${name}`)
  }
  assert.ok(state.constraints.some(c => c.name === 'LearningSpaceMember_pkey' && c.definition === 'PRIMARY KEY ("learningSpaceId", "userId")'), 'Missing membership primary key')
  for (const [index, tail] of [
    ['LearningSpace_primarySkillId_state_idx', '("primarySkillId", state)'],
    ['LearningSpace_state_updatedAt_idx', '(state, "updatedAt")'],
    ['Booking_learningSpaceId_createdAt_idx', '("learningSpaceId", "createdAt")'],
    ['LearningSpaceMember_learningSpaceId_status_idx', '("learningSpaceId", status)'],
    ['LearningSpaceMember_userId_status_idx', '("userId", status)'],
    ['LearningInvite_primarySkillId_idx', '("primarySkillId")'],
  ]) assert.ok(state.indexes.some(i => i.indexname === index && i.indexdef.endsWith(` USING btree ${tail}`)), `Missing or incompatible ${index}`)
}

function checkApplied(state: Catalog, baseline: Catalog) {
  assert.equal(stateName(state), '009 applied', `Expected 009 applied, observed ${stateName(state)}`)
  const expected = baseline.columns.map(c => c.table_name === 'LearningSpace' && c.column_name === 'primarySkillId' ? { ...c, is_nullable: 'YES' } : c)
  assert.deepEqual(state.columns.filter(c => c.table_name !== 'LearningSpace' || c.column_name !== 'creationOrigin'), expected, 'An existing column changed unexpectedly')
  assert.deepEqual(state.constraints, baseline.constraints, 'Relevant constraints changed')
  assert.deepEqual(state.indexes, baseline.indexes, 'Relevant indexes changed')
}

async function resumeBaseline(db: PrismaClient, applied: Catalog): Promise<Catalog> {
  assert.equal(stateName(applied), '009 applied', `Expected post-009 checkpoint, observed ${stateName(applied)}`)
  // Reconstruct only the expected catalog delta for D08, using the observed post-009 constraints and indexes.
  const pre009 = {
    ...applied,
    columns: applied.columns.filter(c => c.table_name !== 'LearningSpace' || c.column_name !== 'creationOrigin')
      .map(c => c.table_name === 'LearningSpace' && c.column_name === 'primarySkillId' ? { ...c, is_nullable: 'NO' } : c),
    type: { exists: false, labels: [] },
  }
  checkBaseline(pre009)
  const [residue] = await db.$queryRaw<Array<{ spaces: bigint; skills: bigint; users: bigint; manualInvite: bigint }>>`SELECT
    (SELECT count(*) FROM "LearningSpace" WHERE title = ${previousMarker}) AS spaces,
    (SELECT count(*) FROM "Skill" WHERE name = ${previousMarker} OR slug = ${previousMarker}) AS skills,
    (SELECT count(*) FROM "User" WHERE email IN (${previousMarker + '-mentor@example.invalid'}, ${previousMarker + '-learner@example.invalid'})) AS users,
    (SELECT count(*) FROM "LearningInvite" WHERE id = 'manual-b07-test') AS "manualInvite"`
  assert.deepEqual(residue, { spaces: 0n, skills: 0n, users: 0n, manualInvite: 0n }, 'Prior rehearsal or manual B07 fixtures still exist')
  assert.deepEqual(await guards(db), { null_skill: 0n, recorded_origin: 0n }, 'Existing Space data prevents isolating the rollback guards')
  return pre009
}

async function dataDigest(db: PrismaClient) {
  // Hash the relevant rows on the server. Only digests are returned, including
  // while using the post-009 client against the rolled-back schema.
  const [digest] = await db.$queryRaw<Array<Record<string, string>>>`SELECT
    (SELECT md5(COALESCE(string_agg((to_jsonb(s) - 'creationOrigin')::text, ',' ORDER BY id), '')) FROM "LearningSpace" s) AS spaces,
    (SELECT md5(COALESCE(string_agg(to_jsonb(m)::text, ',' ORDER BY "learningSpaceId", "userId"), '')) FROM "LearningSpaceMember" m) AS members,
    (SELECT md5(COALESCE(string_agg(to_jsonb(b)::text, ',' ORDER BY id), '')) FROM "Booking" b) AS bookings,
    (SELECT md5(COALESCE(string_agg(to_jsonb(i)::text, ',' ORDER BY id), '')) FROM "LearningInvite" i) AS invites,
    (SELECT md5(COALESCE(string_agg(to_jsonb(k)::text, ',' ORDER BY id), '')) FROM "Skill" k) AS skills,
    (SELECT md5(COALESCE(string_agg(to_jsonb(u)::text, ',' ORDER BY id), '')) FROM "User" u) AS users`
  return digest
}

async function createFixtures(db: PrismaClient) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO "User" (id,email,"createdAt","updatedAt") VALUES
      (${mentor},${`${t3Marker}-mentor@example.invalid`},now(),now()), (${learner},${`${t3Marker}-learner@example.invalid`},now(),now())`
    await tx.$executeRaw`INSERT INTO "Skill" (id,name,slug,"createdAt","updatedAt") VALUES (${skill},${t3Marker},${t3Marker},now(),now())`
    await tx.$executeRaw`INSERT INTO "LearningSpace" (id,title,"primarySkillId","createdById") VALUES (${legacy},${t3Marker},${skill},${mentor})`
    await tx.$executeRaw`INSERT INTO "LearningSpaceMember" ("learningSpaceId","userId") VALUES (${legacy},${mentor}),(${legacy},${learner})`
    await tx.$executeRaw`INSERT INTO "Booking" (id,"mentorId","menteeId","startTime","endTime",status,"learningSpaceId")
      VALUES (${booking},${mentor},${learner},TIMESTAMP '2026-10-01 00:00:00',TIMESTAMP '2026-10-01 01:00:00','CONFIRMED',${legacy})`
    await tx.$executeRaw`INSERT INTO "LearningInvite" (id,"learningSpaceId","inviterId","tokenHash","primarySkillId","expiresAt")
      VALUES (${invite},${legacy},${mentor},${tokenHash(invite)},${skill},now() + interval '1 day')`
  })
}

async function checkOriginsUnknown(db: PrismaClient) {
  const [row] = await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) FROM "LearningSpace" WHERE "creationOrigin" IS NOT NULL`
  assert.equal(row.count, 0n, 'Pre-existing Spaces have recorded origins')
}

async function expectRejection(run: () => Promise<unknown>, sqlstate: string, messagePart: string) {
  try { await run() } catch (error) {
    const raw = error as { code?: string; meta?: { code?: string; message?: string } }
    assert.ok(raw.code === 'P2010' && raw.meta?.code === sqlstate && raw.meta.message?.includes(messagePart),
      `Unexpected rejection while verifying SQLSTATE ${sqlstate}`)
    return
  }
  assert.fail(`Expected rejection with SQLSTATE ${sqlstate}`)
}

async function realBehavior(db: PrismaClient) {
  const read = (id: string) => db.learningSpace.findUniqueOrThrow({ where: { id }, include: { primarySkill: { select: { id: true, name: true } } } })
  const old = await read(legacy)
  assert.equal(old.primarySkillId, skill, 'Legacy Space skill mismatch')
  assert.deepEqual(old.primarySkill, { id: skill, name: t3Marker }, 'Generated client did not resolve the Skill relation')
  assert.equal(old.creationOrigin, null, 'Legacy Space origin must remain unknown')
  await db.learningSpace.create({ data: { id: automatic, title: t3Marker, createdById: mentor, primarySkillId: null, creationOrigin: 'BOOKING_CONFIRMATION' } })
  await db.learningSpace.create({ data: { id: deliberate, title: t3Marker, createdById: mentor, primarySkillId: skill, creationOrigin: 'USER_INITIATED' } })
  await db.$executeRaw`INSERT INTO "LearningSpace" (id,title,"createdById","primarySkillId") VALUES (${unknown},${t3Marker},${mentor},${skill})`
  const withoutSkill = await read(automatic)
  assert.ok(withoutSkill.primarySkillId === null && withoutSkill.primarySkill === null, 'Generated client did not read null skill fields')
  assert.equal(withoutSkill.creationOrigin, 'BOOKING_CONFIRMATION', 'Automatic origin failed round trip')
  const manual = await read(deliberate)
  assert.ok(manual.primarySkillId === skill && manual.creationOrigin === 'USER_INITIATED', 'User-initiated origin failed round trip')
  assert.equal((await read(unknown)).creationOrigin, null, 'Omitted origin did not stay NULL')
  // Each expected failure is a standalone statement, so no aborted transaction carries forward.
  await expectRejection(() => db.$executeRaw`INSERT INTO "LearningSpace" (id,title,"createdById","primarySkillId")
    VALUES (${badSkill},${t3Marker},${mentor},${randomUUID()})`, '23503', 'LearningSpace_primarySkillId_fkey')
  await expectRejection(() => db.$executeRaw`INSERT INTO "LearningSpace" (id,title,"createdById","primarySkillId","creationOrigin")
    VALUES (${badOrigin},${t3Marker},${mentor},${skill},${'INVALID_REHEARSAL_ORIGIN'}::"LearningSpaceCreationOrigin")`, '22P02', enumName)
  await expectRejection(() => db.$executeRaw`INSERT INTO "LearningInvite" (id,"inviterId","tokenHash","expiresAt")
    VALUES (${badInvite},${mentor},${tokenHash(badInvite)},now() + interval '1 day')`, '23502', 'primarySkillId')
  await assignFirstSkill(db)
}

async function assignFirstSkill(db: PrismaClient) {
  await db.learningSpace.update({ where: { id: automatic }, data: { primarySkillId: skill } })
  const assigned = await db.learningSpace.findUniqueOrThrow({
    where: { id: automatic },
    select: { primarySkillId: true, creationOrigin: true, primarySkill: { select: { id: true } } },
  })
  assert.ok(assigned.primarySkillId === skill && assigned.primarySkill?.id === skill, 'First skill assignment failed')
  assert.equal(assigned.creationOrigin, 'BOOKING_CONFIRMATION', 'First skill assignment changed origin')
}

async function guards(db: PrismaClient) {
  const [row] = await db.$queryRaw<Array<{ null_skill: bigint; recorded_origin: bigint }>>`SELECT
    count(*) FILTER (WHERE "primarySkillId" IS NULL) AS null_skill,
    count(*) FILTER (WHERE "creationOrigin" IS NOT NULL) AS recorded_origin FROM "LearningSpace"`
  return row
}

async function refusal(db: PrismaClient, target: string, after: Catalog, legacyDigest: Awaited<ReturnType<typeof dataDigest>>, kind: 'skill' | 'origin') {
  const id = kind === 'skill' ? noSkillGuard : originGuard
  assert.deepEqual(await guards(db), { null_skill: 0n, recorded_origin: 0n }, 'Unrelated Space rows prevent independently testing rollback guards')
  const expected = kind === 'skill' ? { primarySkillId: null, creationOrigin: null } : { primarySkillId: skill, creationOrigin: 'USER_INITIATED' }
  await db.$executeRaw`INSERT INTO "LearningSpace" (id,title,"createdById","primarySkillId","creationOrigin")
    VALUES (${id},${t3Marker},${mentor},${expected.primarySkillId},${expected.creationOrigin}::"LearningSpaceCreationOrigin")`
  const expectedCounts = kind === 'skill' ? { null_skill: 1n, recorded_origin: 0n } : { null_skill: 0n, recorded_origin: 1n }
  assert.deepEqual(await guards(db), expectedCounts, 'Rollback guard case is not isolated')
  const before = await dataDigest(db)
  execute(target, rollback, kind === 'skill' ? 'spaces without a primary skill exist' : 'spaces with recorded origin exist')
  assert.deepEqual(await catalog(db), after, 'Rollback refusal changed schema')
  assert.deepEqual(await dataDigest(db), before, 'Rollback refusal changed Space or related data')
  const rows = await db.$queryRaw<Array<typeof expected>>`SELECT "primarySkillId", "creationOrigin"::text FROM "LearningSpace" WHERE id = ${id}`
  assert.deepEqual(rows, [expected], 'Rollback refusal failed to preserve the guard fixture')
  await db.$executeRaw`DELETE FROM "LearningSpace" WHERE id = ${id}`
  assert.deepEqual(await dataDigest(db), legacyDigest, 'Guard fixture removal did not restore legacy data snapshot')
}

async function remaining(db: PrismaClient) {
  const [counts] = await db.$queryRaw<Array<Record<string, number>>>`SELECT
    (SELECT count(*)::int FROM "LearningSpace" WHERE id = ANY(${spaces}::text[])) AS spaces,
    (SELECT count(*)::int FROM "LearningSpaceMember" WHERE "learningSpaceId" = ANY(${spaces}::text[]) OR "userId" = ANY(${users}::text[])) AS members,
    (SELECT count(*)::int FROM "Booking" WHERE id = ${booking} OR "learningSpaceId" = ANY(${spaces}::text[])) AS bookings,
    (SELECT count(*)::int FROM "LearningInvite" WHERE id = ANY(${invites}::text[]) OR "learningSpaceId" = ANY(${spaces}::text[])) AS invites,
    (SELECT count(*)::int FROM "Skill" WHERE id = ${skill}) AS skills,
    (SELECT count(*)::int FROM "User" WHERE id = ANY(${users}::text[])) AS users`
  return counts
}

async function cleanup(db: PrismaClient) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`DELETE FROM "LearningInvite" WHERE id = ANY(${invites}::text[])`
    await tx.$executeRaw`DELETE FROM "Booking" WHERE id = ${booking}`
    await tx.$executeRaw`DELETE FROM "LearningSpaceMember" WHERE "learningSpaceId" = ${legacy} AND "userId" = ANY(${users}::text[])`
    await tx.$executeRaw`DELETE FROM "LearningSpace" WHERE id = ANY(${spaces}::text[])`
    await tx.$executeRaw`DELETE FROM "Skill" WHERE id = ${skill}`
    await tx.$executeRaw`DELETE FROM "User" WHERE id = ANY(${users}::text[])`
  })
}

function safeError(error: unknown) {
  if (error instanceof assert.AssertionError && error.message) return error.message.split('\n')[0]
  if (error instanceof Error) {
    const detail = error as Error & { code?: string; errorCode?: string; meta?: { code?: string } }
    return [error.name, detail.code ?? detail.errorCode, detail.meta?.code].filter(Boolean).join(' / ')
  }
  return 'unknown error'
}

async function main() {
  const envSnapshot = readFileSync('.env')
  const target = setup()
  const { PrismaClient: Client } = await import('@prisma/client')
  const db = new Client({ datasources: { db: { url: target } }, log: [] })
  let fixtureSetupAttempted = false
  let error: unknown
  let before: Catalog | undefined
  let originalData: Awaited<ReturnType<typeof dataDigest>> | undefined
  try {
    phase = 'TEST connectivity'
    await db.$connect()
    assert.deepEqual(await db.$queryRaw`SELECT 1 AS one`, [{ one: 1 }], 'SELECT 1 did not return 1')
    complete('TEST_CONNECTED', { project, select1: 1 })
    phase = 'schema prerequisite'
    const observed = await catalog(db)
    if (resumePost009) {
      before = await resumeBaseline(db, observed)
      complete('POST_009_CHECKPOINT', { schema: stateName(observed), priorFixturesAbsent: true, manualB07FixtureAbsent: true })
    } else {
      before = observed
      checkBaseline(before)
      complete('PRE_009', { schema: stateName(before), requiredForeignKeys: true, requiredIndexes: true, inviteSkillRequired: true })
    }
    originalData = await dataDigest(db)

    phase = 'fixture setup'
    fixtureSetupAttempted = true
    await createFixtures(db)
    const baselineData = await dataDigest(db)
    complete('LEGACY_FIXTURES_READY')

    let after = observed
    if (resumePost009) {
      phase = 'B08–B09 first skill and origin preservation'
      const fixture = await db.learningSpace.create({
        data: { id: automatic, title: t3Marker, createdById: mentor, primarySkillId: null, creationOrigin: 'BOOKING_CONFIRMATION' },
        select: { primarySkillId: true, creationOrigin: true },
      })
      assert.deepEqual(fixture, { primarySkillId: null, creationOrigin: 'BOOKING_CONFIRMATION' }, 'First-skill fixture was not persisted as expected')
      await assignFirstSkill(db)
      complete('B08_B09_PASS', { cases: 'B08–B09', b07Automation: 'not run in continuation' })
    } else {
      phase = 'A forward migration'
      execute(target, forward)
      after = await catalog(db)
      checkApplied(after, before)
      await checkOriginsUnknown(db)
      assert.deepEqual(await dataDigest(db), baselineData, 'Forward migration changed pre-existing data')
      complete('A_PASS', { cases: 'A01–A12' })

      phase = 'B/P constraint and generated-client behavior'
      await realBehavior(db)
      complete('B_P_PASS', { cases: 'B01–B09, P01–P04', postgresRejections: ['23503', '22P02', '23502'] })
    }
    await db.$executeRaw`DELETE FROM "LearningSpace" WHERE id = ANY(${[automatic, deliberate, unknown]}::text[])`
    assert.deepEqual(await dataDigest(db), baselineData, 'Post-forward fixtures did not clean up to legacy baseline')

    phase = 'C01 null-skill rollback refusal'
    await refusal(db, target, after, baselineData, 'skill')
    complete('C01_PASS', { guard: 'spaces without a primary skill exist' })
    phase = 'C02 recorded-origin rollback refusal'
    await refusal(db, target, after, baselineData, 'origin')
    complete('C02_PASS', { guard: 'spaces with recorded origin exist' })

    phase = 'D safe rollback'
    assert.deepEqual(await guards(db), { null_skill: 0n, recorded_origin: 0n }, 'Unrelated Space rows prevent safe rollback')
    execute(target, rollback)
    assert.deepEqual(await catalog(db), before, 'Safe rollback did not restore baseline catalog')
    assert.deepEqual(await dataDigest(db), baselineData, 'Safe rollback changed legacy data')
    complete('D_PASS', { cases: 'D01–D08', schema: 'pre-009' })

    phase = 'E forward reapplication'
    execute(target, forward)
    assert.deepEqual(await catalog(db), after, 'Reapplication did not restore post-009 catalog')
    await checkOriginsUnknown(db)
    assert.deepEqual(await dataDigest(db), baselineData, 'Reapplication changed legacy data')
    complete('E_PASS', { cases: 'E01–E05' })
  } catch (failure) {
    error = failure
    evidence('REHEARSAL_STOP', { phase, lastCompleted, reason: safeError(failure) })
  } finally {
    try {
      if (fixtureSetupAttempted) {
        await cleanup(db)
        const counts = await remaining(db)
        evidence('FIXTURE_COUNTS', counts)
        assert.ok(Object.values(counts).every(value => value === 0), 'Rehearsal-owned rows remain')
      }
      if (lastCompleted !== 'none' && lastCompleted !== 'LOCAL_READY') {
        const final = await catalog(db)
        evidence('FINAL_SCHEMA', { state: stateName(final) })
        if (!error && before && originalData) {
          checkApplied(final, before)
          assert.deepEqual(await dataDigest(db), originalData, 'Final row digest differs from pre-fixture snapshot')
          assert.ok(readFileSync('.env').equals(envSnapshot), 'Linux-local .env changed')
          complete('F_PASS', { cases: 'F01–F05', schema: stateName(final) })
        }
      }
    } catch (failure) {
      evidence('FINAL_ASSERTION_FAILED', { lastCompleted, reason: safeError(failure) })
      if (fixtureSetupAttempted) {
        try { evidence('REMAINING_FIXTURES', await remaining(db)) } catch { evidence('REMAINING_FIXTURES_UNVERIFIED') }
      }
      try { evidence('FINAL_SCHEMA', { state: stateName(await catalog(db)) }) } catch { evidence('FINAL_SCHEMA_UNVERIFIED') }
      error ??= failure
    } finally { await db.$disconnect() }
  }
  if (error) process.exitCode = 1
}

main().catch(error => {
  evidence('REHEARSAL_STOP', { phase, lastCompleted, reason: safeError(error) })
  process.exitCode = 1
})

