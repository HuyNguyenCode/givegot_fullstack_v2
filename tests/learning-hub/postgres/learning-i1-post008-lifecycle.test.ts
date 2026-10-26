// Explicit, DML-only disposable TEST runner. Never invoke against an application database.
import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

const sourceRoot = '/mnt/f/givegot/givegot-v2'
const sources = [
  'prisma/schema.prisma',
  'src/lib/learning-fulfillment-service.ts',
  'src/lib/learning-activity-service.ts',
  'tests/learning-hub/postgres/learning-i1-post008-lifecycle.test.ts',
]
const digest = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
for (const file of sources) assert.equal(digest(file), digest(resolve(sourceRoot, file)), `Source parity: ${file}`)
assert.equal(readFileSync('prisma/schema.prisma', 'utf8').replace(/\s+/g, ''), readFileSync('node_modules/.prisma/client/schema.prisma', 'utf8').replace(/\s+/g, ''), 'Linux Prisma client schema is stale')

const env = parse(readFileSync('.env'))
const testUrl = env.DISPOSABLE_TEST_DATABASE_URL
assert.ok(testUrl && process.env.I1_POSTGRES_EXECUTE === '1', 'Explicit disposable TEST execution required')
const identity = (raw: string) => {
  const url = new URL(raw)
  return `${url.hostname}|${url.port}|${decodeURIComponent(url.username)}|${url.pathname}`
}
assert.match(identity(testUrl), /yxyipetjooqsysdhruut/, 'Unexpected TEST project')
for (const key of ['DATABASE_URL', 'DIRECT_URL']) if (env[key]) assert.notEqual(identity(testUrl), identity(env[key]), `${key} targets TEST`)
process.env.DATABASE_URL = testUrl

const db = new PrismaClient({ datasources: { db: { url: testUrl } } })
const marker = `i1-post008-${randomUUID()}`
const mentor = randomUUID(), learner = randomUUID(), outsider = randomUUID()
const skill = randomUUID(), space = randomUUID(), exercise = randomUUID(), hybrid = randomUUID()
const exerciseTask = randomUUID(), exerciseSubmission = randomUUID(), exerciseReview = randomUUID()
const hybridTask = randomUUID(), hybridSubmission = randomUUID(), hybridReview = randomUUID()
const exerciseRecap = randomUUID(), hybridRecap = randomUUID()
const users = [mentor, learner, outsider], bookings = [exercise, hybrid]
const start = new Date(Date.now() - 3 * 86400000)
const end = new Date(Date.now() - 2 * 86400000)
const prework = new Date(start.getTime() - 86400000)
const reviewed = new Date(start.getTime() - 3600000)
let fixtures = false

async function preflight() {
  const ping = await db.$queryRaw<Array<{ one: number }>>`SELECT 1 AS one`
  assert.equal(ping[0].one, 1)
  const schema = await db.$queryRaw<Array<{ version: boolean; task: boolean; review: boolean; note: boolean; activity: boolean; disputed: boolean; cancelled: boolean }>>`SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Booking' AND column_name='fulfillmentVersion') AS version,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='LearningTask' AND column_name='version') AS task,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='SubmissionReview') AS review,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='LearningNote' AND column_name='deletedAt') AS note,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='LearningActivity') AS activity,
    EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='FulfillmentStatus' AND e.enumlabel='DISPUTED') AS disputed,
    EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='FulfillmentStatus' AND e.enumlabel='CANCELLED') AS cancelled`
  assert.ok(Object.values(schema[0]).every(Boolean), 'Required 004-008 TEST schema is missing')
  console.log(JSON.stringify({ evidence: 'PREFLIGHT', testProject: 'yxyipetjooqsysdhruut', select1: true, schema004to008: true }))
}

async function createFixtures() {
  await db.$transaction(async tx => {
    for (const [id, role] of [[mentor, 'mentor'], [learner, 'learner'], [outsider, 'outsider']]) {
      await tx.$executeRaw`INSERT INTO "User" (id,email,"createdAt","updatedAt") VALUES (${id},${`${marker}-${role}@example.invalid`},now(),now())`
    }
    await tx.$executeRaw`INSERT INTO "Skill" (id,name,slug,"createdAt","updatedAt") VALUES (${skill},${marker},${marker},now(),now())`
    await tx.$executeRaw`INSERT INTO "LearningSpace" (id,title,"primarySkillId","createdById") VALUES (${space},${marker},${skill},${mentor})`
    await tx.$executeRaw`INSERT INTO "LearningSpaceMember" ("learningSpaceId","userId") VALUES (${space},${mentor}),(${space},${learner})`
    await tx.$executeRaw`INSERT INTO "Booking" (id,"mentorId","menteeId","startTime","endTime",status,"learningSpaceId","learningMode",objective,"fulfillmentStatus","fulfillmentVersion") VALUES
      (${exercise},${mentor},${learner},${start},${end},'CONFIRMED',${space},'EXERCISE_REVIEW','Synthetic exercise','NOT_STARTED',0),
      (${hybrid},${mentor},${learner},${start},${end},'CONFIRMED',${space},'HYBRID','Synthetic hybrid','NOT_STARTED',0)`
    await tx.$executeRaw`UPDATE "Booking" SET "meetingUrl"='https://meet.example.invalid/i1-hybrid' WHERE id=${hybrid}`
    await tx.$executeRaw`INSERT INTO "LearningNote" (id,"learningSpaceId","bookingId","authorId",content,type) VALUES
      (${exerciseRecap},${space},${exercise},${mentor},'Synthetic exercise note','GENERAL'),
      (${hybridRecap},${space},${hybrid},${mentor},'Synthetic hybrid recap','RECAP')`
  })
  fixtures = true
}

async function addReviewedTask(bookingId: string, taskId: string, submissionId: string, reviewId: string, submittedAt: Date) {
  await db.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO "LearningTask" (id,"learningSpaceId","bookingId","creatorId","assigneeId",title,status) VALUES
      (${taskId},${space},${bookingId},${mentor},${learner},${marker},'COMPLETED')`
    await tx.$executeRaw`INSERT INTO "Submission" (id,"taskId","authorId",content,status,"submittedAt") VALUES
      (${submissionId},${taskId},${learner},'Synthetic prework','REVIEWED',${submittedAt})`
    await tx.$executeRaw`INSERT INTO "SubmissionReview" (id,"submissionId","reviewerId",content,outcome,"reviewedAt") VALUES
      (${reviewId},${submissionId},${mentor},'Synthetic feedback','REVIEWED',${reviewed})`
  })
}

async function row(bookingId: string) {
  return db.booking.findUniqueOrThrow({ where: { id: bookingId }, select: {
    status: true, fulfillmentStatus: true, fulfillmentVersion: true, deliveredAt: true, acceptedAt: true,
  } })
}
async function events(bookingId: string) {
  return db.learningActivity.findMany({ where: { bookingId, eventType: 'LEARNING_FULFILLMENT_CHANGED' }, orderBy: { eventKey: 'asc' },
    select: { eventKey: true, actorId: true, metadata: true } })
}
async function financial() {
  const points = await db.user.findMany({ where: { id: { in: users } }, orderBy: { id: 'asc' }, select: { id: true, givePoints: true } })
  const logs = await db.transactionLog.count({ where: { bookingId: { in: bookings } } })
  return { points, logs }
}
async function cleanup() {
  if (!fixtures) return
  await db.$transaction(async tx => {
    await tx.submissionReview.deleteMany({ where: { id: { in: [exerciseReview, hybridReview] } } })
    await tx.submission.deleteMany({ where: { id: { in: [exerciseSubmission, hybridSubmission] } } })
    await tx.learningTask.deleteMany({ where: { id: { in: [exerciseTask, hybridTask] } } })
    await tx.learningActivity.deleteMany({ where: { learningSpaceId: space } })
    await tx.learningNote.deleteMany({ where: { id: { in: [exerciseRecap, hybridRecap] } } })
    await tx.booking.deleteMany({ where: { id: { in: bookings } } })
    await tx.learningSpaceMember.deleteMany({ where: { learningSpaceId: space } })
    await tx.learningSpace.deleteMany({ where: { id: space } })
    await tx.skill.deleteMany({ where: { id: skill } })
    await tx.user.deleteMany({ where: { id: { in: users } } })
  })
  const remaining = await db.$queryRaw<Array<{ n: bigint }>>`SELECT
    (SELECT count(*) FROM "User" WHERE id IN (${mentor},${learner},${outsider})) +
    (SELECT count(*) FROM "Skill" WHERE id=${skill}) +
    (SELECT count(*) FROM "LearningSpace" WHERE id=${space}) +
    (SELECT count(*) FROM "LearningSpaceMember" WHERE "learningSpaceId"=${space}) +
    (SELECT count(*) FROM "Booking" WHERE id IN (${exercise},${hybrid})) +
    (SELECT count(*) FROM "LearningTask" WHERE id IN (${exerciseTask},${hybridTask})) +
    (SELECT count(*) FROM "Submission" WHERE id IN (${exerciseSubmission},${hybridSubmission})) +
    (SELECT count(*) FROM "SubmissionReview" WHERE id IN (${exerciseReview},${hybridReview})) +
    (SELECT count(*) FROM "LearningNote" WHERE id IN (${exerciseRecap},${hybridRecap})) +
    (SELECT count(*) FROM "LearningActivity" WHERE "learningSpaceId"=${space}) AS n`
  assert.equal(Number(remaining[0].n), 0, 'Test-owned fixtures remain')
  console.log(JSON.stringify({ evidence: 'FIXTURE_CLEANUP', remaining: 0 }))
}

async function main() {
  await preflight()
  const { createLearningFulfillmentService } = await import('../../../src/lib/learning-fulfillment-service')
  const as = (actorId: string) => createLearningFulfillmentService({ db: db as never, actor: (async () => ({ id: actorId })) as never, now: () => new Date() })
  const claim = (actorId: string, bookingId: string, action: 'START' | 'DELIVER' | 'REQUEST_REVISION' | 'RESUME' | 'ACCEPT', expectedVersion: number) =>
    as(actorId).transition(space, bookingId, { action, expectedVersion })
  const denied = async (promise: Promise<unknown>, status: number, message: RegExp) => {
    await assert.rejects(promise, error => (error as { status?: number; message?: string }).status === status && message.test((error as Error).message))
  }
  try {
    await createFixtures()
    const baseline = await financial()
    await denied(as(outsider).read(space, exercise), 403, /membership required/)
    await denied(claim(outsider, exercise, 'START', 0), 403, /membership required/)
    assert.deepEqual(await as(learner).read(space, exercise), { bookingId: exercise, status: 'NOT_STARTED', version: 0, deliveredAt: null, acceptedAt: null })

    await claim(learner, exercise, 'START', 0)
    await denied(claim(learner, exercise, 'DELIVER', 1), 403, /Booking role/)
    await denied(claim(mentor, exercise, 'DELIVER', 1), 409, /TASK_SUBMISSION_FEEDBACK/)
    assert.equal((await row(exercise)).fulfillmentVersion, 1)
    await addReviewedTask(exercise, exerciseTask, exerciseSubmission, exerciseReview, prework)
    const firstDelivery = await claim(mentor, exercise, 'DELIVER', 1)
    assert.equal(firstDelivery.version, 2)
    assert.ok(firstDelivery.deliveredAt)
    await claim(learner, exercise, 'REQUEST_REVISION', 2)
    assert.equal((await row(exercise)).fulfillmentStatus, 'REVISION_REQUESTED')
    await claim(mentor, exercise, 'RESUME', 3)
    assert.equal((await row(exercise)).deliveredAt, null)
    const secondDelivery = await claim(mentor, exercise, 'DELIVER', 4)
    assert.ok(secondDelivery.deliveredAt)
    assert.equal(secondDelivery.version, 5)
    await denied(claim(mentor, exercise, 'DELIVER', 4), 409, /version conflict/)
    const accepted = await claim(learner, exercise, 'ACCEPT', 5)
    assert.equal(accepted.version, 6)
    const exerciseRow = await row(exercise)
    assert.equal(exerciseRow.status, 'CONFIRMED')
    assert.equal(exerciseRow.fulfillmentStatus, 'ACCEPTED')
    assert.equal(exerciseRow.fulfillmentVersion, 6)
    assert.ok(exerciseRow.deliveredAt && exerciseRow.acceptedAt)
    const exerciseEvents = await events(exercise)
    assert.equal(exerciseEvents.length, 6)
    assert.equal(new Set(exerciseEvents.map(e => e.eventKey)).size, 6)
    assert.deepEqual(exerciseEvents.map(e => e.metadata), [
      { fulfillmentStatus: 'IN_PROGRESS', version: 1 },
      { fulfillmentStatus: 'DELIVERED', version: 2 },
      { fulfillmentStatus: 'REVISION_REQUESTED', version: 3 },
      { fulfillmentStatus: 'IN_PROGRESS', version: 4 },
      { fulfillmentStatus: 'DELIVERED', version: 5 },
      { fulfillmentStatus: 'ACCEPTED', version: 6 },
    ])
    assert.deepEqual(exerciseEvents.map(e => e.actorId).sort(), [learner, learner, learner, mentor, mentor, mentor].sort())
    console.log(JSON.stringify({ evidence: 'EXERCISE_REVISION_LOOP', state: 'ACCEPTED', version: 6, auditEvents: 6, noDuplicateReplay: true }))

    await claim(mentor, hybrid, 'START', 0)
    await denied(claim(mentor, hybrid, 'DELIVER', 1), 409, /PREWORK_AND_ACKNOWLEDGEMENT/)
    const blockedHybrid = await row(hybrid)
    assert.equal(blockedHybrid.status, 'CONFIRMED')
    assert.equal(blockedHybrid.fulfillmentStatus, 'IN_PROGRESS')
    assert.equal(blockedHybrid.fulfillmentVersion, 1)
    assert.equal(blockedHybrid.deliveredAt, null)
    await addReviewedTask(hybrid, hybridTask, hybridSubmission, hybridReview, prework)
    await claim(mentor, hybrid, 'DELIVER', 1)
    const hybridRow = await row(hybrid)
    assert.equal(hybridRow.fulfillmentStatus, 'DELIVERED')
    assert.equal(hybridRow.fulfillmentVersion, 2)
    assert.ok(hybridRow.deliveredAt)
    assert.deepEqual((await events(hybrid)).map(e => e.metadata), [
      { fulfillmentStatus: 'IN_PROGRESS', version: 1 },
      { fulfillmentStatus: 'DELIVERED', version: 2 },
    ])
    console.log(JSON.stringify({ evidence: 'HYBRID_AFTER_MEETING', blockedWithoutPrework: true, deliveredWithReviewedPrework: true, version: 2, auditEvents: 2 }))
    assert.deepEqual(await financial(), baseline, 'I1 changed GP or TransactionLog')
    console.log(JSON.stringify({ evidence: 'FINANCIAL_INVARIANCE', givePointsUnchanged: true, transactionLogUnchanged: true, bookingStatusUnchanged: true }))
  } finally {
    await cleanup()
  }
}

main().catch(error => { console.error(error); process.exitCode = 1 }).finally(async () => { await db.$disconnect() })
