import { Prisma } from '@prisma/client'
import { createLearningSubmissionReviewService } from '../../../src/lib/learning-submission-review-service'
import { createLearningSubmissionService } from '../../../src/lib/learning-submission-service'
import { AuthorizationError } from '../../../src/lib/server-authorization'

export const reviewNow = new Date('2030-01-01T00:00:00Z')
export const reviewBody = (outcome = 'REVIEWED', revisionCount = 1) => ({ submissionId: 'submission', revisionCount, content: 'Private feedback', outcome })
type Row = Record<string, unknown>
const matches = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => row[key] === value)
export function reviewFixture() {
  let actor = 'creator'
  let authenticated = true
  let space = 'ACTIVE'
  let task: Row = { id: 'task', learningSpaceId: 'space', creatorId: 'creator', assigneeId: 'assignee', bookingId: null, status: 'SUBMITTED', version: 2, dueAt: null }
  let submission: Row = { id: 'submission', taskId: 'task', authorId: 'assignee', content: 'Private answer', status: 'SUBMITTED', revisionCount: 1, submittedAt: reviewNow }
  let review: Row | null = null
  let events: Row[] = []
  const members = new Map([['creator', { active: true, suspended: false }], ['assignee', { active: true, suspended: false }]])
  const booking = { id: 'booking', learningSpaceId: 'space', status: 'CONFIRMED', mentorId: 'assignee', menteeId: 'creator', fulfillmentStatus: 'NOT_STARTED' }
  let fail: string | null = null
  let taskClaim = true
  let submissionClaim = true
  const sideEffects: string[] = []
  const forbidden = (name: string) => new Proxy({}, { get: () => () => { sideEffects.push(name); throw new Error(`Forbidden ${name}`) } })
  const tx = {
    learningSpaceMember: {
      findUnique: async ({ where }: { where: { learningSpaceId_userId: { learningSpaceId: string; userId: string } } }) => {
        const m = members.get(where.learningSpaceId_userId.userId)
        return where.learningSpaceId_userId.learningSpaceId === 'space' && m?.active ? { status: 'ACTIVE', user: { isSuspended: m.suspended }, learningSpace: { state: space } } : null
      },
      findMany: async ({ where }: { where: { userId: { in: string[] } } }) => where.userId.in.filter(id => members.get(id)?.active).map(userId => ({ userId, user: { isSuspended: members.get(userId)!.suspended } })),
    },
    learningSpace: { findUnique: async () => ({ state: space }) },
    learningTask: {
      findFirst: async ({ where }: { where: Row }) => matches(task, where) ? { ...task } : null,
      findUniqueOrThrow: async () => ({ ...task }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (!taskClaim || !matches(task, where)) return { count: 0 }
        task = { ...task, ...data, version: Number(task.version) + 1 }; return { count: 1 }
      },
    },
    submission: {
      findUnique: async ({ where }: { where: Row }) => matches(submission, where) ? { ...submission } : null,
      findUniqueOrThrow: async () => ({ ...submission }),
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        if (!submissionClaim || !matches(submission, where)) return { count: 0 }
        submission = { ...submission, ...data, revisionCount: typeof data.revisionCount === 'object' ? Number(submission.revisionCount) + 1 : submission.revisionCount }
        return { count: 1 }
      },
    },
    submissionReview: {
      findUnique: async () => review && { ...review },
      upsert: async ({ create, update }: { create: Row; update: Row }) => {
        review = review ? { ...review, ...update } : { id: 'review', ...create }; return { ...review }
      },
    },
    booking: {
      findFirst: async ({ where }: { where: Row }) => matches(booking, where) ? { ...booking } : null,
      update: () => { sideEffects.push('booking'); throw new Error('Forbidden Booking mutation') },
    },
    learningActivity: { create: async ({ data }: { data: Row }) => {
      if (fail) throw new Prisma.PrismaClientKnownRequestError('Injected', { code: fail, clientVersion: '5.22.0' })
      if (events.some(row => row.eventKey === data.eventKey)) throw new Prisma.PrismaClientKnownRequestError('Duplicate event', { code: 'P2002', clientVersion: '5.22.0' })
      events.push(data); return data
    } },
    review: forbidden('public Review'), trustHistory: forbidden('TrustHistory'), user: forbidden('wallet/Trust'), transactionLog: forbidden('ledger'), notification: forbidden('notification'),
  }
  // A serialized transactional mock models commits/rollback; this is not a PostgreSQL race proof.
  let tail: Promise<unknown> = Promise.resolve()
  const transactions: unknown[] = []
  const db = { ...tx, $transaction: <T>(run: (db: typeof tx) => Promise<T>, options: unknown) => {
    const operation = tail.then(async () => {
      transactions.push(options)
      const before = structuredClone({ task, submission, review, events })
      try { return await run(tx) } catch (error) { ({ task, submission, review, events } = before); throw error }
    })
    tail = operation.catch(() => undefined)
    return operation
  } }
  const deps = { db: db as never, actor: async () => { if (!authenticated) throw new AuthorizationError(401, 'Authentication required'); return { id: actor } }, now: () => reviewNow }
  return {
    reviews: createLearningSubmissionReviewService(deps), submissions: createLearningSubmissionService(deps),
    snapshot: () => structuredClone({ task, submission, review, events, booking }), members, sideEffects, transactions,
    actor: (id: string) => { actor = id }, loggedOut: () => { authenticated = false }, archive: () => { space = 'ARCHIVED' },
    linkBooking: (status: string) => { task.bookingId = 'booking'; booking.status = status },
    taskState: (status: string) => { task.status = status }, submissionState: (status: string) => { submission.status = status },
    selfTask: () => { task.creatorId = 'assignee' }, author: (id: string) => { submission.authorId = id },
    fail: (code: string) => { fail = code }, claim: (which: string) => { if (which === 'task') taskClaim = false; else submissionClaim = false },
  }
}
