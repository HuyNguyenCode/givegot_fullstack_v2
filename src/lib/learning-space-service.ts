import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser, requireLearningSpaceMember } from '@/lib/server-authorization'
import type { AuthenticatedUser, LearningSpaceMembershipLookup } from '@/lib/server-authorization'
import type { Prisma } from '@prisma/client'

export class LearningSpaceConflictError extends Error { readonly status = 409; constructor(message: string) { super(message) } }
export class LearningSpaceValidationError extends Error { readonly status = 400; constructor(message: string) { super(message) } }
export const isLearningSpaceError = (error: unknown): error is LearningSpaceConflictError | LearningSpaceValidationError => error instanceof LearningSpaceConflictError || error instanceof LearningSpaceValidationError
const text = (value: unknown, field: string, max = 200) => {
  if (typeof value !== 'string') throw new LearningSpaceValidationError(`${field} is required`)
  const result = value.trim()
  if (!result) throw new LearningSpaceValidationError(`${field} is required`)
  if (result.length > max) throw new LearningSpaceValidationError(`${field} is too long`)
  return result
}
const version = (value: unknown) => {
  if (!Number.isInteger(value) || (value as number) < 1) throw new LearningSpaceValidationError('expectedVersion must be a positive integer')
  return value as number
}
const active = (space: any) => { if (space.state !== 'ACTIVE') throw new LearningSpaceConflictError('Archived learning spaces cannot be changed') }
const pair = (a: string, b: string): [string, string] => a < b ? [a, b] : [b, a]

export type LearningSpaceRepository = LearningSpaceMembershipLookup<any> & { transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> }
type Dependencies = { repository: LearningSpaceRepository; requireAuthenticatedUser(): Promise<AuthenticatedUser>; requireLearningSpaceMember(spaceId: string): Promise<{ user: AuthenticatedUser }>; now?(): Date }

export function createLearningSpaceService(deps: Dependencies) {
  const now = deps.now ?? (() => new Date())
  const member = (spaceId: string) => deps.requireLearningSpaceMember(text(spaceId, 'spaceId', 191))
  const detail = (value: unknown, field: string) => value == null ? null : text(value, field, 10_000)
  async function createDirect(input: any) {
    const actor = await deps.requireAuthenticatedUser(); const memberId = text(input.memberId, 'memberId', 191)
    if (memberId === actor.id) throw new LearningSpaceValidationError('A learning space needs two different members')
    const data = { title: text(input.title, 'title'), primarySkillId: text(input.primarySkillId, 'primarySkillId', 191), objective: detail(input.objective, 'objective'), definitionOfDone: detail(input.definitionOfDone, 'definitionOfDone'), createdById: actor.id }
    return deps.repository.transaction(async tx => {
      if (!await tx.userExists(memberId)) throw new AuthorizationError(404, 'Learning space member not found')
      if (!await tx.skillExists(data.primarySkillId)) throw new LearningSpaceValidationError('primarySkillId must reference an existing skill')
      const space = await tx.createSpace(data); await tx.createMember(space.id, actor.id); await tx.createMember(space.id, memberId); return space
    })
  }
  async function createFromConfirmedBooking(input: any) {
    const actor = await deps.requireAuthenticatedUser(); const bookingId = text(input.bookingId, 'bookingId', 191)
    const data = { title: text(input.title, 'title'), primarySkillId: text(input.primarySkillId, 'primarySkillId', 191), objective: detail(input.objective, 'objective'), definitionOfDone: detail(input.definitionOfDone, 'definitionOfDone'), createdById: actor.id }
    return deps.repository.transaction(async tx => {
      const booking = await tx.booking(bookingId); if (!booking) throw new AuthorizationError(404, 'Booking not found')
      if (booking.mentorId !== actor.id && booking.menteeId !== actor.id) throw new AuthorizationError(403, 'Booking participant access required')
      if (booking.status !== 'CONFIRMED') throw new LearningSpaceConflictError('Only confirmed bookings can create a learning space')
      if (booking.learningSpaceId) throw new LearningSpaceConflictError('Booking is already associated with a learning space')
      if (!await tx.skillExists(data.primarySkillId)) throw new LearningSpaceValidationError('primarySkillId must reference an existing skill')
      const space = await tx.createSpace(data); await tx.createMember(space.id, booking.mentorId); await tx.createMember(space.id, booking.menteeId); await tx.attachBooking(bookingId, space.id); return space
    })
  }
  async function read(spaceId: string) { await member(spaceId); return deps.repository.transaction(async tx => { const space = await tx.space(spaceId); if (!space) throw new AuthorizationError(404, 'Learning space not found'); return { space, topics: await tx.topics(spaceId) } }) }
  async function suggestReuse(input: any) {
    const actor = await deps.requireAuthenticatedUser(); const memberId = text(input.memberId, 'memberId', 191); const primarySkillId = text(input.primarySkillId, 'primarySkillId', 191)
    if (memberId === actor.id) throw new LearningSpaceValidationError('A learning space needs two different members')
    return deps.repository.transaction(async tx => { if (!await tx.skillExists(primarySkillId)) throw new LearningSpaceValidationError('primarySkillId must reference an existing skill'); return tx.reusable({ memberIds: pair(actor.id, memberId), primarySkillId }) })
  }
  async function addMember(spaceId: string, input: any) {
    const { user } = await member(spaceId); const memberId = text(input.memberId, 'memberId', 191)
    return deps.repository.transaction(async tx => { await tx.lock(spaceId); const space = await tx.space(spaceId); if (!space) throw new AuthorizationError(404, 'Learning space not found'); active(space); const existing = await tx.member(spaceId, memberId); if (existing?.status === 'ACTIVE') return existing; if (!await tx.userExists(memberId)) throw new AuthorizationError(404, 'Learning space member not found'); if (await tx.activeMemberCount(spaceId) >= 2) throw new LearningSpaceConflictError('A learning space can have only two active members'); return existing ? tx.reactivateMember(spaceId, memberId) : tx.createMember(spaceId, memberId) })
  }
  async function updateDetails(spaceId: string, input: any) { return update(spaceId, input, 'details') }
  async function changePrimarySkill(spaceId: string, input: any) { return update(spaceId, input, 'skill') }
  async function update(spaceId: string, input: any, kind: 'details' | 'skill') {
    const { user } = await member(spaceId); const expected = version(input.expectedVersion)
    if (kind === 'details' && !Object.hasOwn(input, 'objective') && !Object.hasOwn(input, 'definitionOfDone')) throw new LearningSpaceValidationError('objective or definitionOfDone is required')
    const primarySkillId = kind === 'skill' ? text(input.primarySkillId, 'primarySkillId', 191) : undefined
    return deps.repository.transaction(async tx => { await tx.lock(spaceId); const current = await tx.space(spaceId); if (!current) throw new AuthorizationError(404, 'Learning space not found'); active(current); if (current.version !== expected) throw new LearningSpaceConflictError('Learning space was updated by another member'); if (primarySkillId && !await tx.skillExists(primarySkillId)) throw new LearningSpaceValidationError('primarySkillId must reference an existing skill'); const space = await tx.updateSpace(spaceId, expected, { primarySkillId, objective: Object.hasOwn(input, 'objective') ? detail(input.objective, 'objective') : undefined, definitionOfDone: Object.hasOwn(input, 'definitionOfDone') ? detail(input.definitionOfDone, 'definitionOfDone') : undefined, updatedById: user.id, version: { increment: 1 } }); if (!space) throw new LearningSpaceConflictError('Learning space was updated by another member'); await tx.activity({ learningSpaceId: spaceId, actorId: user.id, eventType: kind === 'skill' ? 'LEARNING_SPACE_PRIMARY_SKILL_CHANGED' : 'LEARNING_SPACE_DETAILS_UPDATED', entityType: 'LearningSpace', entityId: spaceId, eventKey: `learning-space:${spaceId}:${kind}:${space.version}`, metadata: kind === 'skill' ? { previousPrimarySkillId: current.primarySkillId, primarySkillId, version: space.version } : { version: space.version } }); return space })
  }
  async function changeState(spaceId: string, input: any, state: 'ACTIVE' | 'ARCHIVED') { const { user } = await member(spaceId); const expected = version(input.expectedVersion); return deps.repository.transaction(async tx => { await tx.lock(spaceId); const current = await tx.space(spaceId); if (!current) throw new AuthorizationError(404, 'Learning space not found'); if (current.state === state) throw new LearningSpaceConflictError('Learning space is already in that state'); if (current.version !== expected) throw new LearningSpaceConflictError('Learning space was updated by another member'); const space = await tx.updateSpace(spaceId, expected, { state, archivedAt: state === 'ARCHIVED' ? now() : null, updatedById: user.id, version: { increment: 1 } }); if (!space) throw new LearningSpaceConflictError('Learning space was updated by another member'); return space }) }
  async function addTopic(spaceId: string, input: any) { const { user } = await member(spaceId); const label = text(input.label, 'label'); const skillId = input.skillId == null ? null : text(input.skillId, 'skillId', 191); return deps.repository.transaction(async tx => { await tx.lock(spaceId); const space = await tx.space(spaceId); if (!space) throw new AuthorizationError(404, 'Learning space not found'); active(space); if (skillId && !await tx.skillExists(skillId)) throw new LearningSpaceValidationError('skillId must reference an existing skill'); return tx.createTopic({ learningSpaceId: spaceId, label, normalizedLabel: label.toLowerCase(), skillId, creatorId: user.id, provenance: input.provenance == null ? null : text(input.provenance, 'provenance', 500) }) }) }
  async function renameTopic(spaceId: string, topicId: string, input: any) { await member(spaceId); const label = text(input.label, 'label'); return deps.repository.transaction(async tx => { await tx.lock(spaceId); const space = await tx.space(spaceId); if (!space) throw new AuthorizationError(404, 'Learning space not found'); active(space); const topic = await tx.topic(spaceId, topicId); if (!topic) throw new AuthorizationError(404, 'Learning topic not found'); if (topic.state === 'ARCHIVED') throw new LearningSpaceConflictError('Archived learning topics cannot be renamed'); return tx.updateTopic(topicId, { label, normalizedLabel: label.toLowerCase() }) }) }
  async function archiveTopic(spaceId: string, topicId: string) { await member(spaceId); return deps.repository.transaction(async tx => { await tx.lock(spaceId); const space = await tx.space(spaceId); if (!space) throw new AuthorizationError(404, 'Learning space not found'); active(space); const topic = await tx.topic(spaceId, topicId); if (!topic) throw new AuthorizationError(404, 'Learning topic not found'); return topic.state === 'ARCHIVED' ? topic : tx.updateTopic(topicId, { state: 'ARCHIVED', archivedAt: now() }) }) }
  return { createDirect, createFromConfirmedBooking, read, suggestReuse, addMember, updateDetails, changePrimarySkill, archive: (id: string, input: any) => changeState(id, input, 'ARCHIVED'), restore: (id: string, input: any) => changeState(id, input, 'ACTIVE'), addTopic, renameTopic, archiveTopic }
}

function tx(client: Prisma.TransactionClient): any { return {
  lock: (spaceId: string) => client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${spaceId}))`, space: (id: string) => client.learningSpace.findUnique({ where: { id } }), member: (learningSpaceId: string, userId: string) => client.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId, userId } } }), activeMemberCount: (learningSpaceId: string) => client.learningSpaceMember.count({ where: { learningSpaceId, status: 'ACTIVE' } }), userExists: async (id: string) => Boolean(await client.user.findUnique({ where: { id }, select: { id: true } })), skillExists: async (id: string) => Boolean(await client.skill.findUnique({ where: { id }, select: { id: true } })), createSpace: (data: any) => client.learningSpace.create({ data }), createMember: (learningSpaceId: string, userId: string) => client.learningSpaceMember.create({ data: { learningSpaceId, userId } }), reactivateMember: (learningSpaceId: string, userId: string) => client.learningSpaceMember.update({ where: { learningSpaceId_userId: { learningSpaceId, userId } }, data: { status: 'ACTIVE', joinedAt: new Date(), leftAt: null } }), booking: (id: string) => client.booking.findUnique({ where: { id }, select: { id: true, mentorId: true, menteeId: true, status: true, learningSpaceId: true } }), attachBooking: async (id: string, learningSpaceId: string) => { const r = await client.booking.updateMany({ where: { id, learningSpaceId: null }, data: { learningSpaceId } }); if (r.count !== 1) throw new LearningSpaceConflictError('Booking is already associated with a learning space') }, updateSpace: async (id: string, expectedVersion: number, data: any) => (await client.learningSpace.updateMany({ where: { id, version: expectedVersion }, data })).count ? client.learningSpace.findUnique({ where: { id } }) : null, topic: (learningSpaceId: string, id: string) => client.learningTopic.findFirst({ where: { id, learningSpaceId } }), topics: (learningSpaceId: string) => client.learningTopic.findMany({ where: { learningSpaceId }, orderBy: { createdAt: 'asc' } }), createTopic: (data: any) => client.learningTopic.create({ data }), updateTopic: (id: string, data: any) => client.learningTopic.update({ where: { id }, data }), activity: (data: any) => client.learningActivity.create({ data }), reusable: ({ memberIds, primarySkillId }: any) => client.learningSpace.findMany({ where: { state: 'ACTIVE', primarySkillId, AND: [{ members: { some: { userId: memberIds[0], status: 'ACTIVE' } } }, { members: { some: { userId: memberIds[1], status: 'ACTIVE' } } }, { members: { none: { status: 'ACTIVE', userId: { notIn: memberIds } } } }] }, orderBy: { updatedAt: 'desc' } })
} }
export const learningSpaceRepository: LearningSpaceRepository = { findSpaceMembership: async ({ spaceId, userId }) => { const space = await prisma.learningSpace.findUnique({ where: { id: spaceId }, select: { id: true, members: { where: { userId, status: 'ACTIVE' }, take: 1 } } }); return { spaceExists: Boolean(space), membership: space?.members[0] ?? null } }, transaction: fn => prisma.$transaction(client => fn(tx(client))) }
export const learningSpaceService = createLearningSpaceService({ repository: learningSpaceRepository, requireAuthenticatedUser, requireLearningSpaceMember: spaceId => requireLearningSpaceMember(spaceId, learningSpaceRepository) })
