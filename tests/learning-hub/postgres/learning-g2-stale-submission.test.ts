// Read-only by default. G2_POSTGRES_EXECUTE=1 enables the fixture scenarios.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Prisma, PrismaClient, type LearningTask, type Submission } from '@prisma/client'
import { parse } from 'dotenv'
import type { SubmissionFreshness } from '../../../src/lib/learning-submission-contract'

const sourceRoot = '/mnt/f/givegot/givegot-v2'
const testProject = 'yxyipetjooqsysdhruut'
const files = [
  'prisma/schema.prisma', 'tsconfig.json', 'package-lock.json',
  'src/lib/prisma.ts', 'src/lib/auth.ts', 'src/lib/server-authorization.ts',
  'src/lib/learning-activity-service.ts', 'src/lib/learning-resource-service.ts',
  'src/lib/learning-task-service.ts', 'src/lib/learning-submission-contract.ts',
  'src/lib/learning-submission-service.ts', 'src/lib/learning-submission-review-service.ts',
  'tests/learning-hub/postgres/learning-g2-stale-submission.test.ts',
]
const due = new Date(Date.now() + 7 * 86_400_000)
const revisionDue = new Date(due.getTime() + 86_400_000)
const log = (event: string, details: object) => console.log(JSON.stringify({ evidence: event, ...details }))

function verifySources() {
  const digest = createHash('sha256')
  for (const path of files) {
    const bytes = readFileSync(path)
    assert.ok(bytes.equals(readFileSync(resolve(sourceRoot, path))), 'Linux source differs: ' + path)
    digest.update(path).update(bytes)
  }
  const schema = (path: string) => readFileSync(path, 'utf8').replace(/\s+/g, '')
  assert.ok(schema('prisma/schema.prisma') === schema('node_modules/.prisma/client/schema.prisma'), 'Generated Linux Prisma schema differs')
  assert.equal(process.platform, 'linux')
  assert.equal(process.version, 'v22.23.3')
  assert.equal(Prisma.prismaVersion.client, '5.22.0')
  assert.ok(existsSync('node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node'), 'Linux Prisma engine missing')
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages
  for (const dependency of ['prisma', '@prisma/client', 'next', 'next-auth', '@auth/prisma-adapter', 'bcryptjs', 'dotenv', 'tsx']) {
    const path = 'node_modules/' + dependency
    assert.equal(JSON.parse(readFileSync(path + '/package.json', 'utf8')).version, lock[path].version, 'Linux dependency differs: ' + dependency)
  }
  return digest.digest('hex')
}

function projectRef(raw: string) {
  if (!URL.canParse(raw)) return null
  const url = new URL(raw)
  if (!['postgresql:', 'postgres:'].includes(url.protocol)) return null
  if (url.hostname.endsWith('.pooler.supabase.com')) return decodeURIComponent(url.username).split('.').at(-1)
  return /^db\.([^.]+)\.supabase\.co$/.exec(url.hostname)?.[1]
}

async function verifySchema(db: PrismaClient) {
  const models = ['User', 'Skill', 'LearningSpace', 'LearningSpaceMember', 'LearningTopic', 'LearningTask',
    'Submission', 'SubmissionReview', 'LearningActivity', 'Booking', 'TransactionLog']
  const columns = await db.$queryRaw<Array<{ table_name: string; column_name: string; udt_name: string; is_nullable: string }>>`
    SELECT table_name, column_name, udt_name, is_nullable FROM information_schema.columns WHERE table_schema = 'public'`
  for (const model of Prisma.dmmf.datamodel.models.filter(item => models.includes(item.name))) {
    for (const field of model.fields.filter(item => item.kind !== 'object')) {
      const column = columns.find(item => item.table_name === model.name && item.column_name === (field.dbName ?? field.name))
      assert.ok(column, 'Missing TEST column ' + model.name + '.' + field.name)
      assert.equal(column.is_nullable, field.isRequired ? 'NO' : 'YES', 'TEST nullability: ' + model.name + '.' + field.name)
      if (field.kind === 'enum') assert.equal(column.udt_name, field.type)
    }
  }
  const enums = await db.$queryRaw<Array<{ name: string; label: string }>>`
    SELECT t.typname AS name, e.enumlabel AS label FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' ORDER BY e.enumsortorder`
  const enumNames = ['LearningSpaceStatus', 'LearningSpaceMemberStatus', 'LearningTopicStatus', 'LearningTaskStatus', 'SubmissionStatus', 'SubmissionReviewOutcome']
  for (const name of enumNames) {
    const expected = Prisma.dmmf.datamodel.enums.find(item => item.name === name)
    assert.ok(expected, 'Missing generated enum ' + name)
    assert.deepEqual(enums.filter(item => item.name === name).map(item => item.label), expected.values.map(item => item.name), 'TEST enum differs: ' + name)
  }
  const indexes = await db.$queryRaw<Array<{ tablename: string; indexdef: string }>>`
    SELECT tablename, indexdef FROM pg_indexes WHERE schemaname = 'public'`
  for (const [table, column] of [['Submission', 'taskId'], ['SubmissionReview', 'submissionId'], ['LearningActivity', 'eventKey']]) {
    assert.ok(indexes.some(item => item.tablename === table && item.indexdef.includes('UNIQUE INDEX') && item.indexdef.endsWith('("' + column + '")')), 'Missing TEST uniqueness ' + table + '.' + column)
  }
  log('SCHEMA_PREFLIGHT', { models, enums: enumNames, uniqueKeys: ['Submission.taskId', 'SubmissionReview.submissionId', 'LearningActivity.eventKey'] })
}

async function bounded<T>(work: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new assert.AssertionError({ message: 'Barrier timeout: ' + label })), 15_000)
    })])
  } finally { clearTimeout(timer) }
}

async function verifyConnections(a: PrismaClient, b: PrismaClient) {
  const first = Promise.withResolvers<number>()
  const second = Promise.withResolvers<number>()
  const release = Promise.withResolvers<void>()
  const check = (db: PrismaClient, signal: (pid: number) => void) => db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const [row] = await tx.$queryRaw<Array<{ pid: number; ok: number }>>`SELECT pg_backend_pid() AS pid, 1 AS ok`
    assert.equal(row.ok, 1)
    signal(row.pid)
    await release.promise
  })
  const done = Promise.all([check(a, first.resolve), check(b, second.resolve)])
  try {
    const pids = await bounded(Promise.race([Promise.all([first.promise, second.promise]), done.then(() => [])]), 'two read-only transactions')
    assert.equal(new Set(pids).size, 2)
    log('READ_ONLY_CONNECTIONS', { select1: true, pids })
  } finally { release.resolve(); await done }
}

function taskReadGate(db: PrismaClient, taskId: string) {
  const read = Promise.withResolvers<{ version: number; status: string; inTransaction: boolean }>()
  const resume = Promise.withResolvers<void>()
  const claim: { count?: number; prismaError?: string } = {}
  db.$use(async (params, next) => {
    if (params.model !== 'LearningTask' || params.args?.where?.id !== taskId) return next(params)
    if (params.action === 'updateMany') {
      try {
        const result = await next(params)
        claim.count = result.count
        return result
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError) claim.prismaError = error.code
        throw error
      }
    }
    const result = await next(params)
    if (params.action === 'findFirst') {
      read.resolve({ version: result?.version, status: result?.status, inTransaction: params.runInTransaction })
      await resume.promise
    }
    return result
  })
  return { reached: read.promise, release: resume.resolve, claim }
}

const settle = <T>(request: Promise<T>) => request.then(
  value => ({ ok: true as const, value }),
  (error: { status?: number; code?: string; name?: string }) => ({ ok: false as const, status: error.status, code: error.code, name: error.name }),
)

async function overlap<L, R>(
  observer: PrismaClient, client: () => PrismaClient, label: string, task: LearningTask,
  left: (db: PrismaClient) => Promise<L>, right: (db: PrismaClient) => Promise<R>, first: 'left' | 'right' | 'both',
) {
  const a = client(), b = client()
  const ga = taskReadGate(a, task.id), gb = taskReadGate(b, task.id)
  try {
    await Promise.all([a.$connect(), b.$connect()])
    const [start] = await observer.$queryRaw<Array<{ at: Date }>>`SELECT clock_timestamp() AS at`
    const pa = settle(left(a)), pb = settle(right(b))
    try {
      const reads = await bounded(Promise.race([
        Promise.all([ga.reached, gb.reached]),
        Promise.race([pa, pb]).then(() => { throw new assert.AssertionError({ message: label + ' settled before both Task reads' }) }),
      ]), label)
      assert.deepEqual(reads, Array(2).fill({ version: task.version, status: 'OPEN', inTransaction: true }))
      const sessions = await observer.$queryRaw<Array<{ pid: number; state: string; xact_start: Date }>>`
        SELECT pid, state, xact_start FROM pg_stat_activity
        WHERE datname = current_database() AND usename = current_user AND state = 'idle in transaction'
          AND xact_start >= ${start.at} AND query LIKE '%SELECT%"LearningTask"%' ORDER BY pid`
      assert.equal(sessions.length, 2, 'Expected two paused PostgreSQL transactions for ' + label)
      assert.equal(new Set(sessions.map(row => row.pid)).size, 2)
      log('OVERLAP', { label, reads, sessions, releaseFirst: first })
      if (first === 'left') {
        ga.release()
        assert.ok((await pa).ok, 'Preferred operation did not commit: ' + label)
      }
      if (first === 'right') {
        gb.release()
        assert.ok((await pb).ok, 'Preferred operation did not commit: ' + label)
      }
      ga.release()
      gb.release()
      const outcomes = await Promise.all([pa, pb])
      log('RACE_OUTCOMES', { label, outcomes: outcomes.map(result => result.ok ? { ok: true } : result), claims: [ga.claim, gb.claim] })
      return { outcomes, claims: [ga.claim, gb.claim] }
    } finally {
      ga.release()
      gb.release()
      await Promise.allSettled([pa, pb])
    }
  } finally { await Promise.all([a.$disconnect(), b.$disconnect()]) }
}

type Fixture = { label: string; key: string; creator: string; assignee: string; space: string; topic: string; skill: string }
function fixtureIds(key: string, label: string): Fixture {
  const scope = key + '-' + label.toLowerCase()
  return { label, key: scope, creator: scope + '-creator', assignee: scope + '-assignee', space: scope + '-space', topic: scope + '-topic', skill: scope + '-skill' }
}

async function createFixture(db: PrismaClient, f: Fixture) {
  await db.$transaction(async tx => {
    await tx.user.createMany({ data: [f.creator, f.assignee].map(id => ({ id, name: id, email: id + '@example.invalid', givePoints: 3 })) })
    await tx.skill.create({ data: { id: f.skill, name: f.skill, slug: f.skill } })
    await tx.learningSpace.create({ data: { id: f.space, title: f.key, primarySkillId: f.skill, createdById: f.creator, state: 'ACTIVE' } })
    await tx.learningSpaceMember.createMany({ data: [f.creator, f.assignee].map(userId => ({ learningSpaceId: f.space, userId, status: 'ACTIVE' })) })
    await tx.learningTopic.create({ data: { id: f.topic, learningSpaceId: f.space, label: f.topic, normalizedLabel: f.topic, creatorId: f.creator } })
  })
}

async function cleanup(db: PrismaClient, f: Fixture) {
  const scope = { learningSpaceId: f.space }
  const users = { in: [f.creator, f.assignee] }
  const tasks = { in: (await db.learningTask.findMany({ where: scope, select: { id: true } })).map(row => row.id) }
  const submissions = { in: (await db.submission.findMany({ where: { taskId: tasks }, select: { id: true } })).map(row => row.id) }
  await db.$transaction(async tx => {
    await tx.learningActivity.deleteMany({ where: scope })
    await tx.submissionReview.deleteMany({ where: { submissionId: submissions } })
    await tx.submission.deleteMany({ where: { taskId: tasks } })
    await tx.learningTask.deleteMany({ where: scope })
    await tx.learningTopic.deleteMany({ where: { id: f.topic, ...scope } })
    await tx.learningSpaceMember.deleteMany({ where: { ...scope, userId: users } })
    await tx.learningSpace.deleteMany({ where: { id: f.space } })
    await tx.skill.deleteMany({ where: { id: f.skill } })
    await tx.user.deleteMany({ where: { id: users } })
  })
  const counts = await Promise.all([
    db.learningActivity.count({ where: scope }), db.submissionReview.count({ where: { OR: [{ submissionId: submissions }, { reviewerId: users }] } }),
    db.submission.count({ where: { OR: [{ taskId: tasks }, { authorId: users }] } }), db.learningTask.count({ where: scope }),
    db.learningTopic.count({ where: { id: f.topic } }), db.learningSpaceMember.count({ where: scope }),
    db.learningSpace.count({ where: { id: f.space } }), db.skill.count({ where: { id: f.skill } }), db.user.count({ where: { id: users } }),
  ])
  assert.ok(counts.every(count => count === 0), 'Run-owned fixture rows remain: ' + f.key)
  log('CLEANUP', { label: f.label, remaining: counts })
}

function freshness(task: LearningTask, submission: Pick<Submission, 'id' | 'revisionCount'> | null): SubmissionFreshness {
  const { title, description, acceptanceCriteria, topicId, dueAt } = task
  return {
    requirements: { title, description, acceptanceCriteria, topicId, dueAt: dueAt?.toISOString() ?? null },
    previousSubmission: submission ? { submissionId: submission.id, revisionCount: submission.revisionCount } : null,
  }
}

async function persisted(db: PrismaClient, task: LearningTask) {
  const where = { taskId: task.id }
  const [current, submissions, reviews, events] = await Promise.all([
    db.learningTask.findUniqueOrThrow({ where: { id: task.id } }),
    db.submission.findMany({ where, orderBy: { id: 'asc' } }),
    db.submissionReview.findMany({ where: { submission: where }, orderBy: { id: 'asc' } }),
    db.learningActivity.findMany({ where: { learningSpaceId: task.learningSpaceId }, orderBy: { eventKey: 'asc' } }),
  ])
  assert.equal(events.length, new Set(events.map(event => event.eventKey)).size)
  return { task: current, submissions, reviews, events }
}

function assertFirstCommit(state: Awaited<ReturnType<typeof persisted>>, before: LearningTask, content: string) {
  assert.equal(state.task.status, 'SUBMITTED')
  assert.equal(state.task.version, before.version + 1)
  assert.deepEqual(freshness(state.task, null), freshness(before, null))
  assert.equal(state.task.bookingId, null)
  assert.equal(state.submissions.length, 1)
  const [submission] = state.submissions
  assert.equal(submission.revisionCount, 1)
  assert.equal(submission.status, 'SUBMITTED')
  assert.equal(submission.authorId, before.assigneeId)
  assert.equal(submission.content, content)
  assert.equal(state.reviews.length, 0)
  assert.deepEqual(state.events.map(row => [row.eventType, row.eventKey]), [
    ['LEARNING_SUBMISSION_CREATED', 'learning-submission:' + submission.id + ':revision:1'],
    ['LEARNING_TASK_ASSIGNED', 'learning-task:' + before.id + ':assigned'],
  ])
}

function isolatedTables(db: PrismaClient) {
  return db.$queryRaw<Array<{ name: string; count: bigint; digest: string }>>`
    SELECT 'Booking' AS name, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) AS digest FROM "Booking" t
    UNION ALL
    SELECT 'TransactionLog', count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY id), '')) FROM "TransactionLog" t
    UNION ALL
    SELECT 'User.givePoints', count(*), md5(coalesce(string_agg(md5(jsonb_build_array(id, "givePoints")::text), '' ORDER BY id), '')) FROM "User"
    ORDER BY name`
}

async function runScenarios(setup: PrismaClient, client: () => PrismaClient) {
  const [{ createLearningTaskService }, { createLearningSubmissionService }, { createLearningSubmissionReviewService }, { prisma }] = await Promise.all([
    import('../../../src/lib/learning-task-service'), import('../../../src/lib/learning-submission-service'),
    import('../../../src/lib/learning-submission-review-service'), import('../../../src/lib/prisma'),
  ])
  const runId = 'g2-pg-' + randomUUID()
  log('RUN', { runId })
  const deps = (db: PrismaClient, id: string) => ({ db, actor: async () => ({ id }), now: () => new Date() })
  const edit = (db: PrismaClient, f: Fixture, task: LearningTask, title: string) => createLearningTaskService(deps(db, f.creator))
    .update(f.space, task.id, { expectedVersion: task.version, title })
  const learner = (db: PrismaClient, f: Fixture) => createLearningSubmissionService(deps(db, f.assignee))
  const globalBefore = await isolatedTables(setup)

  async function scenario(label: string, verify: (f: Fixture, initial: LearningTask, viewed: SubmissionFreshness) => Promise<object>) {
    const f = fixtureIds(runId, label)
    // Fixture parents are committed atomically before this runner owns their IDs.
    await createFixture(setup, f)
    try {
      const before = await isolatedTables(setup)
      const task = await createLearningTaskService(deps(setup, f.creator)).create(f.space, {
        assigneeId: f.assignee, title: 'Requirements V1', description: 'Synthetic G2 task',
        acceptanceCriteria: 'Synthetic criteria', dueAt: due.toISOString(), topicId: f.topic,
      })
      assert.equal(task.status, 'OPEN')
      assert.equal(task.version, 1)
      const result = await verify(f, task, freshness(task, null))
      assert.deepEqual(await isolatedTables(setup), before, 'Booking, GivePoint or ledger state changed in ' + label)
      log('SCENARIO_PASS', { label, taskId: task.id, ...result, bookingWalletLedgerUnchanged: true })
    } finally {
      try { await cleanup(setup, f) }
      catch (error) { log('CLEANUP_FAILED', { label, key: f.key }); throw error }
    }
  }

  try {
    await scenario('R1', async (f, task, viewed) => {
      const edited = await edit(setup, f, task, 'Requirements V2')
      const before = await persisted(setup, task)
      assert.deepEqual(before.task, edited)
      assert.equal(edited.title, 'Requirements V2')
      assert.equal(edited.version, task.version + 1)
      assert.equal(edited.status, 'OPEN')
      assert.equal(before.submissions.length, 0)
      assert.deepEqual(before.events.map(row => row.eventType), ['LEARNING_TASK_ASSIGNED'])
      const g2 = learner(setup, f)
      await assert.rejects(g2.submit(f.space, task.id, { content: 'Stale answer', freshness: viewed }), { status: 409, code: 'TASK_REQUIREMENTS_CHANGED' })
      assert.deepEqual(await persisted(setup, task), before)
      const latest = await g2.currentWithTask(f.space, task.id)
      await g2.submit(f.space, task.id, { content: 'Fresh answer', freshness: freshness(latest.task, latest.submission) })
      assertFirstCommit(await persisted(setup, task), edited, 'Fresh answer')
      return { conflict: 'TASK_REQUIREMENTS_CHANGED', versionAfterEdit: edited.version, versionAfterRetry: edited.version + 1 }
    })

    for (const [label, winner] of [['R2', 'left'], ['R3', 'right']] as const) {
      await scenario(label, async (f, task, viewed) => {
        const before = await persisted(setup, task)
        const { outcomes: [updated, submitted], claims } = await overlap(setup, client, label, task,
          db => edit(db, f, task, 'Requirements V2'),
          db => learner(db, f).submit(f.space, task.id, { content: 'Race answer', freshness: viewed }), winner)
        const after = await persisted(setup, task)
        if (winner === 'left') {
          assert.ok(updated.ok)
          assert.ok(!submitted.ok && submitted.status === 409 && submitted.code === undefined)
          assert.deepEqual(claims, [{ count: 1 }, { prismaError: 'P2034' }])
          assert.deepEqual(after, { ...before, task: updated.value })
          assert.equal(after.task.title, 'Requirements V2')
          assert.equal(after.task.status, 'OPEN')
          assert.equal(after.task.version, task.version + 1)
        } else {
          assert.ok(submitted.ok)
          assert.ok(!updated.ok && updated.status === 409)
          assert.deepEqual(claims, [{ count: 0 }, { count: 1 }])
          assertFirstCommit(after, task, 'Race answer')
        }
        return { winner: winner === 'left' ? 'G1' : 'G2', taskStatus: after.task.status, version: after.task.version, submissions: after.submissions.length }
      })
    }

    await scenario('R4', async (f, task, viewed) => {
      const submit = (db: PrismaClient, content: string) => learner(db, f).submit(f.space, task.id, { content, freshness: viewed })
      const { outcomes, claims } = await overlap(setup, client, f.label, task,
        db => submit(db, 'Left answer'), db => submit(db, 'Right answer'), 'both')
      const winners = outcomes.filter(result => result.ok)
      const losers = outcomes.filter(result => !result.ok)
      assert.equal(winners.length, 1)
      assert.equal(losers.length, 1)
      assert.equal(losers[0].status, 409)
      assert.equal(losers[0].code, undefined)
      assert.equal(claims.filter(claim => claim.count === 1).length, 1)
      assert.equal(claims.filter(claim => claim.prismaError === 'P2034').length, 1)
      const after = await persisted(setup, task)
      assert.ok(winners[0].value.content)
      assertFirstCommit(after, task, winners[0].value.content)
      assert.equal(after.submissions[0].id, winners[0].value.id)
      return { winner: outcomes[0].ok ? 'left' : 'right', revision: 1, version: after.task.version }
    })

    await scenario('R5', async (f, task, viewed) => {
      const g2 = learner(setup, f)
      const g3 = createLearningSubmissionReviewService(deps(setup, f.creator))
      const first = await g2.submit(f.space, task.id, { content: 'Original answer', freshness: viewed })
      const submitted = await persisted(setup, task)
      assertFirstCommit(submitted, task, 'Original answer')
      const reviewBody = { submissionId: first.id, revisionCount: 1, content: 'Revise answer' }
      assert.equal((await g3.current(f.space, task.id)).canReview, true)
      const request = await g3.review(f.space, task.id, { ...reviewBody, outcome: 'REVISION_REQUESTED', revisionDueAt: revisionDue.toISOString() })
      const reopened = await persisted(setup, task)
      assert.equal(reopened.task.status, 'REVISION_REQUESTED')
      assert.equal(reopened.task.version, submitted.task.version + 1)
      assert.deepEqual(reopened.task.dueAt, revisionDue)
      assert.equal(reopened.submissions[0].status, 'REVISION_REQUESTED')
      assert.equal(reopened.submissions[0].content, first.content)
      assert.equal(reopened.submissions[0].revisionCount, 1)
      const latest = await g2.currentWithTask(f.space, task.id)
      const current = freshness(latest.task, latest.submission)
      assert.deepEqual(current, freshness(reopened.task, reopened.submissions[0]))
      await assert.rejects(g2.submit(f.space, task.id, { content: 'Stale deadline', freshness: { ...current, requirements: viewed.requirements } }),
        { status: 409, code: 'TASK_REQUIREMENTS_CHANGED' })
      assert.deepEqual(await persisted(setup, task), reopened)
      for (const previousSubmission of [viewed.previousSubmission, { submissionId: first.id, revisionCount: 2 }]) {
        await assert.rejects(g2.submit(f.space, task.id, { content: 'Stale identity', freshness: { ...current, previousSubmission } }),
          { status: 409, code: 'STALE_SUBMISSION_REVISION' })
        assert.deepEqual(await persisted(setup, task), reopened)
      }

      // A run-owned key causes a real unique-index failure after the G2 writes.
      const collision = await setup.learningActivity.create({ data: {
        id: f.key + '-collision', learningSpaceId: f.space, actorId: f.assignee, eventType: 'LEARNING_SUBMISSION_REVISED',
        entityType: 'Submission', entityId: first.id, eventKey: 'learning-submission:' + first.id + ':revision:2',
      } })
      const rollbackBefore = await persisted(setup, task)
      const rollbackClient = client()
      const operations: string[] = []
      rollbackClient.$use(async (params, next) => {
        try {
          const result = await next(params)
          if (params.action === 'updateMany') operations.push(params.model + ':count=' + result.count)
          return result
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError) operations.push(params.model + ':' + error.code)
          throw error
        }
      })
      try {
        await assert.rejects(learner(rollbackClient, f).submit(f.space, task.id, { content: 'Rolled back answer', freshness: current }),
          { status: 409, message: 'Submission changed; refresh and try again' })
        assert.deepEqual(operations, ['LearningTask:count=1', 'Submission:count=1', 'LearningActivity:P2002'])
        assert.deepEqual(await persisted(setup, task), rollbackBefore)
      } finally { await rollbackClient.$disconnect() }
      await setup.learningActivity.delete({ where: { id: collision.id, learningSpaceId: f.space } })
      assert.deepEqual(await persisted(setup, task), reopened)

      const second = await g2.submit(f.space, task.id, { content: 'Revised answer', freshness: current })
      const revised = await persisted(setup, task)
      assert.equal(second.id, first.id)
      assert.equal(second.revisionCount, 2)
      assert.deepEqual(revised.submissions, [second])
      assert.equal(revised.task.status, 'SUBMITTED')
      assert.equal(revised.task.version, reopened.task.version + 1)
      assert.deepEqual(revised.task.dueAt, revisionDue)
      assert.deepEqual(revised.reviews, reopened.reviews)
      assert.equal((await g3.current(f.space, task.id)).canReview, true)
      await assert.rejects(g3.review(f.space, task.id, { ...reviewBody, outcome: 'REVIEWED' }), { status: 409 })
      assert.deepEqual(await persisted(setup, task), revised)
      const final = await g3.review(f.space, task.id, { ...reviewBody, revisionCount: 2, outcome: 'REVIEWED', content: 'Approved answer' })
      const after = await persisted(setup, task)
      assert.equal(after.task.status, 'COMPLETED')
      assert.equal(after.task.version, revised.task.version + 1)
      assert.deepEqual(after.submissions, [final.submission])
      assert.equal(after.submissions[0].id, first.id)
      assert.equal(after.submissions[0].revisionCount, 2)
      assert.equal(after.submissions[0].status, 'REVIEWED')
      assert.equal(after.submissions[0].content, 'Revised answer')
      assert.equal(after.reviews.length, 1)
      assert.equal(after.reviews[0].id, request.review.id)
      assert.equal(after.reviews[0].outcome, 'REVIEWED')
      assert.deepEqual(after.events.map(row => [row.eventType, row.eventKey]).sort(), [
        ['LEARNING_REVISION_REQUESTED', 'learning-submission-review:' + first.id + ':revision:1'],
        ['LEARNING_SUBMISSION_REVIEWED', 'learning-submission-review:' + first.id + ':revision:2'],
        ['LEARNING_SUBMISSION_CREATED', 'learning-submission:' + first.id + ':revision:1'],
        ['LEARNING_SUBMISSION_REVISED', 'learning-submission:' + first.id + ':revision:2'],
        ['LEARNING_TASK_ASSIGNED', 'learning-task:' + task.id + ':assigned'],
      ].sort())
      return { staleDeadline: 409, staleIdentity: 409, rolledBack: operations, submissionId: first.id, revision: 2, finalStatus: after.task.status, version: after.task.version }
    })

    for (const name of ['same-value', 'revert', 'start', 'archived-topic', 'offset']) {
      await scenario('R6-' + name, async (f, task, viewed) => {
        let before = task
        if (name === 'same-value') before = await edit(setup, f, task, task.title)
        if (name === 'revert') {
          const changed = await edit(setup, f, task, 'Requirements V2')
          assert.equal(changed.title, 'Requirements V2')
          before = await edit(setup, f, changed, task.title)
        }
        if (name === 'start') {
          before = await createLearningTaskService(deps(setup, f.assignee)).update(f.space, task.id, { expectedVersion: task.version, action: 'START' })
          assert.equal(before.status, 'IN_PROGRESS')
        }
        if (name === 'archived-topic') {
          const topic = await setup.learningTopic.update({ where: { id: f.topic, learningSpaceId: f.space }, data: { state: 'ARCHIVED', archivedAt: new Date() } })
          assert.equal(topic.state, 'ARCHIVED')
          assert.equal(before.topicId, topic.id)
        }
        if (name === 'offset') {
          viewed.requirements.dueAt = new Date(due.getTime() + 7 * 3_600_000).toISOString().replace('Z', '+07:00')
          assert.notEqual(viewed.requirements.dueAt, due.toISOString())
          assert.equal(Date.parse(viewed.requirements.dueAt), due.getTime())
        }
        assert.equal(before.version, task.version + (name === 'revert' ? 2 : ['same-value', 'start'].includes(name) ? 1 : 0))
        await learner(setup, f).submit(f.space, task.id, { content: 'Effective equality', freshness: viewed })
        assertFirstCommit(await persisted(setup, task), before, 'Effective equality')
        return { versionBefore: before.version, versionAfter: before.version + 1 }
      })
    }
  } finally {
    await prisma.$disconnect()
    assert.deepEqual(await isolatedTables(setup), globalBefore, 'Booking, GivePoint or ledger state differs from the baseline after cleanup')
  }
  log('FINAL_PASS', { runId, scenarios: 10, overlapped: ['R2', 'R3', 'R4'], cleanupVerified: true, bookingWalletLedgerUnchanged: true })
}

async function main() {
  const parity = verifySources()
  log('SOURCE_PARITY', { manifestSha256: parity, node: process.version, prisma: Prisma.prismaVersion.client, engine: 'debian-openssl-3.0.x' })
  const env = readFileSync('.env')
  const { DISPOSABLE_TEST_DATABASE_URL: testUrl, DATABASE_URL: appUrl, DIRECT_URL: directUrl } = parse(env)
  assert.ok(testUrl && appUrl && directUrl, 'Missing Linux-local TEST or application comparison variable')
  assert.ok(projectRef(testUrl) === testProject, 'Disposable URL does not identify approved TEST project')
  assert.ok([appUrl, directUrl].every(url => url !== testUrl && projectRef(url) && projectRef(url) !== testProject), 'Application URLs must identify a different project')
  log('TARGET_GUARD', { testProject, distinctFromApplicationAndDirect: true })
  // Default application clients created by imports can only resolve to TEST here.
  process.env.DATABASE_URL = testUrl
  process.env.DIRECT_URL = testUrl
  const url = new URL(testUrl)
  url.searchParams.set('connection_limit', '1')
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '15')
  const client = () => new PrismaClient({ datasources: { db: { url: url.toString() } }, transactionOptions: { maxWait: 15_000, timeout: 30_000 } })
  const setup = client(), a = client(), b = client()
  try {
    assert.deepEqual(await setup.$queryRaw`SELECT 1 AS ok`, [{ ok: 1 }])
    log('SELECT_1', { ok: true })
    await verifyConnections(a, b)
    await verifySchema(setup)
    if (process.env.G2_POSTGRES_EXECUTE === '1') await runScenarios(setup, client)
    else log('READ_ONLY_PREFLIGHT_PASS', {})
  } finally {
    await Promise.all([setup.$disconnect(), a.$disconnect(), b.$disconnect()])
    assert.ok(readFileSync('.env').equals(env), 'Linux-local configuration changed')
    assert.equal(verifySources(), parity)
  }
}

main().catch((error: { name?: string; code?: string; errorCode?: string; status?: number }) => {
  // Do not print Prisma diagnostics, connection strings or assertion values.
  console.error(JSON.stringify({
    evidence: 'BLOCKED', name: error.name, code: error.code ?? error.errorCode, status: error.status,
    assertion: error instanceof assert.AssertionError ? error.message.split('\n')[0] : undefined,
    location: error instanceof Error ? error.stack?.split('\n').find(line => line.includes('learning-g2-stale-submission.test.ts:'))?.trim() : undefined,
  }))
  process.exitCode = 1
})
