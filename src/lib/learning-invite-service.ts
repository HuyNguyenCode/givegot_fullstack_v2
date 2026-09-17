import { createHash, randomBytes } from 'node:crypto'

import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'
import type { AuthenticatedUser } from '@/lib/server-authorization'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export class LearningInviteConflictError extends Error { readonly status = 409; constructor(message: string) { super(message) } }
export class LearningInviteValidationError extends Error { readonly status = 400; constructor(message: string) { super(message) } }
export const isLearningInviteError = (error: unknown): error is LearningInviteConflictError | LearningInviteValidationError => error instanceof LearningInviteConflictError || error instanceof LearningInviteValidationError

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')
const rawToken = () => randomBytes(32).toString('base64url')
const text = (value: unknown, field: string, max = 2_000) => {
  if (typeof value !== 'string') throw new LearningInviteValidationError(`${field} is required`)
  const result = value.trim()
  if (!result) throw new LearningInviteValidationError(`${field} is required`)
  if (result.length > max) throw new LearningInviteValidationError(`${field} is too long`)
  return result
}
const optionalText = (value: unknown, field: string, max = 2_000) => value == null ? null : text(value, field, max)
const expiresAt = (value: unknown, now: Date) => {
  const date = value instanceof Date ? value : new Date(typeof value === 'string' ? value : Number.NaN)
  if (Number.isNaN(date.getTime()) || date <= now) throw new LearningInviteValidationError('expiresAt must be in the future')
  return date
}
const publicInvite = (invite: any) => {
  const { tokenHash: _tokenHash, ...safe } = invite
  return safe
}

export interface LearningInviteRepository {
  transaction<T>(fn: (transaction: any) => Promise<T>): Promise<T>
  findInviteByHash(hash: string): Promise<any | null>
}

export function createLearningInviteService(deps: {
  repository: LearningInviteRepository
  requireAuthenticatedUser?: () => Promise<AuthenticatedUser>
  now?: () => Date
  generateToken?: () => string
}) {
  const now = deps.now ?? (() => new Date())
  const authenticate = deps.requireAuthenticatedUser ?? requireAuthenticatedUser
  const generateToken = deps.generateToken ?? rawToken

  async function create(input: any) {
    const inviter = await authenticate()
    const primarySkillId = text(input.primarySkillId, 'primarySkillId', 191)
    const objective = optionalText(input.objective, 'objective')
    const expiry = expiresAt(input.expiresAt, now())
    // A successful invite makes a private pair. A larger limit could only ever
    // create an invalid third active member, so the persisted limit is one.
    if (input.maxUses != null && input.maxUses !== 1) throw new LearningInviteValidationError('maxUses must be 1 for a private pair invite')
    const token = generateToken()
    if (typeof token !== 'string' || token.length < 32) throw new LearningInviteValidationError('Unable to generate a secure invite token')
    return deps.repository.transaction(async tx => {
      if (!await tx.skillExists(primarySkillId)) throw new LearningInviteValidationError('primarySkillId must reference an existing skill')
      const invite = await tx.createInvite({ inviterId: inviter.id, tokenHash: tokenHash(token), primarySkillId, objective, maxUses: 1, expiresAt: expiry })
      return { invite: publicInvite(invite), token }
    })
  }

  async function preview(token: unknown) {
    const invite = await deps.repository.findInviteByHash(tokenHash(text(token, 'token', 512)))
    if (!invite) throw new AuthorizationError(404, 'Learning invite not found')
    const status = invite.status === 'ACTIVE' && invite.expiresAt <= now() ? 'EXPIRED' : invite.status
    return { invite: publicInvite(invite), status, canAccept: status === 'ACTIVE' && invite.useCount < invite.maxUses }
  }

  async function revoke(inviteId: string) {
    const actor = await authenticate()
    return deps.repository.transaction(async tx => {
      // Accept locks the token hash. Resolve then acquire that same lock and
      // re-read so revoke and accept cannot cross their state transitions.
      const initial = await tx.inviteById(inviteId)
      if (!initial) throw new AuthorizationError(404, 'Learning invite not found')
      await tx.lock(initial.tokenHash)
      const invite = await tx.inviteById(inviteId)
      if (!invite) throw new AuthorizationError(404, 'Learning invite not found')
      if (invite.inviterId !== actor.id) throw new AuthorizationError(403, 'Only the inviter can revoke this invite')
      if (invite.status === 'REVOKED') return publicInvite(invite)
      if (invite.status !== 'ACTIVE') throw new LearningInviteConflictError('Only an active invite can be revoked')
      return publicInvite(await tx.revokeInvite(inviteId, now()))
    })
  }

  async function accept(token: unknown, input: any = {}) {
    const recipient = await authenticate()
    const hash = tokenHash(text(token, 'token', 512))
    return deps.repository.transaction(async tx => {
      await tx.lock(hash)
      const invite = await tx.inviteByHash(hash)
      if (!invite) throw new AuthorizationError(404, 'Learning invite not found')
      if (invite.status === 'ACCEPTED') {
        if (invite.acceptedById !== recipient.id) throw new AuthorizationError(403, 'Learning invite was accepted by a different user')
        return { invite: publicInvite(invite), space: await tx.space(invite.learningSpaceId), idempotent: true }
      }
      if (invite.status === 'REVOKED') throw new LearningInviteConflictError('Learning invite has been revoked')
      if (invite.status === 'EXPIRED' || invite.expiresAt <= now()) {
        if (invite.status === 'ACTIVE') await tx.expireInvite(invite.id, now())
        throw new LearningInviteConflictError('Learning invite has expired')
      }
      if (invite.inviterId === recipient.id) throw new LearningInviteConflictError('You cannot accept your own Learning invite')
      if (invite.useCount >= invite.maxUses) throw new LearningInviteConflictError('Learning invite usage limit has been reached')

      let space: any
      const reuseSpaceId = input.reuseSpaceId == null ? null : text(input.reuseSpaceId, 'reuseSpaceId', 191)
      if (reuseSpaceId) {
        await tx.lock(reuseSpaceId)
        space = await tx.space(reuseSpaceId)
        if (!space) throw new AuthorizationError(404, 'Learning space not found')
        if (space.state !== 'ACTIVE') throw new LearningInviteConflictError('Only an active LearningSpace can be reused')
        if (space.primarySkillId !== invite.primarySkillId) throw new LearningInviteConflictError('LearningSpace primary skill does not match this invite')
        const members = await tx.activeMembers(reuseSpaceId)
        if (!members.some((member: any) => member.userId === invite.inviterId)) throw new LearningInviteConflictError('The inviter is not an active member of this LearningSpace')
        if (members.some((member: any) => member.userId !== invite.inviterId && member.userId !== recipient.id)) throw new LearningInviteConflictError('Reusing this LearningSpace would create a third active member')
        if (!members.some((member: any) => member.userId === recipient.id)) await tx.createMember(reuseSpaceId, recipient.id)
      } else {
        const skill = await tx.skill(invite.primarySkillId)
        if (!skill) throw new LearningInviteValidationError('Invite primary skill no longer exists')
        space = await tx.createSpace({ title: `Learning: ${skill.name}`, primarySkillId: invite.primarySkillId, objective: invite.objective, createdById: invite.inviterId, updatedById: invite.inviterId })
        await tx.createMember(space.id, invite.inviterId)
        await tx.createMember(space.id, recipient.id)
      }

      const accepted = await tx.acceptInvite(invite.id, recipient.id, space.id, now())
      if (!accepted) throw new LearningInviteConflictError('Learning invite was already used')
      return { invite: publicInvite(accepted), space, idempotent: false }
    })
  }

  return { create, preview, revoke, accept }
}

function tx(client: Prisma.TransactionClient): any { return {
  lock: (key: string) => client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`,
  skillExists: async (id: string) => Boolean(await client.skill.findUnique({ where: { id }, select: { id: true } })),
  skill: (id: string) => client.skill.findUnique({ where: { id }, select: { id: true, name: true } }),
  createInvite: (data: any) => client.learningInvite.create({ data }),
  inviteById: (id: string) => client.learningInvite.findUnique({ where: { id } }),
  inviteByHash: (hash: string) => client.learningInvite.findUnique({ where: { tokenHash: hash } }),
  expireInvite: (id: string, at: Date) => client.learningInvite.update({ where: { id }, data: { status: 'EXPIRED', updatedAt: at } }),
  revokeInvite: (id: string, at: Date) => client.learningInvite.update({ where: { id }, data: { status: 'REVOKED', revokedAt: at } }),
  space: (id: string | null) => id ? client.learningSpace.findUnique({ where: { id } }) : null,
  activeMembers: (learningSpaceId: string) => client.learningSpaceMember.findMany({ where: { learningSpaceId, status: 'ACTIVE' }, select: { userId: true } }),
  createSpace: (data: any) => client.learningSpace.create({ data }),
  createMember: (learningSpaceId: string, userId: string) => client.learningSpaceMember.create({ data: { learningSpaceId, userId } }),
  acceptInvite: async (id: string, acceptedById: string, learningSpaceId: string, acceptedAt: Date) => {
    const result = await client.learningInvite.updateMany({ where: { id, status: 'ACTIVE', useCount: { lt: 1 } }, data: { status: 'ACCEPTED', acceptedById, learningSpaceId, acceptedAt, useCount: { increment: 1 } } })
    return result.count ? client.learningInvite.findUnique({ where: { id } }) : null
  },
} }

export const learningInviteRepository: LearningInviteRepository = {
  transaction: fn => prisma.$transaction(client => fn(tx(client))),
  findInviteByHash: hash => prisma.learningInvite.findUnique({ where: { tokenHash: hash } }),
}
export const learningInviteService = createLearningInviteService({ repository: learningInviteRepository })
