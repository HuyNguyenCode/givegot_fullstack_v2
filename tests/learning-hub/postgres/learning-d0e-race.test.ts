import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { PrismaClient } from '@prisma/client'
import { parse } from 'dotenv'

import type { LearningStorageProvider } from '../../../src/lib/learning-storage-provider'

type Gate = { reached: Promise<void>; release(): void }
type Fixture = { marker: string; users: [string, string]; skillId: string; spaceId: string; taskId: string; fileA: string; fileB: string }

function projectRef(raw: string): string | null {
  try {
    const url = new URL(raw)
    if (url.hostname.endsWith('.pooler.supabase.com')) return decodeURIComponent(url.username).split('.').at(-1) || null
    return /^db\.([^.]+)\.supabase\.co$/i.exec(url.hostname)?.[1] ?? null
  } catch { return null }
}

function controlledQuery(client: PrismaClient, model: string, action: string, resourceId: string): Gate {
  let signal!: () => void
  let resume!: () => void
  let active = true
  const reached = new Promise<void>(resolve => { signal = resolve })
  const released = new Promise<void>(resolve => { resume = resolve })
  client.$use(async (params, next) => {
    const result = await next(params)
    const where = params.args?.where as Record<string, unknown> | undefined
    const matches = model === 'Submission' ? where?.attachmentResourceId === resourceId : where?.id === resourceId
    if (active && params.model === model && params.action === action && matches) {
      active = false
      signal()
      await released
    }
    return result
  })
  return { reached, release: () => resume() }
}

async function reached(gate: Gate, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      gate.reached,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Transaction barrier was not reached: ${label}`)), 10000) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const settled = <T>(promise: Promise<T>) => promise.then(
  value => ({ status: 'fulfilled' as const, value }),
  reason => ({ status: 'rejected' as const, reason: reason as unknown }),
)

async function createFixture(db: PrismaClient): Promise<Fixture> {
  const marker = `d0e-race-${randomUUID()}`
  return db.$transaction(async tx => {
    const creator = await tx.user.create({ data: { email: `${marker}-creator@example.invalid`, name: marker } })
    const assignee = await tx.user.create({ data: { email: `${marker}-assignee@example.invalid`, name: marker } })
    const skill = await tx.skill.create({ data: { name: marker, slug: marker } })
    const space = await tx.learningSpace.create({ data: { title: marker, primarySkillId: skill.id, createdById: creator.id } })
    await tx.learningSpaceMember.createMany({ data: [
      { learningSpaceId: space.id, userId: creator.id },
      { learningSpaceId: space.id, userId: assignee.id },
    ] })
    const a = await tx.learningResource.create({ data: {
      learningSpaceId: space.id, uploaderId: assignee.id, kind: 'FILE', title: `${marker}-A.pdf`,
      storageKey: `spaces/${space.id}/resources/${marker}/A.pdf`, mimeType: 'application/pdf',
      sizeBytes: BigInt(1), status: 'READY', purpose: 'MATERIAL',
    } })
    const b = await tx.learningResource.create({ data: {
      learningSpaceId: space.id, uploaderId: assignee.id, kind: 'FILE', title: `${marker}-B.pdf`,
      storageKey: `spaces/${space.id}/resources/${marker}/B.pdf`, mimeType: 'application/pdf',
      sizeBytes: BigInt(1), status: 'READY', purpose: 'SUBMISSION_ATTACHMENT',
    } })
    const task = await tx.learningTask.create({ data: {
      learningSpaceId: space.id, creatorId: creator.id, assigneeId: assignee.id, title: marker,
    } })
    return { marker, users: [creator.id, assignee.id], skillId: skill.id, spaceId: space.id, taskId: task.id, fileA: a.id, fileB: b.id }
  })
}

async function cleanup(db: PrismaClient, f: Fixture) {
  await db.$transaction(async tx => {
    await tx.learningActivity.deleteMany({ where: { learningSpaceId: f.spaceId } })
    await tx.submission.deleteMany({ where: { taskId: f.taskId } })
    await tx.learningTask.deleteMany({ where: { id: f.taskId } })
    await tx.learningResource.deleteMany({ where: { id: { in: [f.fileA, f.fileB] }, learningSpaceId: f.spaceId } })
    await tx.learningSpaceMember.deleteMany({ where: { learningSpaceId: f.spaceId } })
    await tx.learningSpace.deleteMany({ where: { id: f.spaceId } })
    await tx.skill.deleteMany({ where: { id: f.skillId } })
    await tx.user.deleteMany({ where: { id: { in: f.users } } })
  })
  const remaining = await Promise.all([
    db.user.count({ where: { id: { in: f.users } } }),
    db.skill.count({ where: { id: f.skillId } }),
    db.learningSpace.count({ where: { id: f.spaceId } }),
    db.learningSpaceMember.count({ where: { learningSpaceId: f.spaceId } }),
    db.learningResource.count({ where: { id: { in: [f.fileA, f.fileB] } } }),
    db.learningTask.count({ where: { id: f.taskId } }),
    db.submission.count({ where: { taskId: f.taskId } }),
    db.learningActivity.count({ where: { learningSpaceId: f.spaceId } }),
  ])
  assert.ok(remaining.every(count => count === 0), 'run-owned fixtures must be fully removed')
}

test('D0e current FILE protection under real PostgreSQL Serializable transactions', async t => {
  const env = parse(readFileSync('.env'))
  const testUrl = env.DISPOSABLE_TEST_DATABASE_URL
  const testRef = testUrl && projectRef(testUrl)
  const appRefs = [env.DATABASE_URL, env.DIRECT_URL].map(value => value && projectRef(value))
  assert.ok(testUrl && testRef && appRefs.every(ref => ref && ref !== testRef), 'disposable TEST project identity must be distinct')
  process.env.DATABASE_URL = testUrl
  process.env.DIRECT_URL = testUrl

  const [{ createLearningStorageService, learningStorageRepository }, { createLearningSubmissionService }, { prisma }] = await Promise.all([
    import('../../../src/lib/learning-storage-service'),
    import('../../../src/lib/learning-submission-service'),
    import('../../../src/lib/prisma'),
  ])
  const setup = new PrismaClient({ datasources: { db: { url: testUrl } } })
  const removed: string[] = []
  const provider: LearningStorageProvider = {
    assertPrivateBucket: async () => {},
    signUpload: async () => { throw new Error('Not used') },
    stat: async () => null,
    readPrefix: async () => new Uint8Array(),
    promote: async () => { throw new Error('Not used') },
    signDownload: async () => { throw new Error('Not used') },
    remove: async key => { removed.push(key) },
  }
  const storage = (f: Fixture) => createLearningStorageService({
    repository: learningStorageRepository, provider,
    authenticatedUser: async () => ({ id: f.users[1], email: null, name: null }),
  })
  const submission = (f: Fixture, db: PrismaClient) => createLearningSubmissionService({
    db: db as typeof prisma, actor: async () => ({ id: f.users[1] }), now: () => new Date(),
  })

  async function race(winner: 'submit' | 'delete' | 'either') {
    const f = await createFixture(setup)
    const g2db = new PrismaClient({ datasources: { db: { url: testUrl } } })
    const beforeRemove = removed.length
    const g2Gate = controlledQuery(g2db, 'LearningResource', 'findFirst', f.fileA)
    const f1Gate = controlledQuery(prisma, 'Submission', 'findFirst', f.fileA)
    let submitResult: ReturnType<typeof settled<unknown>> | undefined
    let deleteResult: ReturnType<typeof settled<unknown>> | undefined
    try {
      await Promise.all([prisma.$connect(), g2db.$connect()])
      submitResult = settled(submission(f, g2db).submit(f.spaceId, f.taskId, { attachmentResourceId: f.fileA }))
      deleteResult = settled(storage(f).softDelete(f.spaceId, f.fileA))
      await Promise.all([reached(g2Gate, 'G2 READY validation'), reached(f1Gate, 'F1 current reference check')])
      if (winner === 'submit') {
        g2Gate.release()
        const submitted = await submitResult
        assert.equal(submitted.status, 'fulfilled')
        f1Gate.release()
      } else if (winner === 'delete') {
        f1Gate.release()
        const deleted = await deleteResult
        assert.equal(deleted.status, 'fulfilled')
        g2Gate.release()
      } else {
        g2Gate.release()
        f1Gate.release()
      }
      const [submitted, deleted] = await Promise.all([submitResult!, deleteResult!])
      const file = await setup.learningResource.findUniqueOrThrow({ where: { id: f.fileA } })
      const current = await setup.submission.findUnique({ where: { taskId: f.taskId } })
      assert.ok(!(file.status === 'DELETED' && current?.attachmentResourceId === f.fileA), 'committed state must preserve the attachment invariant')
      if (winner === 'submit') {
        assert.equal(submitted.status, 'fulfilled')
        assert.equal(deleted.status, 'rejected')
        assert.equal((deleted as PromiseRejectedResult).reason.status, 409)
        assert.equal((deleted as PromiseRejectedResult).reason.message, 'File state changed; refresh and try again')
        assert.equal(file.status, 'READY')
        assert.equal(current?.attachmentResourceId, f.fileA)
        assert.equal(removed.length, beforeRemove)
      } else if (winner === 'delete') {
        assert.equal(deleted.status, 'fulfilled')
        assert.equal(submitted.status, 'rejected')
        assert.equal((submitted as PromiseRejectedResult).reason.status, 409)
        assert.equal((submitted as PromiseRejectedResult).reason.message, 'Submission changed; refresh and try again')
        assert.equal(file.status, 'DELETED')
        assert.equal(current, null)
        assert.ok(removed.length > beforeRemove)
      } else {
        assert.equal([submitted, deleted].filter(result => result.status === 'fulfilled').length, 1)
        assert.equal([submitted, deleted].filter(result => result.status === 'rejected').length, 1)
        const rejected = [submitted, deleted].find(result => result.status === 'rejected') as PromiseRejectedResult
        assert.equal(rejected.reason.status, 409)
      }
    } finally {
      f1Gate.release()
      g2Gate.release()
      await Promise.allSettled([submitResult, deleteResult].filter(Boolean) as Promise<unknown>[])
      await g2db.$disconnect()
      await cleanup(setup, f)
    }
  }

  try {
    await t.test('submit wins', () => race('submit'))
    await t.test('delete wins', () => race('delete'))
    await t.test('controlled overlap has one safe winner', () => race('either'))
    await t.test('revision replacement releases A and protects B', async () => {
      const f = await createFixture(setup)
      const g2db = new PrismaClient({ datasources: { db: { url: testUrl } } })
      try {
        await submission(f, g2db).submit(f.spaceId, f.taskId, { attachmentResourceId: f.fileA })
        await setup.$transaction(async tx => {
          await tx.learningTask.update({ where: { id: f.taskId }, data: { status: 'REVISION_REQUESTED' } })
          await tx.submission.update({ where: { taskId: f.taskId }, data: { status: 'REVISION_REQUESTED' } })
        })
        await submission(f, g2db).submit(f.spaceId, f.taskId, { attachmentResourceId: f.fileB })
        await storage(f).softDelete(f.spaceId, f.fileA)
        await assert.rejects(() => storage(f).softDelete(f.spaceId, f.fileB), { status: 409 })
        const [a, b, current] = await Promise.all([
          setup.learningResource.findUniqueOrThrow({ where: { id: f.fileA } }),
          setup.learningResource.findUniqueOrThrow({ where: { id: f.fileB } }),
          setup.submission.findUniqueOrThrow({ where: { taskId: f.taskId } }),
        ])
        assert.equal(a.status, 'DELETED')
        assert.equal(b.status, 'READY')
        assert.equal(current.attachmentResourceId, f.fileB)
      } finally {
        await g2db.$disconnect()
        await cleanup(setup, f)
      }
    })
  } finally {
    await setup.$disconnect()
    await prisma.$disconnect()
  }
})
