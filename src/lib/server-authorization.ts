import type { UserRole } from '@prisma/client'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export type AuthorizationStatus = 401 | 403 | 404

export class AuthorizationError extends Error {
  readonly status: AuthorizationStatus

  constructor(status: AuthorizationStatus, message: string) {
    super(message)
    this.name = 'AuthorizationError'
    this.status = status
  }
}

export function isAuthorizationError(error: unknown): error is AuthorizationError {
  return error instanceof AuthorizationError
}

export type AuthenticatedUser = Readonly<{
  id: string
  email: string | null
  name: string | null
}>

export type ConversationParticipant = Readonly<{
  id: string
  userAId: string
  userBId: string
}>

type SessionIdentity = {
  user?: {
    id?: string | null
    email?: string | null
    name?: string | null
  }
} | null

export interface ServerAuthorizationDependencies {
  getSession(): Promise<SessionIdentity>
  findConversation(conversationId: string): Promise<ConversationParticipant | null>
  findUserAccess(userId: string): Promise<{
    role: UserRole
    isSuspended: boolean
  } | null>
}

/**
 * Repository boundary for the future LearningSpace schema. A1 intentionally
 * defines the authorization contract without creating a model or migration.
 */
export interface LearningSpaceMembershipLookup<TMembership> {
  findSpaceMembership(input: {
    spaceId: string
    userId: string
  }): Promise<{
    spaceExists: boolean
    membership: TMembership | null
  }>
}

export function assertConversationParticipant(
  conversation: ConversationParticipant,
  user: AuthenticatedUser,
): ConversationParticipant {
  if (conversation.userAId !== user.id && conversation.userBId !== user.id) {
    throw new AuthorizationError(403, 'You are not a participant of this conversation')
  }

  return conversation
}

export function createServerAuthorization(dependencies: ServerAuthorizationDependencies) {
  async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
    const session = await dependencies.getSession()
    const id = session?.user?.id

    if (!id) {
      throw new AuthorizationError(401, 'Authentication required')
    }

    return Object.freeze({
      id,
      email: session.user?.email ?? null,
      name: session.user?.name ?? null,
    })
  }

  async function requireConversationParticipant(
    conversationId: string,
    authenticatedUser?: AuthenticatedUser,
  ): Promise<ConversationParticipant> {
    const user = authenticatedUser ?? await requireAuthenticatedUser()
    const conversation = await dependencies.findConversation(conversationId)

    if (!conversation) {
      throw new AuthorizationError(404, 'Conversation not found')
    }

    return assertConversationParticipant(conversation, user)
  }

  async function requireAdminUser(
    authenticatedUser?: AuthenticatedUser,
  ): Promise<AuthenticatedUser> {
    const user = authenticatedUser ?? await requireAuthenticatedUser()
    const access = await dependencies.findUserAccess(user.id)

    if (!access) {
      throw new AuthorizationError(401, 'Authentication required')
    }

    if (access.isSuspended || access.role !== 'ADMIN') {
      throw new AuthorizationError(403, 'Administrator access required')
    }

    return user
  }

  async function requireLearningSpaceMember<TMembership>(
    spaceId: string,
    lookup: LearningSpaceMembershipLookup<TMembership>,
    authenticatedUser?: AuthenticatedUser,
  ): Promise<Readonly<{ user: AuthenticatedUser; membership: TMembership }>> {
    const user = authenticatedUser ?? await requireAuthenticatedUser()
    const result = await lookup.findSpaceMembership({ spaceId, userId: user.id })

    if (!result.spaceExists) {
      throw new AuthorizationError(404, 'Learning space not found')
    }

    if (!result.membership) {
      throw new AuthorizationError(403, 'Learning space membership required')
    }

    return Object.freeze({ user, membership: result.membership })
  }

  return {
    requireAuthenticatedUser,
    requireConversationParticipant,
    requireAdminUser,
    requireLearningSpaceMember,
  }
}

const serverAuthorization = createServerAuthorization({
  getSession: () => auth(),
  findConversation: (conversationId) => prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userAId: true, userBId: true },
  }),
  findUserAccess: (userId) => prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, isSuspended: true },
  }),
})

export const requireAuthenticatedUser = serverAuthorization.requireAuthenticatedUser
export const requireConversationParticipant = serverAuthorization.requireConversationParticipant
export const requireAdminUser = serverAuthorization.requireAdminUser
export const requireLearningSpaceMember = serverAuthorization.requireLearningSpaceMember
