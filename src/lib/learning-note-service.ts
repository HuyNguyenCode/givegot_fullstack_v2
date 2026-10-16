import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'
import type { LearningNote, LearningNoteType, LearningNoteVisibility } from '@prisma/client'

export class LearningNoteError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message) }
}

const allowed = (input: Record<string, unknown>, keys: string[]) => {
  if (Object.keys(input).some(key => !keys.includes(key))) throw new LearningNoteError(400, 'Unsupported note field')
}
const id = (input: unknown) => typeof input === 'string' && input.length > 0 && input.length <= 191 ? input : null
const content = (input: unknown) => {
  if (typeof input !== 'string' || !input.trim() || input.length > 50_000) throw new LearningNoteError(400, 'Note content must be 1–50,000 characters')
  return input.trim()
}
const version = (input: unknown) => {
  if (!Number.isSafeInteger(input) || (input as number) < 1) throw new LearningNoteError(400, 'Invalid expectedVersion')
  return input as number
}
const type = (input: unknown): LearningNoteType => {
  if (input !== 'GENERAL' && input !== 'RECAP') throw new LearningNoteError(400, 'Invalid note type')
  return input
}
const visibility = (input: unknown): LearningNoteVisibility => {
  if (input !== 'SPACE_MEMBERS' && input !== 'BOOKING_PARTICIPANTS' && input !== 'AUTHOR_ONLY') throw new LearningNoteError(400, 'Invalid visibility')
  return input
}

type Dependencies = { db: typeof prisma; actor: typeof requireAuthenticatedUser; now: () => Date }
const defaults: Dependencies = { db: prisma, actor: requireAuthenticatedUser, now: () => new Date() }

export function createLearningNoteService(deps: Dependencies = defaults) {
  async function member(spaceId: string, userId: string, write: boolean) {
    const membership = await deps.db.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId } }, select: { status: true, learningSpace: { select: { state: true } }, user: { select: { isSuspended: true } } } })
    if (!membership || membership.status !== 'ACTIVE' || membership.user.isSuspended) throw new AuthorizationError(403, 'Learning space membership required')
    if (write && membership.learningSpace.state !== 'ACTIVE') throw new LearningNoteError(409, 'Archived learning spaces are read-only')
  }
  async function booking(spaceId: string, bookingId: string | null, actorId: string) {
    if (!bookingId) return
    const row = await deps.db.booking.findFirst({ where: { id: bookingId, learningSpaceId: spaceId }, select: { mentorId: true, menteeId: true } })
    if (!row || (row.mentorId !== actorId && row.menteeId !== actorId)) throw new LearningNoteError(400, 'Booking must belong to this space and author')
  }
  async function canRead(note: LearningNote, actorId: string) {
    if (note.deletedAt) return false
    if (note.visibility === 'AUTHOR_ONLY') return note.authorId === actorId
    if (note.visibility === 'BOOKING_PARTICIPANTS') {
      if (!note.bookingId) return false
      const row = await deps.db.booking.findFirst({ where: { id: note.bookingId, learningSpaceId: note.learningSpaceId }, select: { mentorId: true, menteeId: true } })
      return !!row && (row.mentorId === actorId || row.menteeId === actorId)
    }
    return true
  }
  async function list(spaceId: string) {
    const actor = await deps.actor(); await member(spaceId, actor.id, false)
    const rows = await deps.db.learningNote.findMany({ where: { learningSpaceId: spaceId, deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { author: { select: { name: true } } } })
    const visible = await Promise.all(rows.map(async row => await canRead(row, actor.id) ? row : null))
    return visible.filter(row => row !== null)
  }
  async function read(spaceId: string, noteId: string) {
    const actor = await deps.actor(); await member(spaceId, actor.id, false)
    const row = await deps.db.learningNote.findFirst({ where: { id: noteId, learningSpaceId: spaceId }, include: { author: { select: { name: true } } } })
    if (!row || !await canRead(row, actor.id)) throw new LearningNoteError(404, 'Note not found')
    return row
  }
  async function create(spaceId: string, input: Record<string, unknown>) {
    allowed(input, ['content', 'type', 'visibility', 'bookingId'])
    const actor = await deps.actor(); await member(spaceId, actor.id, true)
    const bookingId = input.bookingId == null ? null : id(input.bookingId)
    if (input.bookingId != null && !bookingId) throw new LearningNoteError(400, 'Invalid bookingId')
    const noteVisibility = input.visibility === undefined ? 'SPACE_MEMBERS' : visibility(input.visibility)
    if (noteVisibility === 'BOOKING_PARTICIPANTS' && !bookingId) throw new LearningNoteError(400, 'Booking required for this visibility')
    await booking(spaceId, bookingId, actor.id)
    return deps.db.learningNote.create({ data: { learningSpaceId: spaceId, authorId: actor.id, bookingId, content: content(input.content), type: input.type === undefined ? 'GENERAL' : type(input.type), visibility: noteVisibility } })
  }
  async function change(spaceId: string, noteId: string, input: Record<string, unknown>, remove = false) {
    allowed(input, remove ? ['expectedVersion'] : ['expectedVersion', 'content', 'type', 'visibility', 'bookingId'])
    const expectedVersion = version(input.expectedVersion)
    if (!remove && !Object.keys(input).some(key => key !== 'expectedVersion')) throw new LearningNoteError(400, 'No note changes supplied')
    const actor = await deps.actor(); await member(spaceId, actor.id, true)
    const row = await deps.db.learningNote.findFirst({ where: { id: noteId, learningSpaceId: spaceId } })
    if (!row || row.deletedAt) throw new LearningNoteError(404, 'Note not found')
    if (row.authorId !== actor.id) throw new AuthorizationError(403, 'Only the author may change a note')
    if (row.version !== expectedVersion) throw new LearningNoteError(409, 'Note version conflict')
    const bookingId = Object.hasOwn(input, 'bookingId') ? input.bookingId == null ? null : id(input.bookingId) : row.bookingId
    if (Object.hasOwn(input, 'bookingId') && input.bookingId != null && !bookingId) throw new LearningNoteError(400, 'Invalid bookingId')
    const nextVisibility = Object.hasOwn(input, 'visibility') ? visibility(input.visibility) : row.visibility
    if (!remove && nextVisibility === 'BOOKING_PARTICIPANTS' && !bookingId) throw new LearningNoteError(400, 'Booking required for this visibility')
    if (!remove) await booking(spaceId, bookingId, actor.id)
    const data = remove ? { deletedAt: deps.now(), deletedById: actor.id, version: { increment: 1 } } : {
      content: Object.hasOwn(input, 'content') ? content(input.content) : row.content,
      type: Object.hasOwn(input, 'type') ? type(input.type) : row.type,
      visibility: nextVisibility, bookingId, version: { increment: 1 },
    }
    const claimed = await deps.db.learningNote.updateMany({ where: { id: noteId, learningSpaceId: spaceId, authorId: actor.id, version: expectedVersion, deletedAt: null }, data })
    if (!claimed.count) throw new LearningNoteError(409, 'Note version conflict')
    return deps.db.learningNote.findUniqueOrThrow({ where: { id: noteId } })
  }
  return { list, read, create, update: (spaceId: string, noteId: string, input: Record<string, unknown>) => change(spaceId, noteId, input), remove: (spaceId: string, noteId: string, input: Record<string, unknown>) => change(spaceId, noteId, input, true) }
}

export const learningNoteService = createLearningNoteService()
