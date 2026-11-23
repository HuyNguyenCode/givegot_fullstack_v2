import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'
import { normalizeExternalUrl } from '@/lib/learning-resource-service'
import type { SubmissionConflictCode, SubmissionFreshness } from '@/lib/learning-submission-contract'

export class LearningSubmissionError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string, readonly code?: SubmissionConflictCode) { super(message) }
}
export const isLearningSubmissionError = (error: unknown): error is LearningSubmissionError => error instanceof LearningSubmissionError

type Dependencies = { db: typeof prisma; actor(): Promise<{ id: string }>; now(): Date }
const defaults: Dependencies = { db: prisma, actor: requireAuthenticatedUser, now: () => new Date() }
const currentSubmissionSelect = { id: true, taskId: true, authorId: true, content: true, linkUrl: true, attachmentResourceId: true, revisionCount: true, status: true, submittedAt: true } as const

function exactObject(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))
}

const nullableText = (value: unknown): value is string | null => value === null || typeof value === 'string'
const validId = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= 191

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value)
      || !Number.isFinite(Date.parse(value))) return false
  const day = value.slice(0, 10)
  const midnight = new Date(day)
  return Number.isFinite(midnight.getTime()) && midnight.toISOString().startsWith(day)
}

function submissionFreshness(value: unknown): SubmissionFreshness {
  const invalid = () => new LearningSubmissionError(400, 'Invalid submission freshness precondition')
  if (!exactObject(value, ['requirements', 'previousSubmission'])) throw invalid()
  const { requirements, previousSubmission } = value
  if (!exactObject(requirements, ['title', 'description', 'acceptanceCriteria', 'dueAt', 'topicId'])) throw invalid()
  const { title, description, acceptanceCriteria, dueAt, topicId } = requirements
  if (typeof title !== 'string' || !nullableText(description) || !nullableText(acceptanceCriteria)
      || (topicId !== null && !validId(topicId))) throw invalid()
  if (dueAt !== null && !validTimestamp(dueAt)) throw invalid()
  let previous: SubmissionFreshness['previousSubmission'] = null
  if (previousSubmission !== null) {
    if (!exactObject(previousSubmission, ['submissionId', 'revisionCount'])) throw invalid()
    const { submissionId, revisionCount } = previousSubmission
    if (!validId(submissionId) || typeof revisionCount !== 'number' || !Number.isSafeInteger(revisionCount) || revisionCount < 1) throw invalid()
    previous = { submissionId, revisionCount }
  }
  return { requirements: { title, description, acceptanceCriteria, dueAt, topicId }, previousSubmission: previous }
}

export function submissionInput(input: Record<string, unknown>) {
  if (Object.keys(input).some(key => !['content', 'linkUrl', 'attachmentResourceId', 'freshness'].includes(key))) throw new LearningSubmissionError(400, 'Unsupported submission field')
  if (input.content != null && typeof input.content !== 'string') throw new LearningSubmissionError(400, 'Invalid content')
  const content = typeof input.content === 'string' ? input.content.trim() : ''
  if (content.length > 20_000) throw new LearningSubmissionError(400, 'Content is too long')
  let linkUrl: string | null = null
  if (input.linkUrl != null && input.linkUrl !== '') {
    try { linkUrl = normalizeExternalUrl(input.linkUrl) } catch { throw new LearningSubmissionError(400, 'A safe HTTPS URL is required') }
  }
  if (input.attachmentResourceId != null && typeof input.attachmentResourceId !== 'string') throw new LearningSubmissionError(400, 'Invalid attachment')
  const attachmentResourceId = typeof input.attachmentResourceId === 'string' ? input.attachmentResourceId.trim() : ''
  if (attachmentResourceId.length > 191) throw new LearningSubmissionError(400, 'Invalid attachment')
  if (!content && !linkUrl && !attachmentResourceId) throw new LearningSubmissionError(400, 'Add text, an HTTPS URL, or an attachment')
  return { content: content || null, linkUrl, attachmentResourceId: attachmentResourceId || null, freshness: submissionFreshness(input.freshness) }
}

export function createLearningSubmissionService(deps: Dependencies = defaults) {
  async function authorize(spaceId: string, actorId: string, write: boolean, db: Prisma.TransactionClient = deps.db) {
    const member = await db.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId: actorId } }, select: { status: true, learningSpace: { select: { state: true } } } })
    if (!member || member.status !== 'ACTIVE') throw new AuthorizationError(403, 'Learning space membership required')
    if (write && member.learningSpace.state !== 'ACTIVE') throw new LearningSubmissionError(409, 'Archived learning spaces are read-only')
    return member
  }
  async function current(spaceId: string, taskId: string) {
    const actor = await deps.actor()
    await authorize(spaceId, actor.id, false)
    const task = await deps.db.learningTask.findFirst({ where: { id: taskId, learningSpaceId: spaceId }, select: { id: true } })
    if (!task) throw new LearningSubmissionError(404, 'Task not found')
    return deps.db.submission.findUnique({ where: { taskId }, select: currentSubmissionSelect })
  }
  async function currentWithTask(spaceId: string, taskId: string) {
    const actor = await deps.actor()
    return deps.db.$transaction(async tx => {
      const member = await authorize(spaceId, actor.id, false, tx)
      const task = await tx.learningTask.findFirst({ where: { id: taskId, learningSpaceId: spaceId } })
      if (!task) throw new LearningSubmissionError(404, 'Task not found')
      const submission = await tx.submission.findUnique({ where: { taskId }, select: currentSubmissionSelect })
      return { task, submission, archived: member.learningSpace.state !== 'ACTIVE' }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
  async function submit(spaceId: string, taskId: string, raw: Record<string, unknown>) {
    const actor = await deps.actor()
    const { freshness, ...input } = submissionInput(raw)
    await authorize(spaceId, actor.id, true)
    try {
      return await deps.db.$transaction(async tx => {
        const task = await tx.learningTask.findFirst({ where: { id: taskId, learningSpaceId: spaceId } })
        if (!task) throw new LearningSubmissionError(404, 'Task not found')
        if (task.assigneeId !== actor.id) throw new LearningSubmissionError(403, 'Only the task assignee may submit')
        const space = await tx.learningSpace.findUnique({ where: { id: spaceId }, select: { state: true } })
        if (space?.state !== 'ACTIVE') throw new LearningSubmissionError(409, 'Archived learning spaces are read-only')
        const pair = await tx.learningSpaceMember.findMany({ where: { learningSpaceId: spaceId, userId: { in: [task.creatorId, task.assigneeId] }, status: 'ACTIVE' }, select: { userId: true, user: { select: { isSuspended: true } } } })
        if (pair.length !== 2 || pair.some(member => member.user.isSuspended)) throw new LearningSubmissionError(409, 'Both task participants must be active members')
        if (input.attachmentResourceId) {
          const file = await tx.learningResource.findFirst({ where: { id: input.attachmentResourceId, learningSpaceId: spaceId, kind: 'FILE', status: 'READY', deletedAt: null }, select: { id: true } })
          if (!file) throw new LearningSubmissionError(400, 'Attachment must be a ready file in this learning space')
        }
        const previous = await tx.submission.findUnique({ where: { taskId } })
        const first = !previous && (task.status === 'OPEN' || task.status === 'IN_PROGRESS')
        const revision = !!previous && task.status === 'REVISION_REQUESTED' && previous.status === 'REVISION_REQUESTED' && previous.authorId === actor.id
        if (!first && !revision) throw new LearningSubmissionError(409, 'Submission is not editable in the current task state')
        const viewed = freshness.requirements
        if (viewed.title !== task.title || viewed.description !== task.description
            || viewed.acceptanceCriteria !== task.acceptanceCriteria || viewed.topicId !== task.topicId
            || (viewed.dueAt === null ? null : Date.parse(viewed.dueAt)) !== (task.dueAt?.getTime() ?? null)) {
          throw new LearningSubmissionError(409, 'Task requirements changed', 'TASK_REQUIREMENTS_CHANGED')
        }
        const viewedSubmission = freshness.previousSubmission
        const sameRevision = previous
          ? viewedSubmission?.submissionId === previous.id && viewedSubmission.revisionCount === previous.revisionCount
          : viewedSubmission === null
        if (!sameRevision) {
          throw new LearningSubmissionError(409, 'Submission revision changed', 'STALE_SUBMISSION_REVISION')
        }
        const claimed = await tx.learningTask.updateMany({ where: { id: taskId, learningSpaceId: spaceId, version: task.version, status: task.status }, data: { status: 'SUBMITTED', version: { increment: 1 } } })
        if (claimed.count !== 1) throw new LearningSubmissionError(409, 'Task changed; refresh and try again')
        const at = deps.now()
        const submission = first
          ? await tx.submission.create({ data: { taskId, authorId: actor.id, ...input, status: 'SUBMITTED', revisionCount: 1, submittedAt: at } })
          : await (async () => {
              const updated = await tx.submission.updateMany({ where: { taskId, authorId: actor.id, status: 'REVISION_REQUESTED', revisionCount: previous!.revisionCount }, data: { ...input, status: 'SUBMITTED', revisionCount: { increment: 1 }, submittedAt: at } })
              if (updated.count !== 1) throw new LearningSubmissionError(409, 'Submission changed; refresh and try again')
              return tx.submission.findUniqueOrThrow({ where: { taskId } })
            })()
        await tx.learningActivity.create({ data: { learningSpaceId: spaceId, bookingId: task.bookingId, actorId: actor.id, eventType: first ? 'LEARNING_SUBMISSION_CREATED' : 'LEARNING_SUBMISSION_REVISED', entityType: 'Submission', entityId: submission.id, eventKey: `learning-submission:${submission.id}:revision:${submission.revisionCount}`, metadata: { taskId, revisionCount: submission.revisionCount } } })
        return submission
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new LearningSubmissionError(409, 'Submission changed; refresh and try again')
      throw error
    }
  }
  return { current, currentWithTask, submit }
}

export const learningSubmissionService = createLearningSubmissionService()
