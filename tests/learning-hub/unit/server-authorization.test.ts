import assert from 'node:assert/strict'
import test from 'node:test'

import {
  AuthorizationError,
  createServerAuthorization,
  type ConversationParticipant,
  type ServerAuthorizationDependencies,
} from '../../../src/lib/server-authorization'

const conversation: ConversationParticipant = {
  id: 'conversation-1',
  userAId: 'user-a',
  userBId: 'user-b',
}

function authorizationWith(
  overrides: Partial<ServerAuthorizationDependencies> = {},
) {
  return createServerAuthorization({
    getSession: async () => ({
      user: { id: 'user-a', email: 'a@example.com', name: 'User A' },
    }),
    findConversation: async () => conversation,
    findUserAccess: async () => ({ role: 'USER', isSuspended: false }),
    ...overrides,
  })
}

test('requireAuthenticatedUser rejects a missing server session with 401', async () => {
  const authorization = authorizationWith({ getSession: async () => null })

  await assert.rejects(
    authorization.requireAuthenticatedUser(),
    (error: unknown) => error instanceof AuthorizationError && error.status === 401,
  )
})

test('requireConversationParticipant distinguishes participant, nonparticipant, and missing object', async () => {
  const authorization = authorizationWith()
  const actor = await authorization.requireAuthenticatedUser()

  assert.deepEqual(
    await authorization.requireConversationParticipant(conversation.id, actor),
    conversation,
  )

  await assert.rejects(
    authorization.requireConversationParticipant(conversation.id, {
      id: 'user-c',
      email: null,
      name: null,
    }),
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  )

  const missing = authorizationWith({ findConversation: async () => null })
  await assert.rejects(
    missing.requireConversationParticipant('missing', actor),
    (error: unknown) => error instanceof AuthorizationError && error.status === 404,
  )
})

test('requireAdminUser preserves admin access and rejects ordinary or suspended users', async () => {
  const admin = authorizationWith({
    findUserAccess: async () => ({ role: 'ADMIN', isSuspended: false }),
  })
  assert.equal((await admin.requireAdminUser()).id, 'user-a')

  const ordinary = authorizationWith()
  await assert.rejects(
    ordinary.requireAdminUser(),
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  )

  const suspendedAdmin = authorizationWith({
    findUserAccess: async () => ({ role: 'ADMIN', isSuspended: true }),
  })
  await assert.rejects(
    suspendedAdmin.requireAdminUser(),
    (error: unknown) => error instanceof AuthorizationError && error.status === 403,
  )
})

test('requireLearningSpaceMember uses session identity through the future repository interface', async () => {
  const authorization = authorizationWith()
  let lookedUpUserId: string | null = null

  const result = await authorization.requireLearningSpaceMember('space-1', {
    findSpaceMembership: async ({ userId }) => {
      lookedUpUserId = userId
      return { spaceExists: true, membership: { id: 'membership-1' } }
    },
  })

  assert.equal(lookedUpUserId, 'user-a')
  assert.deepEqual(result.membership, { id: 'membership-1' })
})
