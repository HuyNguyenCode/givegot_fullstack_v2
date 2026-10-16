import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'
import { taskDueAt } from '@/lib/learning-task-service'

export class LearningSubmissionReviewError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message) }
}
type Dependencies = { db: typeof prisma; actor(): Promise<{ id: string }>; now(): Date }
const defaults: Dependencies = { db: prisma, actor: requireAuthenticatedUser, now: () => new Date() }
const reviewSelect = { id: true, submissionId: true, reviewerId: true, content: true, outcome: true, reviewedAt: true } as const
const blockedBookings = ['CANCELLED', 'DISPUTED', 'MISSED']

export function reviewInput(raw: Record<string, unknown>, now: Date) {
  if (Object.keys(raw).some(key => !['submissionId', 'revisionCount', 'content', 'outcome', 'revisionDueAt'].includes(key))) throw new LearningSubmissionReviewError(400, 'Unsupported review field')
  if (typeof raw.submissionId !== 'string' || !raw.submissionId.trim() || raw.submissionId.length > 191) throw new LearningSubmissionReviewError(400, 'Invalid submissionId')
  if (!Number.isSafeInteger(raw.revisionCount) || (raw.revisionCount as number) < 1) throw new LearningSubmissionReviewError(400, 'Invalid revisionCount')
  if (typeof raw.content !== 'string' || !raw.content.trim() || raw.content.trim().length > 20_000) throw new LearningSubmissionReviewError(400, 'Feedback must contain 1 to 20000 characters')
  if (raw.outcome !== 'REVIEWED' && raw.outcome !== 'REVISION_REQUESTED') throw new LearningSubmissionReviewError(400, 'Invalid review outcome')
  const hasDueAt = Object.hasOwn(raw, 'revisionDueAt')
  if (hasDueAt && raw.outcome !== 'REVISION_REQUESTED') throw new LearningSubmissionReviewError(400, 'A revision deadline requires a revision request')
  let dueAt: Date | null = null
  if (hasDueAt) {
    try { dueAt = taskDueAt(raw.revisionDueAt, now) } catch { throw new LearningSubmissionReviewError(400, 'Revision deadline must be a future ISO timestamp with timezone') }
  }
  return { submissionId: raw.submissionId.trim(), revisionCount: raw.revisionCount as number, content: raw.content.trim(), outcome: raw.outcome as 'REVIEWED' | 'REVISION_REQUESTED', hasDueAt, dueAt }
}

export function createLearningSubmissionReviewService(deps: Dependencies = defaults) {
  async function membership(db: Prisma.TransactionClient, spaceId: string, actorId: string) {
    const member = await db.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId: actorId } }, select: { status: true, user: { select: { isSuspended: true } }, learningSpace: { select: { state: true } } } })
    if (!member || member.status !== 'ACTIVE' || member.user.isSuspended) throw new AuthorizationError(403, 'Active learning space membership required')
    return member
  }
  async function current(spaceId: string, taskId: string) {
    const actor = await deps.actor()
    return deps.db.$transaction(async tx => {
      const member = await membership(tx, spaceId, actor.id)
      const task = await tx.learningTask.findFirst({ where: { id: taskId, learningSpaceId: spaceId } })
      if (!task) throw new LearningSubmissionReviewError(404, 'Task not found')
      const submission = await tx.submission.findUnique({ where: { taskId } })
      // The single review row belongs to the previous revision after a resubmit.
      const review = submission && submission.status !== 'SUBMITTED'
        ? await tx.submissionReview.findUnique({ where: { submissionId: submission.id }, select: reviewSelect }) : null
      const booking = task.bookingId ? await tx.booking.findFirst({ where: { id: task.bookingId, learningSpaceId: spaceId }, select: { status: true } }) : null
      const pair = await tx.learningSpaceMember.findMany({ where: { learningSpaceId: spaceId, userId: { in: [task.creatorId, task.assigneeId] }, status: 'ACTIVE' }, select: { userId: true, user: { select: { isSuspended: true } } } })
      const canReview = !!submission && actor.id === task.creatorId && actor.id !== submission.authorId && task.assigneeId === submission.authorId && member.learningSpace.state === 'ACTIVE' && pair.length === 2 && !pair.some(member => member.user.isSuspended) && task.status === 'SUBMITTED' && submission.status === 'SUBMITTED' && (!task.bookingId || (!!booking && !blockedBookings.includes(booking.status)))
      return { review, canReview }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
  async function review(spaceId: string, taskId: string, raw: Record<string, unknown>) {
    const actor = await deps.actor()
    const at = deps.now()
    const input = reviewInput(raw, at)
    try {
      return await deps.db.$transaction(async tx => {
        const member = await membership(tx, spaceId, actor.id)
        if (member.learningSpace.state !== 'ACTIVE') throw new LearningSubmissionReviewError(409, 'Archived learning spaces are read-only')
        const task = await tx.learningTask.findFirst({ where: { id: taskId, learningSpaceId: spaceId } })
        if (!task) throw new LearningSubmissionReviewError(404, 'Task not found')
        const submission = await tx.submission.findUnique({ where: { taskId } })
        if (actor.id !== task.creatorId || actor.id === task.assigneeId || actor.id === submission?.authorId) throw new LearningSubmissionReviewError(403, 'Only the task creator counterpart may review')
        const pair = await tx.learningSpaceMember.findMany({ where: { learningSpaceId: spaceId, userId: { in: [task.creatorId, task.assigneeId] }, status: 'ACTIVE' }, select: { userId: true, user: { select: { isSuspended: true } } } })
        if (pair.length !== 2 || pair.some(member => member.user.isSuspended)) throw new LearningSubmissionReviewError(409, 'Both task participants must be active members')
        if (task.bookingId) {
          const booking = await tx.booking.findFirst({ where: { id: task.bookingId, learningSpaceId: spaceId }, select: { status: true, mentorId: true, menteeId: true } })
          if (!booking || blockedBookings.includes(booking.status) || ![booking.mentorId, booking.menteeId].includes(task.creatorId) || ![booking.mentorId, booking.menteeId].includes(task.assigneeId)) throw new LearningSubmissionReviewError(409, 'Linked Booking does not permit review')
        }
        if (!submission || submission.id !== input.submissionId || submission.revisionCount !== input.revisionCount || submission.authorId !== task.assigneeId || task.status !== 'SUBMITTED' || submission.status !== 'SUBMITTED') throw new LearningSubmissionReviewError(409, 'Submission changed or was already reviewed; refresh and try again')
        const claimed = await tx.learningTask.updateMany({ where: { id: taskId, learningSpaceId: spaceId, version: task.version, status: 'SUBMITTED' }, data: { status: input.outcome === 'REVIEWED' ? 'COMPLETED' : 'REVISION_REQUESTED', version: { increment: 1 }, ...(input.hasDueAt ? { dueAt: input.dueAt } : {}) } })
        if (claimed.count !== 1) throw new LearningSubmissionReviewError(409, 'Task changed; refresh and try again')
        const updated = await tx.submission.updateMany({ where: { id: submission.id, taskId, authorId: task.assigneeId, revisionCount: input.revisionCount, status: 'SUBMITTED' }, data: { status: input.outcome } })
        if (updated.count !== 1) throw new LearningSubmissionReviewError(409, 'Submission changed; refresh and try again')
        const data = { reviewerId: actor.id, content: input.content, outcome: input.outcome, reviewedAt: at }
        const result = await tx.submissionReview.upsert({ where: { submissionId: submission.id }, create: { submissionId: submission.id, ...data }, update: data, select: reviewSelect })
        await tx.learningActivity.create({ data: { learningSpaceId: spaceId, bookingId: task.bookingId, actorId: actor.id, eventType: input.outcome === 'REVIEWED' ? 'LEARNING_SUBMISSION_REVIEWED' : 'LEARNING_REVISION_REQUESTED', entityType: 'SubmissionReview', entityId: result.id, eventKey: `learning-submission-review:${submission.id}:revision:${input.revisionCount}`, metadata: { taskId, submissionId: submission.id, revisionCount: input.revisionCount, outcome: input.outcome, ...(input.hasDueAt ? { revisionDueAt: input.dueAt?.toISOString() ?? null } : {}) } } })
        return { review: result, task: await tx.learningTask.findUniqueOrThrow({ where: { id: taskId } }), submission: await tx.submission.findUniqueOrThrow({ where: { taskId } }) }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new LearningSubmissionReviewError(409, 'Review changed; refresh and try again')
      throw error
    }
  }
  return { current, review }
}
export const learningSubmissionReviewService = createLearningSubmissionReviewService()
