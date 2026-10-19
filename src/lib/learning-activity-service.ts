import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'

export const ACTIVITY_TYPES = {
  spaceCreated: 'LEARNING_SPACE_CREATED', topicChanged: 'LEARNING_TOPIC_CHANGED',
  resourceAdded: 'LEARNING_RESOURCE_CREATED', resourceDeleted: 'LEARNING_RESOURCE_DELETED', taskAssigned: 'LEARNING_TASK_ASSIGNED',
  submissionReceived: 'LEARNING_SUBMISSION_CREATED', submissionRevised: 'LEARNING_SUBMISSION_REVISED',
  revisionRequested: 'LEARNING_REVISION_REQUESTED', feedbackReady: 'LEARNING_SUBMISSION_REVIEWED',
  noteAdded: 'LEARNING_NOTE_ADDED', recapAdded: 'LEARNING_RECAP_ADDED', noteUpdated: 'LEARNING_NOTE_UPDATED', noteDeleted: 'LEARNING_NOTE_DELETED',
  bookingLinked: 'LEARNING_BOOKING_LINKED', fulfillmentChanged: 'LEARNING_FULFILLMENT_CHANGED',
} as const

const safeFields = new Set(['kind', 'status', 'taskId', 'submissionId', 'revisionCount', 'outcome', 'version', 'previousPrimarySkillId', 'primarySkillId', 'assigneeId', 'topicId', 'noteType', 'fulfillmentStatus'])
export function safeActivityMetadata(input: Record<string, unknown> = {}): Prisma.InputJsonObject {
  const result: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!safeFields.has(key)) continue
    if (value === null || typeof value === 'string' && value.length <= 191 || typeof value === 'number' && Number.isSafeInteger(value) || typeof value === 'boolean') result[key] = value
  }
  return result
}

type Event = { learningSpaceId: string; bookingId?: string | null; actorId: string | null; eventType: string; entityType: string; entityId: string | null; eventKey: string; metadata?: Record<string, unknown>; occurredAt?: Date }
type Writer = { learningActivity: { upsert(args: { where: { eventKey: string }; create: Prisma.LearningActivityUncheckedCreateInput; update: Record<string, never> }): Promise<unknown> } }
export async function appendLearningActivity(db: Writer, event: Event) {
  if (!event.eventKey || event.eventKey.length > 255) throw new Error('Invalid activity event key')
  return db.learningActivity.upsert({ where: { eventKey: event.eventKey }, create: {
    learningSpaceId: event.learningSpaceId, bookingId: event.bookingId ?? null, actorId: event.actorId,
    eventType: event.eventType, entityType: event.entityType, entityId: event.entityId,
    eventKey: event.eventKey, occurredAt: event.occurredAt, metadata: safeActivityMetadata(event.metadata),
  }, update: {} })
}

export class LearningActivityError extends Error { constructor(readonly status: 400 | 403, message: string) { super(message) } }
const PAGE_SIZE = 20
type Cursor = { occurredAt: string; id: string }
function parseCursor(value: string | null): Cursor | null {
  if (!value) return null
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Cursor
    if (typeof cursor.id !== 'string' || !cursor.id || typeof cursor.occurredAt !== 'string' || !Number.isFinite(Date.parse(cursor.occurredAt))) throw new Error()
    return cursor
  } catch { throw new LearningActivityError(400, 'Invalid activity cursor') }
}
export function activityCursor(row: { occurredAt: Date; id: string }) {
  return Buffer.from(JSON.stringify({ occurredAt: row.occurredAt.toISOString(), id: row.id })).toString('base64url')
}

export function activityActorName(actorId: string | null, actor: { name: string | null } | null) {
  if (!actorId) return 'Hệ thống'
  return actor?.name?.trim() || 'Thành viên GiveGot'
}

type Dependencies = { db: typeof prisma; actor: typeof requireAuthenticatedUser }
export function createLearningActivityService(deps: Dependencies = { db: prisma, actor: requireAuthenticatedUser }) {
  return { async list(spaceId: string, cursorValue: string | null = null) {
    if (!spaceId || spaceId.length > 191) throw new LearningActivityError(400, 'Invalid space')
    const actor = await deps.actor()
    const member = await deps.db.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId: actor.id } }, select: { status: true, user: { select: { isSuspended: true } } } })
    if (!member || member.status !== 'ACTIVE' || member.user.isSuspended) throw new AuthorizationError(403, 'Learning space membership required')
    const cursor = parseCursor(cursorValue)
    const rows = await deps.db.learningActivity.findMany({
      where: { learningSpaceId: spaceId, ...(cursor ? { OR: [{ occurredAt: { lt: new Date(cursor.occurredAt) } }, { occurredAt: new Date(cursor.occurredAt), id: { lt: cursor.id } }] } : {}) },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }], take: PAGE_SIZE + 1,
      select: { id: true, eventType: true, entityType: true, entityId: true, actorId: true, occurredAt: true, metadata: true, actor: { select: { name: true } } },
    })
    const visible = rows.slice(0, PAGE_SIZE).map(({ actor: eventActor, ...row }) => ({ ...row, actorName: activityActorName(row.actorId, eventActor), metadata: safeActivityMetadata(row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {}) }))
    return { events: visible, nextCursor: rows.length > PAGE_SIZE ? activityCursor(rows[PAGE_SIZE - 1]) : null }
  } }
}
export const learningActivityService = createLearningActivityService()

