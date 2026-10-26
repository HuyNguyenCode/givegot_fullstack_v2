import { FulfillmentStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { appendLearningActivity, ACTIVITY_TYPES } from '@/lib/learning-activity-service'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'

export type FulfillmentAction = 'START' | 'DELIVER' | 'ACCEPT' | 'REQUEST_REVISION' | 'RESUME'
export class LearningFulfillmentError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message) }
}

const next: Record<FulfillmentAction, { from: FulfillmentStatus; to: FulfillmentStatus; role: 'EITHER' | 'MENTOR' | 'MENTEE' }> = {
  START: { from: 'NOT_STARTED', to: 'IN_PROGRESS', role: 'EITHER' },
  DELIVER: { from: 'IN_PROGRESS', to: 'DELIVERED', role: 'MENTOR' },
  ACCEPT: { from: 'DELIVERED', to: 'ACCEPTED', role: 'MENTEE' },
  REQUEST_REVISION: { from: 'DELIVERED', to: 'REVISION_REQUESTED', role: 'MENTEE' },
  RESUME: { from: 'REVISION_REQUESTED', to: 'IN_PROGRESS', role: 'MENTOR' },
}

export function fulfillmentInput(raw: Record<string, unknown>) {
  if (Object.keys(raw).some(key => key !== 'action' && key !== 'expectedVersion')) throw new LearningFulfillmentError(400, 'Unsupported fulfillment field')
  if (typeof raw.action !== 'string' || !Object.hasOwn(next, raw.action)) throw new LearningFulfillmentError(400, 'Invalid fulfillment action')
  if (!Number.isSafeInteger(raw.expectedVersion) || (raw.expectedVersion as number) < 0) throw new LearningFulfillmentError(400, 'Invalid expectedVersion')
  return { action: raw.action as FulfillmentAction, expectedVersion: raw.expectedVersion as number }
}

type Db = typeof prisma
type Dependencies = { db: Db; actor: typeof requireAuthenticatedUser; now: () => Date }
const defaults: Dependencies = { db: prisma, actor: requireAuthenticatedUser, now: () => new Date() }

async function assertMember(tx: Prisma.TransactionClient, spaceId: string, userId: string, write: boolean) {
  const member = await tx.learningSpaceMember.findUnique({
    where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId } },
    select: { status: true, user: { select: { isSuspended: true } }, learningSpace: { select: { state: true } } },
  })
  if (!member || member.status !== 'ACTIVE' || member.user.isSuspended) throw new AuthorizationError(403, 'Active learning space membership required')
  if (write && member.learningSpace.state !== 'ACTIVE') throw new LearningFulfillmentError(409, 'Archived learning spaces are read-only')
}

type BookingRow = NonNullable<Awaited<ReturnType<Prisma.TransactionClient['booking']['findFirst']>>>

async function deliveryEvidence(tx: Prisma.TransactionClient, booking: BookingRow, now: Date) {
  const missing: string[] = []
  if (!booking.learningMode || !booking.learningSpaceId) return ['LEARNING_MODE']
  if (booking.learningMode === 'LIVE') {
    if (!booking.objective?.trim()) missing.push('OBJECTIVE')
  }
  if (booking.learningMode !== 'EXERCISE_REVIEW') {
    if (!booking.startTime || booking.endTime <= booking.startTime || booking.endTime > now) missing.push('SCHEDULED_COMPONENT')
    if (!booking.meetingUrl?.trim()) missing.push('MEETING_LINK')
    const recap = await tx.learningNote.count({ where: {
      learningSpaceId: booking.learningSpaceId, bookingId: booking.id, authorId: booking.mentorId,
      type: 'RECAP', deletedAt: null, visibility: { in: ['SPACE_MEMBERS', 'BOOKING_PARTICIPANTS'] },
    } })
    if (!recap) missing.push('RECAP')
  }
  if (booking.learningMode !== 'LIVE') {
    const tasks = await tx.learningTask.findMany({ where: {
      learningSpaceId: booking.learningSpaceId, bookingId: booking.id, creatorId: booking.mentorId,
      assigneeId: booking.menteeId, status: 'COMPLETED',
    }, include: { submission: { include: { review: true } } } })
    const reviewed = tasks.some(task => task.submission?.authorId === booking.menteeId
      && task.submission.status === 'REVIEWED' && task.submission.review?.outcome === 'REVIEWED'
      && task.submission.review.reviewedAt >= task.submission.submittedAt
      && (booking.learningMode !== 'HYBRID' || task.submission.submittedAt <= booking.startTime))
    if (!reviewed) missing.push(booking.learningMode === 'HYBRID' ? 'PREWORK_AND_ACKNOWLEDGEMENT' : 'TASK_SUBMISSION_FEEDBACK')
  }
  return missing
}

export function createLearningFulfillmentService(deps: Dependencies = defaults) {
  async function read(spaceId: string, bookingId: string) {
    const actor = await deps.actor()
    return deps.db.$transaction(async tx => {
      await assertMember(tx, spaceId, actor.id, false)
      const booking = await tx.booking.findFirst({ where: { id: bookingId, learningSpaceId: spaceId } })
      if (!booking || !booking.learningMode || ![booking.mentorId, booking.menteeId].includes(actor.id)) throw new LearningFulfillmentError(404, 'Fulfillment not found')
      const status = booking.fulfillmentStatus ?? (booking.status === 'DISPUTED' ? 'DISPUTED' : ['CANCELLED', 'MISSED'].includes(booking.status) ? 'CANCELLED' : 'NOT_STARTED')
      return { bookingId, status, version: booking.fulfillmentVersion ?? 0, deliveredAt: booking.deliveredAt, acceptedAt: booking.acceptedAt }
    })
  }

  async function transition(spaceId: string, bookingId: string, raw: Record<string, unknown>) {
    const { action, expectedVersion } = fulfillmentInput(raw)
    const actor = await deps.actor()
    const at = deps.now()
    try {
      return await deps.db.$transaction(async tx => {
        await assertMember(tx, spaceId, actor.id, true)
        const booking = await tx.booking.findFirst({ where: { id: bookingId, learningSpaceId: spaceId } })
        if (!booking || !booking.learningMode || ![booking.mentorId, booking.menteeId].includes(actor.id)) throw new LearningFulfillmentError(404, 'Fulfillment not found')
        await assertMember(tx, spaceId, booking.mentorId, true)
        await assertMember(tx, spaceId, booking.menteeId, true)
        if (booking.status !== 'CONFIRMED') throw new LearningFulfillmentError(409, 'Booking is not confirmed or is frozen')
        if ((booking.fulfillmentVersion ?? 0) !== expectedVersion) throw new LearningFulfillmentError(409, 'Fulfillment version conflict')
        const rule = next[action]
        if ((booking.fulfillmentStatus ?? 'NOT_STARTED') !== rule.from) throw new LearningFulfillmentError(409, 'Fulfillment transition is not allowed')
        if (rule.role === 'MENTOR' && actor.id !== booking.mentorId || rule.role === 'MENTEE' && actor.id !== booking.menteeId) throw new LearningFulfillmentError(403, 'Booking role cannot perform this transition')
        if (action === 'DELIVER' || action === 'ACCEPT') {
          const missing = await deliveryEvidence(tx, booking, at)
          if (missing.length) throw new LearningFulfillmentError(409, `Delivery evidence is incomplete: ${missing.join(', ')}`)
        }
        const version = expectedVersion + 1
        const claimed = await tx.booking.updateMany({ where: {
          id: bookingId, learningSpaceId: spaceId, status: 'CONFIRMED',
          fulfillmentStatus: booking.fulfillmentStatus, fulfillmentVersion: booking.fulfillmentVersion,
        }, data: {
          fulfillmentStatus: rule.to, fulfillmentVersion: version,
          ...(action === 'DELIVER' ? { deliveredAt: at, acceptedAt: null } : {}),
          ...(action === 'RESUME' ? { deliveredAt: null, acceptedAt: null } : {}),
          ...(action === 'ACCEPT' ? { acceptedAt: at } : {}),
        } })
        if (claimed.count !== 1) throw new LearningFulfillmentError(409, 'Fulfillment changed; refresh and try again')
        await appendLearningActivity(tx, {
          learningSpaceId: spaceId, bookingId, actorId: actor.id, eventType: ACTIVITY_TYPES.fulfillmentChanged,
          entityType: 'Booking', entityId: bookingId, eventKey: `learning-fulfillment:${bookingId}:version:${version}`,
          metadata: { fulfillmentStatus: rule.to, version }, occurredAt: at,
        })
        return { bookingId, status: rule.to, version, deliveredAt: action === 'DELIVER' ? at : action === 'RESUME' ? null : booking.deliveredAt, acceptedAt: action === 'ACCEPT' ? at : booking.acceptedAt }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')) throw new LearningFulfillmentError(409, 'Fulfillment changed; refresh and try again')
      throw error
    }
  }
  return { read, transition }
}

export const learningFulfillmentService = createLearningFulfillmentService()

/** Called only after an existing Booking writer has made its own terminal decision in the same transaction. */
export async function mirrorTerminalFulfillment(tx: Prisma.TransactionClient, bookingId: string, terminal: 'CANCELLED' | 'DISPUTED', actorId: string | null) {
  const booking = await tx.booking.findUnique({ where: { id: bookingId } })
  if (!booking?.learningMode || !booking.learningSpaceId) return
  if (terminal === 'DISPUTED' && booking.status !== 'DISPUTED' || terminal === 'CANCELLED' && !['CANCELLED', 'MISSED'].includes(booking.status)) throw new LearningFulfillmentError(409, 'Booking terminal state changed')
  if (['CANCELLED', 'DISPUTED', 'SETTLED'].includes(booking.fulfillmentStatus ?? '')) return
  const version = (booking.fulfillmentVersion ?? 0) + 1
  const claimed = await tx.booking.updateMany({ where: { id: bookingId, status: booking.status, fulfillmentStatus: booking.fulfillmentStatus, fulfillmentVersion: booking.fulfillmentVersion }, data: { fulfillmentStatus: terminal, fulfillmentVersion: version } })
  if (claimed.count !== 1) throw new LearningFulfillmentError(409, 'Fulfillment changed')
  await appendLearningActivity(tx, { learningSpaceId: booking.learningSpaceId, bookingId, actorId, eventType: ACTIVITY_TYPES.fulfillmentChanged, entityType: 'Booking', entityId: bookingId, eventKey: `learning-fulfillment:${bookingId}:version:${version}`, metadata: { fulfillmentStatus: terminal, version } })
}
