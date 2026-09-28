import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'
import type { Prisma } from '@prisma/client'

export class LearningTaskError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message) }
}
export const isLearningTaskError = (error: unknown): error is LearningTaskError => error instanceof LearningTaskError

const value = (input: unknown, name: string, max: number, required = false) => {
  if (input == null && !required) return null
  if (typeof input !== 'string') throw new LearningTaskError(400, `Invalid ${name}`)
  const clean = input.trim()
  if ((required && !clean) || clean.length > max) throw new LearningTaskError(400, `Invalid ${name}`)
  return clean || null
}
const identifier = (input: unknown, name: string, required = false) => value(input, name, 191, required)
const allowedKeys = (input: Record<string, unknown>, keys: string[]) => {
  if (Object.keys(input).some(key => !keys.includes(key))) throw new LearningTaskError(400, 'Unsupported task field')
}
export function taskDueAt(input: unknown, now: Date): Date | null {
  if (input == null) return null
  if (typeof input !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(input)) throw new LearningTaskError(400, 'Invalid dueAt')
  const due = new Date(input)
  if (!Number.isFinite(due.getTime()) || due.getTime() <= now.getTime()) throw new LearningTaskError(400, 'dueAt must be in the future')
  return due
}
export function taskTransition(current: string, action: unknown, actorId: string, creatorId: string, assigneeId: string) {
  if (action === 'CANCEL' && (current === 'OPEN' || current === 'IN_PROGRESS') && actorId === creatorId) return 'CANCELLED'
  if (action === 'START' && current === 'OPEN' && actorId === assigneeId) return 'IN_PROGRESS'
  throw new LearningTaskError(409, 'Task transition is unavailable')
}

type Db = typeof prisma
type Dependencies = { db: Db; actor(): Promise<{ id: string }>; now(): Date }
const defaults: Dependencies = { db: prisma, actor: requireAuthenticatedUser, now: () => new Date() }

export function createLearningTaskService(deps: Dependencies = defaults) {
  async function spaceMember(spaceId: string, actorId: string, write: boolean) {
    const membership = await deps.db.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId: actorId } }, select: { status: true, learningSpace: { select: { state: true } } } })
    if (!membership || membership.status !== 'ACTIVE') throw new AuthorizationError(403, 'Learning space membership required')
    if (write && membership.learningSpace.state !== 'ACTIVE') throw new LearningTaskError(409, 'Archived learning spaces are read-only')
  }
  async function references(tx: Prisma.TransactionClient, spaceId: string, bookingId: string | null, topicId: string | null, assigneeId: string, actorId: string) {
    if (assigneeId === actorId) throw new LearningTaskError(400, 'Assignee must be the other active member')
    const space = await tx.learningSpace.findUnique({ where: { id: spaceId }, select: { state: true } })
    if (space?.state !== 'ACTIVE') throw new LearningTaskError(409, 'Archived learning spaces are read-only')
    const members = await tx.learningSpaceMember.findMany({ where: { learningSpaceId: spaceId, userId: { in: [actorId, assigneeId] }, status: 'ACTIVE' }, select: { userId: true, user: { select: { isSuspended: true } } } })
    if (members.length !== 2 || members.some(member => member.user.isSuspended)) throw new LearningTaskError(400, 'Assignee and creator must be distinct active members')
    if (bookingId) {
      const booking = await tx.booking.findFirst({ where: { id: bookingId, learningSpaceId: spaceId }, select: { mentorId: true, menteeId: true } })
      if (!booking) throw new LearningTaskError(400, 'Booking does not belong to this learning space')
      if (![booking.mentorId, booking.menteeId].includes(actorId) || ![booking.mentorId, booking.menteeId].includes(assigneeId)) throw new LearningTaskError(400, 'Task participants must belong to the Booking')
    }
    if (topicId && !await tx.learningTopic.findFirst({ where: { id: topicId, learningSpaceId: spaceId, state: 'ACTIVE' }, select: { id: true } })) throw new LearningTaskError(400, 'Topic must be active in this learning space')
  }
  async function create(spaceIdValue: string, input: Record<string, unknown>) {
    const actor = await deps.actor()
    const spaceId = identifier(spaceIdValue, 'spaceId', true)!
    allowedKeys(input, ['assigneeId', 'bookingId', 'topicId', 'title', 'description', 'acceptanceCriteria', 'dueAt'])
    const assigneeId = identifier(input.assigneeId, 'assigneeId', true)!
    const bookingId = identifier(input.bookingId, 'bookingId')
    const topicId = identifier(input.topicId, 'topicId')
    const title = value(input.title, 'title', 255, true)!
    const description = value(input.description, 'description', 10_000)
    const acceptanceCriteria = value(input.acceptanceCriteria, 'acceptanceCriteria', 10_000, true)!
    const dueAt = taskDueAt(input.dueAt, deps.now())
    await spaceMember(spaceId, actor.id, true)
    return deps.db.$transaction(async tx => {
      await references(tx, spaceId, bookingId, topicId, assigneeId, actor.id)
      const task = await tx.learningTask.create({ data: { learningSpaceId: spaceId, creatorId: actor.id, assigneeId, bookingId, topicId, title, description, acceptanceCriteria, dueAt, status: 'OPEN' } })
      return task
    })
  }
  async function list(spaceIdValue: string) {
    const actor = await deps.actor()
    const spaceId = identifier(spaceIdValue, 'spaceId', true)!
    await spaceMember(spaceId, actor.id, false)
    return deps.db.learningTask.findMany({ where: { learningSpaceId: spaceId }, orderBy: { createdAt: 'desc' } })
  }
  async function update(spaceIdValue: string, taskIdValue: string, input: Record<string, unknown>) {
    const actor = await deps.actor()
    const spaceId = identifier(spaceIdValue, 'spaceId', true)!
    const taskId = identifier(taskIdValue, 'taskId', true)!
    allowedKeys(input, ['expectedVersion', 'assigneeId', 'bookingId', 'topicId', 'title', 'description', 'acceptanceCriteria', 'dueAt', 'action'])
    if (!Number.isSafeInteger(input.expectedVersion) || (input.expectedVersion as number) < 1) throw new LearningTaskError(400, 'Invalid expectedVersion')
    await spaceMember(spaceId, actor.id, true)
    return deps.db.$transaction(async tx => {
      const task = await tx.learningTask.findFirst({ where: { id: taskId, learningSpaceId: spaceId } })
      if (!task) throw new LearningTaskError(404, 'Task not found')
      const space = await tx.learningSpace.findUnique({ where: { id: spaceId }, select: { state: true } })
      if (space?.state !== 'ACTIVE') throw new LearningTaskError(409, 'Archived learning spaces are read-only')
      const activePair = await tx.learningSpaceMember.findMany({ where: { learningSpaceId: spaceId, userId: { in: [task.creatorId, task.assigneeId] }, status: 'ACTIVE' }, select: { userId: true, user: { select: { isSuspended: true } } } })
      if (activePair.length !== 2 || activePair.some(member => member.user.isSuspended)) throw new LearningTaskError(409, 'Both task participants must be active members')
      if (task.version !== input.expectedVersion) throw new LearningTaskError(409, 'Task version conflict')
      const contentKeys = ['assigneeId', 'bookingId', 'topicId', 'title', 'description', 'acceptanceCriteria', 'dueAt']
      const contentEdit = contentKeys.some(key => Object.hasOwn(input, key))
      if (contentEdit && (task.creatorId !== actor.id || task.status !== 'OPEN')) throw new LearningTaskError(403, 'Only the creator may edit an open task')
      const assigneeId = Object.hasOwn(input, 'assigneeId') ? identifier(input.assigneeId, 'assigneeId', true)! : task.assigneeId
      const bookingId = Object.hasOwn(input, 'bookingId') ? identifier(input.bookingId, 'bookingId') : task.bookingId
      const topicId = Object.hasOwn(input, 'topicId') ? identifier(input.topicId, 'topicId') : task.topicId
      const data: Prisma.LearningTaskUncheckedUpdateManyInput = { version: { increment: 1 } }
      if (contentEdit) {
        await references(tx, spaceId, bookingId, topicId, assigneeId, task.creatorId)
        if (Object.hasOwn(input, 'assigneeId')) data.assigneeId = assigneeId
        if (Object.hasOwn(input, 'bookingId')) data.bookingId = bookingId
        if (Object.hasOwn(input, 'topicId')) data.topicId = topicId
        if (Object.hasOwn(input, 'title')) data.title = value(input.title, 'title', 255, true)!
        if (Object.hasOwn(input, 'description')) data.description = value(input.description, 'description', 10_000)
        if (Object.hasOwn(input, 'acceptanceCriteria')) data.acceptanceCriteria = value(input.acceptanceCriteria, 'acceptanceCriteria', 10_000, true)!
        if (Object.hasOwn(input, 'dueAt')) data.dueAt = taskDueAt(input.dueAt, deps.now())
      }
      if (Object.hasOwn(input, 'action')) data.status = taskTransition(task.status, input.action, actor.id, task.creatorId, task.assigneeId) as 'IN_PROGRESS' | 'CANCELLED'
      if (!contentEdit && !Object.hasOwn(input, 'action')) throw new LearningTaskError(400, 'No task changes supplied')
      const claimed = await tx.learningTask.updateMany({ where: { id: taskId, learningSpaceId: spaceId, version: task.version, status: task.status }, data })
      if (!claimed.count) throw new LearningTaskError(409, 'Task version conflict')
      return tx.learningTask.findUniqueOrThrow({ where: { id: taskId } })
    })
  }
  return { create, list, update }
}

export const learningTaskService = createLearningTaskService()
