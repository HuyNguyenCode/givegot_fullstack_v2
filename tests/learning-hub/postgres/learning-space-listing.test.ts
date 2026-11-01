// Explicit, DML-only test against the approved disposable PostgreSQL TEST project.
import assert from 'node:assert/strict'
import { randomUUID, createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'
import { PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

const sourceRoot = '/mnt/f/givegot/givegot-v2'
const sources = [
  'prisma/schema.prisma',
  'src/lib/prisma.ts',
  'src/lib/auth.ts',
  'src/lib/server-authorization.ts',
  'src/lib/learning-space-listing.ts',
  'src/lib/learning-space-listing-handler.ts',
  'src/app/api/learning/spaces/route.ts',
  'tests/learning-hub/postgres/learning-space-listing.test.ts',
]
const hash = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex')
for (const file of sources) assert.equal(hash(file), hash(resolve(sourceRoot, file)), `Source parity: ${file}`)
assert.equal(readFileSync('prisma/schema.prisma', 'utf8').replace(/\s+/g, ''), readFileSync('node_modules/.prisma/client/schema.prisma', 'utf8').replace(/\s+/g, ''), 'Linux Prisma Client schema is stale')

const env = parse(readFileSync('.env'))
const testUrl = env.DISPOSABLE_TEST_DATABASE_URL
assert.ok(testUrl, 'DISPOSABLE_TEST_DATABASE_URL is required')
const identity = (raw: string) => {
  const url = new URL(raw)
  return `${url.hostname}|${url.port}|${decodeURIComponent(url.username)}|${url.pathname}`
}
assert.match(identity(testUrl), /yxyipetjooqsysdhruut/, 'Unexpected TEST project')
for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
  if (env[key]) assert.notEqual(identity(testUrl), identity(env[key]), `${key} targets TEST`)
}
process.env.DATABASE_URL = testUrl

const db = new PrismaClient({ datasources: { db: { url: testUrl } } })
const marker = `task1-list-${randomUUID()}`
const [userA, userB, userC, skill, space1, space2, space3, note] = Array.from({ length: 8 }, () => randomUUID())
const userIds = [userA, userB, userC]
const spaceIds = [space1, space2, space3]

async function preflight() {
  const ping = await db.$queryRaw<Array<{ one: number }>>`SELECT 1 AS one`
  assert.equal(ping[0]?.one, 1)
  const required = await db.$queryRaw<Array<{ space: boolean; member: boolean; skill: boolean; user: boolean; memberStatus: boolean }>>`SELECT
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='LearningSpace' AND column_name='primarySkillId') AS space,
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='LearningSpaceMember' AND column_name='status') AS member,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Skill') AS skill,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='User') AS "user",
    EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid WHERE t.typname='LearningSpaceMemberStatus' AND e.enumlabel='LEFT') AS "memberStatus"`
  assert.ok(required[0] && Object.values(required[0]).every(Boolean), 'Required LearningSpace or membership schema is missing')
  console.log(JSON.stringify({ evidence: 'PREFLIGHT', project: 'yxyipetjooqsysdhruut', select1: true, schema: true, sourceParity: true }))
}

async function createFixtures() {
  await db.$transaction(async tx => {
    for (const [id, suffix] of [[userA, 'a'], [userB, 'b'], [userC, 'c']]) {
      await tx.$executeRaw`INSERT INTO "User" (id,email,name,"createdAt","updatedAt") VALUES (${id},${`${marker}-${suffix}@example.invalid`},${`Test ${suffix}`},now(),now())`
    }
    await tx.$executeRaw`INSERT INTO "Skill" (id,name,slug,"createdAt","updatedAt") VALUES (${skill},${marker},${marker},now(),now())`
    await tx.$executeRaw`INSERT INTO "LearningSpace" (id,title,"primarySkillId","createdById",objective) VALUES (${space1},${`${marker}-active`},${skill},${userA},'PRIVATE_OBJECTIVE_SENTINEL')`
    await tx.$executeRaw`INSERT INTO "LearningSpace" (id,title,"primarySkillId","createdById",state) VALUES (${space2},${`${marker}-archived`},${skill},${userA},'ARCHIVED')`
    await tx.$executeRaw`INSERT INTO "LearningSpace" (id,title,"primarySkillId","createdById") VALUES (${space3},${`${marker}-third`},${skill},${userA})`
    await tx.$executeRaw`INSERT INTO "LearningSpaceMember" ("learningSpaceId","userId",status) VALUES (${space1},${userA},'ACTIVE'),(${space1},${userB},'ACTIVE'),(${space2},${userA},'ACTIVE'),(${space2},${userB},'REMOVED'),(${space3},${userA},'ACTIVE'),(${space3},${userC},'LEFT')`
    await tx.$executeRaw`INSERT INTO "LearningNote" (id,"learningSpaceId","authorId",content,type) VALUES (${note},${space1},${userA},'PRIVATE_NOTE_SENTINEL','GENERAL')`
  })
}

async function cleanup() {
  await db.$transaction(async tx => {
    await tx.learningNote.deleteMany({ where: { id: note } })
    await tx.learningSpaceMember.deleteMany({ where: { learningSpaceId: { in: spaceIds }, userId: { in: userIds } } })
    await tx.learningSpace.deleteMany({ where: { id: { in: spaceIds } } })
    await tx.skill.deleteMany({ where: { id: skill } })
    await tx.user.deleteMany({ where: { id: { in: userIds } } })
  })
  const [users, skills, spaces, members, notes] = await Promise.all([
    db.user.count({ where: { id: { in: userIds } } }),
    db.skill.count({ where: { id: skill } }),
    db.learningSpace.count({ where: { id: { in: spaceIds } } }),
    db.learningSpaceMember.count({ where: { learningSpaceId: { in: spaceIds } } }),
    db.learningNote.count({ where: { id: note } }),
  ])
  assert.deepEqual({ users, skills, spaces, members, notes }, { users: 0, skills: 0, spaces: 0, members: 0, notes: 0 })
  console.log(JSON.stringify({ evidence: 'CLEANUP', runOwnedRowsRemaining: 0 }))
}

test('Task 1 real PostgreSQL My Spaces listing', async t => {
  await preflight()
  if (process.env.TASK1_PREFLIGHT_ONLY === '1') { await db.$disconnect(); return }
  assert.equal(process.env.TASK1_REAL_TEST, '1', 'Explicit real TEST execution required')
  const { prisma } = await import('../../../src/lib/prisma')
  const { findListingSpaces, createSpaceListing } = await import('../../../src/lib/learning-space-listing')
  const { createSpaceListingHandler } = await import('../../../src/lib/learning-space-listing-handler')
  const { AuthorizationError } = await import('../../../src/lib/server-authorization')
  try {
    await createFixtures()
    const a = await findListingSpaces(userA)
    const b = await findListingSpaces(userB)
    const c = await findListingSpaces(userC)
    await t.test('active membership', () => assert.equal(a.find(space => space.id === space1)?.partnerName, 'Test b'))
    await t.test('partner membership', () => assert.equal(b.find(space => space.id === space1)?.partnerName, 'Test a'))
    await t.test('nonmember isolation', () => assert.ok(!c.some(space => space.id === space1)))
    await t.test('multiple spaces without duplicates', () => {
      assert.deepEqual(new Set(a.map(space => space.id)), new Set(spaceIds))
      assert.equal(a.length, spaceIds.length)
    })
    await t.test('archived space retains active-member visibility', () => {
      assert.equal(a.find(space => space.id === space2)?.state, 'ARCHIVED')
    })
    await t.test('removed and left memberships are ineligible', () => {
      assert.deepEqual(b.map(space => space.id), [space1])
      assert.deepEqual(c, [])
    })
    await t.test('response contains only approved metadata', () => {
      for (const space of a) assert.deepEqual(Object.keys(space).sort(), ['id', 'partnerName', 'primarySkillName', 'state', 'title'])
      const json = JSON.stringify({ spaces: a })
      assert.ok(!json.includes('PRIVATE_OBJECTIVE_SENTINEL'))
      assert.ok(!json.includes('PRIVATE_NOTE_SENTINEL'))
      for (const key of ['storageKey', 'token', 'signedUrl', 'submission', 'task', 'resource', 'note']) assert.ok(!json.includes(`"${key}"`))
    })
    await t.test('session identity ignores client userId and missing session returns 401', async () => {
      const handler = createSpaceListingHandler(createSpaceListing({ authenticate: async () => ({ id: userA }), findAccount: userId => prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true, trustScore: true } }), findSpaces: findListingSpaces }))
      const response = await (handler as (request: Request) => Promise<Response>)(new Request(`http://localhost/api/learning/spaces?userId=${userC}`))
      assert.equal(response.status, 200)
      const payload = await response.json() as { spaces: Array<{ id: string }> }
      assert.deepEqual(new Set(payload.spaces.map(space => space.id)), new Set(spaceIds))
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const denied = createSpaceListingHandler(createSpaceListing({ authenticate: async () => { throw new AuthorizationError(401, 'Authentication required') }, findAccount: async () => { throw new Error('Account query must not run') }, findSpaces: async () => { throw new Error('Listing query must not run') } }))
      const missing = await denied()
      assert.equal(missing.status, 401)
      assert.deepEqual(await missing.json(), { error: 'Authentication required' })
    })
    await t.test('existing POST route export remains bound to its original collection handler', () => {
      const route = readFileSync('src/app/api/learning/spaces/route.ts', 'utf8')
      assert.match(route, /export const \{ POST \} = createLearningSpaceCollectionHandlers\(learningSpaceService\)/)
    })
    console.log(JSON.stringify({ evidence: 'REAL_POSTGRESQL_LISTING', cases: 9, activeSpacesForA: a.length, activeSpacesForB: b.length, activeSpacesForC: c.length }))
  } finally {
    await cleanup()
    await prisma.$disconnect()
    await db.$disconnect()
  }
})
