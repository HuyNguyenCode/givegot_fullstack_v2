// Explicit opt-in runner: default invocation performs read-only TEST preflight.
// Execute only after preflight passes: G3_POSTGRES_EXECUTE=1 npx tsx <this file>.
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Prisma, PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

const sourceRoot = '/mnt/f/givegot/givegot-v2'
export const sourceFiles = [
  'prisma/schema.prisma', 'tsconfig.json', 'package.json', 'package-lock.json',
  'src/lib/prisma.ts', 'src/lib/auth.ts', 'src/lib/server-authorization.ts',
  'src/lib/learning-task-service.ts', 'src/lib/learning-resource-service.ts',
  'src/lib/learning-submission-service.ts', 'src/lib/learning-submission-review-service.ts',
  'src/lib/learning-submission-review-route-handlers.ts',
  'tests/learning-hub/helpers/submission-review-fixture.ts',
  'tests/learning-hub/unit/learning-submission-service.test.ts',
  'tests/learning-hub/unit/learning-submission-review.test.ts',
  'tests/learning-hub/integration/learning-submission-review-routes.test.ts',
  'tests/learning-hub/postgres/learning-g3-race.test.ts',
]
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex')
function verifySources() {
  const hashes = sourceFiles.map(file => {
    const bytes = readFileSync(file)
    assert.equal(hash(bytes), hash(readFileSync(resolve(sourceRoot, file))), `Linux source differs: ${file}`)
    return { file, sha256: hash(bytes) }
  })
  // Prisma's generated copy may align whitespace; the synchronized source itself
  // must still match Windows byte-for-byte. Ignore only whitespace in this copy.
  const normalized = (file: string) => readFileSync(file, 'utf8').replace(/\s+/g, '')
  assert.equal(normalized('prisma/schema.prisma'), normalized('node_modules/.prisma/client/schema.prisma'), 'Generated Linux Prisma client data model is stale')
  console.log(JSON.stringify({ evidence: 'SOURCE_PARITY', manifestSha256: hash(Buffer.from(JSON.stringify(hashes))), critical: hashes.filter(row => /schema.prisma|submission.*service.ts$/.test(row.file)) }))
  return hashes
}
function projectRef(raw: string) {
  const url = new URL(raw)
  return url.hostname.endsWith('.pooler.supabase.com') ? decodeURIComponent(url.username).split('.').at(-1) : /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1]
}
type Gate = { reached: Promise<void>; release(): void; transaction: boolean; revision: number | null }
function submissionGate(client: PrismaClient, taskId: string): Gate {
  let signal!: () => void, resume!: () => void
  let armed = true
  const gate: Gate = { reached: new Promise<void>(r => { signal = r }), release: () => resume(), transaction: false, revision: null }
  const released = new Promise<void>(r => { resume = r })
  client.$use(async (params, next) => {
    const result = await next(params)
    if (armed && params.model === 'Submission' && params.action === 'findUnique' && params.args?.where?.taskId === taskId) {
      armed = false; gate.transaction = !!params.runInTransaction; gate.revision = result?.revisionCount ?? null
      signal(); await released
    }
    return result
  })
  return gate
}
async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Barrier timeout: ${label}`)), 15000) })]) }
  finally { if (timer) clearTimeout(timer) }
}
const settle = <T>(promise: Promise<T>) => promise.then(value => ({ ok: true as const, value }), error => ({ ok: false as const, status: error?.status, code: error?.code }))
type Fixture = { marker: string; users: [string, string]; skillId: string; spaceId: string; taskId: string }

async function schemaPreflight(db: PrismaClient) {
  const modelNames = ['User', 'Skill', 'LearningSpace', 'LearningSpaceMember', 'LearningTask', 'Submission', 'SubmissionReview', 'LearningActivity', 'Booking', 'TransactionLog', 'TrustHistory', 'Review', 'MentorReview']
  const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string; is_nullable: string; udt_name: string }>>`SELECT table_name, column_name, is_nullable, udt_name FROM information_schema.columns WHERE table_schema='public'`
  for (const name of modelNames) {
    const model = Prisma.dmmf.datamodel.models.find(m => m.name === name)!
    for (const field of model.fields.filter(f => f.kind !== 'object')) {
      const actual = columns.find(c => c.table_name === name && c.column_name === (field.dbName ?? field.name))
      assert.ok(actual, `Missing TEST column ${name}.${field.name}; approved schema/setup prerequisite required`)
      assert.equal(actual.is_nullable, field.isRequired ? 'NO' : 'YES', `TEST nullability differs: ${name}.${field.name}`)
      if (field.kind === 'enum') assert.equal(actual.udt_name, field.type)
    }
  }
  const enums = await db.$queryRaw<Array<{ name: string; label: string }>>`SELECT t.typname AS name, e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY e.enumsortorder`
  for (const name of ['LearningTaskStatus', 'SubmissionStatus', 'SubmissionReviewOutcome', 'LearningSpaceStatus', 'LearningSpaceMemberStatus']) {
    const expected = Prisma.dmmf.datamodel.enums.find(e => e.name === name)!.values.map(v => v.name)
    assert.deepEqual(enums.filter(e => e.name === name).map(e => e.label), expected, `TEST enum differs: ${name}`)
  }
  const indexes = await db.$queryRaw<Array<{ indexname: string; indexdef: string }>>`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'`
  for (const [table, column] of [['Submission', 'taskId'], ['SubmissionReview', 'submissionId'], ['LearningActivity', 'eventKey']]) {
    assert.ok(indexes.some(i => i.indexdef.includes('UNIQUE INDEX') && i.indexdef.includes(`ON public."${table}"`) && i.indexdef.includes(`("${column}")`)), `Missing uniqueness ${table}.${column}`)
  }
  const foreignKeys = await db.$queryRaw<Array<{ table_name: string; definition: string; validated: boolean }>>`SELECT c.relname AS table_name, pg_get_constraintdef(k.oid) AS definition, k.convalidated AS validated FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype='f' AND n.nspname='public'`
  for (const [table, field, target] of [['SubmissionReview', 'submissionId', 'Submission'], ['SubmissionReview', 'reviewerId', 'User'], ['Submission', 'taskId', 'LearningTask'], ['Submission', 'authorId', 'User'], ['LearningTask', 'creatorId', 'User'], ['LearningTask', 'assigneeId', 'User']]) {
    assert.ok(foreignKeys.some(f => f.table_name === table && f.validated && f.definition.includes(`FOREIGN KEY ("${field}") REFERENCES "${target}"(id)`) && f.definition.includes('ON DELETE RESTRICT')), `Missing restrictive foreign key ${table}.${field}`)
  }
  console.log(JSON.stringify({ evidence: 'SCHEMA_PREFLIGHT', models: modelNames, enums: 'exact', uniqueness: ['Submission.taskId', 'SubmissionReview.submissionId', 'LearningActivity.eventKey'], foreignKeys: 'validated RESTRICT', migrationsApplied: false }))
}
async function snapshotUnrelated(db: PrismaClient, users: string[] = []) {
  const records = []
  for (const name of ['Booking', 'TransactionLog', 'TrustHistory', 'Review', 'MentorReview']) {
    // Identifiers are fixed above; return only count/digest, never private row bodies.
    const result = await db.$queryRawUnsafe<Array<{ count: bigint; digest: string }>>(`SELECT count(*) AS count, md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id),'')) AS digest FROM "${name}" t`)
    records.push({ name, count: Number(result[0].count), digest: result[0].digest })
  }
  const accounts = users.length ? await db.user.findMany({ where: { id: { in: users } }, select: { id: true, givePoints: true, trustScore: true, isSuspended: true }, orderBy: { id: 'asc' } }) : []
  const otherAccounts = await db.user.findMany({ where: { id: { notIn: users } }, select: { id: true, givePoints: true, trustScore: true, updatedAt: true }, orderBy: { id: 'asc' } })
  return { records, accounts, unrelatedUserCount: otherAccounts.length, unrelatedUserDigest: hash(Buffer.from(JSON.stringify(otherAccounts))) }
}
async function cleanup(db: PrismaClient, f: Fixture) {
  await db.$transaction(async tx => {
    await tx.learningActivity.deleteMany({ where: { learningSpaceId: f.spaceId } })
    await tx.submissionReview.deleteMany({ where: { submission: { taskId: f.taskId } } })
    await tx.submission.deleteMany({ where: { taskId: f.taskId } })
    await tx.learningTask.deleteMany({ where: { id: f.taskId, learningSpaceId: f.spaceId } })
    await tx.learningSpaceMember.deleteMany({ where: { learningSpaceId: f.spaceId } })
    await tx.learningSpace.deleteMany({ where: { id: f.spaceId } })
    await tx.skill.deleteMany({ where: { id: f.skillId } })
    await tx.user.deleteMany({ where: { id: { in: f.users } } })
  })
  const counts = await Promise.all([
    db.user.count({ where: { id: { in: f.users } } }), db.skill.count({ where: { id: f.skillId } }),
    db.learningSpace.count({ where: { id: f.spaceId } }), db.learningSpaceMember.count({ where: { learningSpaceId: f.spaceId } }),
    db.learningTask.count({ where: { id: f.taskId } }), db.submission.count({ where: { taskId: f.taskId } }),
    db.submissionReview.count({ where: { reviewerId: { in: f.users } } }), db.learningActivity.count({ where: { learningSpaceId: f.spaceId } }),
  ])
  assert.ok(counts.every(n => n === 0), 'Fixture cleanup not complete')
  console.log(JSON.stringify({ evidence: 'CLEANUP', marker: f.marker, remaining: counts }))
}

async function main() {
  const originalHashes = verifySources()
  const localEnvBytes = readFileSync('.env')
  const local = parse(localEnvBytes)
  const testUrl = local.DISPOSABLE_TEST_DATABASE_URL
  assert.ok(testUrl && local.DATABASE_URL && local.DIRECT_URL, 'Required local TEST/app comparison variables absent')
  assert.ok(testUrl !== local.DATABASE_URL && testUrl !== local.DIRECT_URL, 'TEST URL must differ from application URLs')
  const ref = projectRef(testUrl)
  assert.ok(ref && [local.DATABASE_URL, local.DIRECT_URL].every(url => projectRef(url) && projectRef(url) !== ref), 'TEST Supabase project must differ from both application projects')
  console.log(JSON.stringify({ evidence: 'TARGET_GUARD', environment: 'existing Linux disposable Supabase TEST', testDistinctFromBothApplicationURLs: true, supabaseProjectDistinct: true }))
  // All lazily imported default clients are sandboxed to TEST as well. App URLs are never connected.
  process.env.DATABASE_URL = testUrl; process.env.DIRECT_URL = testUrl
  const clientUrl = new URL(testUrl); clientUrl.searchParams.set('connection_limit', '1')
  const client = () => new PrismaClient({ datasources: { db: { url: clientUrl.toString() } }, transactionOptions: { maxWait: 15000, timeout: 30000 }, log: [] })
  const setup = client(), a = client(), b = client()
  let importedPrisma: PrismaClient | undefined
  try {
    await Promise.all([setup.$connect(), a.$connect(), b.$connect()])
    assert.deepEqual(await setup.$queryRaw`SELECT 1 AS ok`, [{ ok: 1 }])
    let release!: () => void, reachedA!: () => void, reachedB!: () => void
    const released = new Promise<void>(r => { release = r })
    const first = new Promise<void>(r => { reachedA = r }), second = new Promise<void>(r => { reachedB = r })
    const pids: number[] = []
    const read = (db: PrismaClient, signal: () => void) => db.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`
      const rows = await tx.$queryRaw<Array<{ pid: number; ok: number }>>`SELECT pg_backend_pid() AS pid, 1 AS ok`
      assert.equal(rows[0].ok, 1); pids.push(rows[0].pid); signal(); await released
    })
    const reads = [read(a, reachedA), read(b, reachedB)]
    try { await bounded(Promise.all([first, second]), 'two read-only connections'); assert.equal(new Set(pids).size, 2) }
    finally { release(); await Promise.all(reads) }
    console.log(JSON.stringify({ evidence: 'READ_ONLY_CONNECTIONS', select1: true, distinctBackendPids: pids }))
    await schemaPreflight(setup)
    if (process.env.G3_POSTGRES_EXECUTE !== '1') { console.log('READ_ONLY_PREFLIGHT_PASS; no fixtures created'); return }

    const [{ createLearningSubmissionReviewService }, { createLearningSubmissionService }, { prisma }] = await Promise.all([
      import('../../../src/lib/learning-submission-review-service'), import('../../../src/lib/learning-submission-service'), import('../../../src/lib/prisma'),
    ])
    importedPrisma = prisma
    const reviewService = (db: PrismaClient, f: Fixture) => createLearningSubmissionReviewService({ db, actor: async () => Object.freeze({ id: f.users[0] }), now: () => new Date() })
    const submitService = (db: PrismaClient, f: Fixture) => createLearningSubmissionService({ db, actor: async () => Object.freeze({ id: f.users[1] }), now: () => new Date() })
    const runId = `g3-pg-${randomUUID()}`
    console.log(JSON.stringify({ evidence: 'RUN', runId, sessionActors: 'injected authenticated synthetic task creator/assignee; real membership checks; real Prisma transactions' }))
    const globalBefore = await snapshotUnrelated(setup)
    const allFixtures: Fixture[] = []
    async function fixture(label: string) {
      const f = await setup.$transaction(async tx => {
        const marker = `${runId}-${label}`
        const creator = await tx.user.create({ data: { email: `${marker}-creator@example.invalid`, name: marker } })
        const assignee = await tx.user.create({ data: { email: `${marker}-assignee@example.invalid`, name: marker } })
        const skill = await tx.skill.create({ data: { name: marker, slug: marker } })
        const space = await tx.learningSpace.create({ data: { title: marker, primarySkillId: skill.id, createdById: creator.id } })
        await tx.learningSpaceMember.createMany({ data: [{ learningSpaceId: space.id, userId: creator.id }, { learningSpaceId: space.id, userId: assignee.id }] })
        const task = await tx.learningTask.create({ data: { learningSpaceId: space.id, creatorId: creator.id, assigneeId: assignee.id, title: marker, acceptanceCriteria: 'Synthetic concurrency verification' } })
        return { marker, users: [creator.id, assignee.id] as [string, string], skillId: skill.id, spaceId: space.id, taskId: task.id }
      })
      allFixtures.push(f)
      await submitService(setup, f).submit(f.spaceId, f.taskId, { content: 'Synthetic first revision' })
      console.log(JSON.stringify({ evidence: 'FIXTURE', ...f }))
      return f
    }
    async function state(f: Fixture) {
      const [task, submission, reviews, activities] = await Promise.all([
        setup.learningTask.findUniqueOrThrow({ where: { id: f.taskId } }), setup.submission.findUniqueOrThrow({ where: { taskId: f.taskId } }),
        setup.submissionReview.findMany({ where: { submission: { taskId: f.taskId } } }), setup.learningActivity.findMany({ where: { learningSpaceId: f.spaceId }, orderBy: { createdAt: 'asc' } }),
      ])
      assert.equal(new Set(activities.map(e => e.eventKey)).size, activities.length)
      assert.doesNotMatch(JSON.stringify(activities.map(e => e.metadata)), /Synthetic first revision|Synthetic next revision|Decision A|Decision B/)
      return { task, submission, reviews, activities }
    }
    const body = (s: Awaited<ReturnType<typeof state>>, outcome: string, content: string, revisionDueAt?: string) => ({ submissionId: s.submission.id, revisionCount: s.submission.revisionCount, outcome, content, ...(revisionDueAt ? { revisionDueAt } : {}) })
    async function overlap<T, U>(f: Fixture, left: (db: PrismaClient) => Promise<T>, right: (db: PrismaClient) => Promise<U>, preferred: 'left' | 'right' | 'together' = 'together') {
      const ca = client(), cb = client()
      const ga = submissionGate(ca, f.taskId), gb = submissionGate(cb, f.taskId)
      let pa: ReturnType<typeof settle<T>> | undefined, pb: ReturnType<typeof settle<U>> | undefined
      try {
        await Promise.all([ca.$connect(), cb.$connect()])
        const start = await setup.$queryRaw<Array<{ at: Date }>>`SELECT clock_timestamp() AS at`
        pa = settle(left(ca)); pb = settle(right(cb))
        await bounded(Promise.all([ga.reached, gb.reached]), 'both service Submission reads')
        assert.ok(ga.transaction && gb.transaction, 'Both barriers must be inside real transactions')
        assert.equal(ga.revision, gb.revision)
        const active = await setup.$queryRaw<Array<{ pid: number; state: string; xact_start: Date }>>`SELECT pid,state,xact_start FROM pg_stat_activity WHERE datname=current_database() AND usename=current_user AND state='idle in transaction' AND query LIKE '%"Submission"%' AND xact_start >= ${start[0].at}`
        assert.equal(active.length, 2, 'Cannot prove two concurrent paused PostgreSQL transactions')
        assert.equal(new Set(active.map(row => row.pid)).size, 2)
        console.log(JSON.stringify({ evidence: 'OVERLAP', marker: f.marker, pausedAfter: 'Submission.findUnique', sameRevision: ga.revision, independentTransactions: active }))
        if (preferred === 'left') { ga.release(); const first = await pa; assert.ok(first.ok, 'Preferred left operation failed'); gb.release() }
        else if (preferred === 'right') { gb.release(); const first = await pb; assert.ok(first.ok, 'Preferred right operation failed'); ga.release() }
        else { ga.release(); gb.release() }
        return await Promise.all([pa, pb])
      } finally {
        ga.release(); gb.release()
        await Promise.allSettled([pa, pb].filter(Boolean))
        await Promise.all([ca.$disconnect(), cb.$disconnect()])
      }
    }
    async function competing(label: string, leftOutcome: string, rightOutcome: string, preferred: 'left' | 'right' | 'together' = 'together') {
      const f = await fixture(label)
      const before = await state(f), unrelated = await snapshotUnrelated(setup, f.users)
      const dueA = new Date(Date.now() + 86400000).toISOString(), dueB = new Date(Date.now() + 172800000).toISOString()
      const inputs = [body(before, leftOutcome, 'Decision A', leftOutcome === 'REVISION_REQUESTED' ? dueA : undefined), body(before, rightOutcome, 'Decision B', rightOutcome === 'REVISION_REQUESTED' ? dueB : undefined)]
      const results = await overlap(f, db => reviewService(db, f).review(f.spaceId, f.taskId, inputs[0]), db => reviewService(db, f).review(f.spaceId, f.taskId, inputs[1]), preferred)
      assert.equal(results.filter(r => r.ok).length, 1)
      const winner = results[0].ok ? 0 : 1, loser = winner === 0 ? 1 : 0
      assert.equal(results[loser].ok, false)
      assert.equal((results[loser] as { status: number }).status, 409)
      const after = await state(f), input = inputs[winner]
      assert.equal(after.task.version, before.task.version + 1)
      assert.equal(after.task.status, input.outcome === 'REVIEWED' ? 'COMPLETED' : 'REVISION_REQUESTED')
      assert.equal(after.submission.status, input.outcome); assert.equal(after.submission.revisionCount, 1)
      assert.equal(after.submission.id, before.submission.id); assert.equal(after.submission.content, before.submission.content)
      assert.equal(after.reviews.length, 1); assert.equal(after.reviews[0].outcome, input.outcome); assert.equal(after.reviews[0].content, input.content); assert.equal(after.reviews[0].reviewerId, f.users[0])
      assert.equal(after.task.dueAt?.toISOString() ?? null, input.revisionDueAt ?? null)
      assert.equal(after.activities.length, 2)
      const reviewEvent = after.activities.find(e => e.eventKey === `learning-submission-review:${after.submission.id}:revision:1`)!
      assert.ok(reviewEvent); assert.equal((reviewEvent.metadata as Record<string, unknown>).outcome, input.outcome)
      assert.equal(reviewEvent.eventType, input.outcome === 'REVIEWED' ? 'LEARNING_SUBMISSION_REVIEWED' : 'LEARNING_REVISION_REQUESTED')
      assert.equal((reviewEvent.metadata as Record<string, unknown>).revisionDueAt ?? null, input.revisionDueAt ?? null)
      assert.deepEqual(await snapshotUnrelated(setup, f.users), unrelated)
      console.log(JSON.stringify({ evidence: 'RACE_PASS', label, winner: winner === 0 ? 'A' : 'B', outcome: input.outcome, loserStatus: 409, task: after.task.status, submission: after.submission.status, revisionCount: 1, reviewCount: 1, activityCount: 2, deadline: after.task.dueAt, noPartialWrites: true, unrelatedUnchanged: true }))
    }
    try {
      await competing('R1', 'REVIEWED', 'REVIEWED')
      await competing('R2-reviewed-wins', 'REVIEWED', 'REVISION_REQUESTED', 'left')
      await competing('R2-revision-wins', 'REVIEWED', 'REVISION_REQUESTED', 'right')
      await competing('R3', 'REVISION_REQUESTED', 'REVISION_REQUESTED')
      {
        const f = await fixture('R4'), before = await state(f), unrelated = await snapshotUnrelated(setup, f.users)
        const stale = body(before, 'REVIEWED', 'Decision A')
        await reviewService(a, f).review(f.spaceId, f.taskId, body(before, 'REVISION_REQUESTED', 'Decision B'))
        await submitService(b, f).submit(f.spaceId, f.taskId, { content: 'Synthetic next revision' })
        const resubmitted = await state(f)
        assert.equal(resubmitted.submission.revisionCount, 2); assert.equal(resubmitted.activities.length, 3)
        await assert.rejects(reviewService(a, f).review(f.spaceId, f.taskId, stale), { status: 409 })
        assert.deepEqual(await state(f), resubmitted)
        await reviewService(a, f).review(f.spaceId, f.taskId, body(resubmitted, 'REVIEWED', 'Decision A'))
        const after = await state(f)
        assert.equal(after.reviews.length, 1); assert.equal(after.reviews[0].id, resubmitted.reviews[0].id)
        assert.equal(after.submission.revisionCount, 2); assert.equal(after.task.version, before.task.version + 3)
        assert.equal(after.task.status, 'COMPLETED'); assert.equal(after.submission.status, 'REVIEWED'); assert.equal(after.reviews[0].outcome, 'REVIEWED')
        assert.equal(after.activities.length, 4)
        assert.deepEqual(after.activities.map(e => e.eventKey).sort(), [
          `learning-submission:${after.submission.id}:revision:1`, `learning-submission:${after.submission.id}:revision:2`,
          `learning-submission-review:${after.submission.id}:revision:1`, `learning-submission-review:${after.submission.id}:revision:2`,
        ].sort())
        assert.deepEqual(await snapshotUnrelated(setup, f.users), unrelated)
        console.log(JSON.stringify({ evidence: 'RACE_PASS', label: 'R4', staleStatus: 409, staleAttemptChangedNothing: true, finalReviewRevision: 2, task: after.task.status, submission: after.submission.status, revisionCount: 2, reviewCount: 1, activityCount: 4, unrelatedUnchanged: true }))
      }
      for (const base of ['SUBMITTED', 'REVISION_REQUESTED']) {
        const f = await fixture(`R5-${base}`)
        if (base === 'REVISION_REQUESTED') await reviewService(a, f).review(f.spaceId, f.taskId, body(await state(f), 'REVISION_REQUESTED', 'Decision A'))
        const before = await state(f), unrelated = await snapshotUnrelated(setup, f.users)
        const desired = { ...body(before, 'REVISION_REQUESTED', 'Decision B'), revisionCount: base === 'REVISION_REQUESTED' ? 2 : 1 }
        const results = await overlap(f, db => reviewService(db, f).review(f.spaceId, f.taskId, desired), db => submitService(db, f).submit(f.spaceId, f.taskId, { content: 'Synthetic next revision' }), base === 'SUBMITTED' ? 'left' : 'right')
        const allowed = base === 'SUBMITTED' ? 0 : 1, denied = allowed === 0 ? 1 : 0
        assert.ok(results[allowed].ok); assert.equal(results[denied].ok, false); assert.equal((results[denied] as { status: number }).status, 409)
        const after = await state(f)
        assert.equal(after.task.version, before.task.version + 1)
        assert.equal(after.task.status, base === 'SUBMITTED' ? 'REVISION_REQUESTED' : 'SUBMITTED')
        assert.equal(after.submission.status, after.task.status)
        assert.equal(after.submission.revisionCount, base === 'SUBMITTED' ? 1 : 2)
        assert.equal(after.submission.content, base === 'SUBMITTED' ? before.submission.content : 'Synthetic next revision')
        assert.equal(after.reviews.length, 1); assert.equal(after.reviews[0].outcome, 'REVISION_REQUESTED')
        assert.equal(after.reviews[0].reviewerId, f.users[0]); assert.deepEqual(after.task.dueAt, before.task.dueAt)
        assert.equal(after.reviews[0].content, base === 'SUBMITTED' ? 'Decision B' : 'Decision A')
        if (base === 'REVISION_REQUESTED') assert.deepEqual(after.reviews, before.reviews)
        assert.equal(after.activities.length, before.activities.length + 1)
        assert.deepEqual(await snapshotUnrelated(setup, f.users), unrelated)
        console.log(JSON.stringify({ evidence: 'RACE_PASS', label: `R5-${base}`, winner: allowed === 0 ? 'G3 revision request' : 'G2 resubmit', loserStatus: 409, task: after.task.status, submission: after.submission.status, revisionCount: after.submission.revisionCount, reviewCount: 1, activityCount: after.activities.length, noPartialWrites: true, unrelatedUnchanged: true }))
      }
    } finally {
      const cleanupFailures: string[] = []
      for (const f of allFixtures) { try { await cleanup(setup, f) } catch { cleanupFailures.push(f.marker) } }
      assert.deepEqual(cleanupFailures, [], 'Cleanup could not be confirmed for all run-owned fixtures')
      assert.deepEqual(await snapshotUnrelated(setup), globalBefore)
      assert.deepEqual(verifySources(), originalHashes)
      assert.equal(hash(readFileSync('.env')), hash(localEnvBytes), 'Linux-local TEST config changed')
    }
    console.log(JSON.stringify({ evidence: 'FINAL_PASS', requiredRaces: ['R1', 'R2', 'R3', 'R4', 'R5'], executedCases: 7, cleanupVerified: true, applicationConnections: 0, sourceParity: true, envPreserved: true }))
  } finally { await Promise.all([setup.$disconnect(), a.$disconnect(), b.$disconnect(), importedPrisma?.$disconnect()]) }
}
main().catch(error => {
  // Do not print Prisma error messages, query arguments, or connection strings.
  console.error(JSON.stringify({ evidence: 'BLOCKED', name: error?.name, code: error?.code, status: error?.status, assertion: error instanceof assert.AssertionError ? error.message.split('\n')[0] : undefined }))
  process.exitCode = 1
})
