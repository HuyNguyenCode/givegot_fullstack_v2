import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { createPusherAuthRouteHandler } from '../../../src/lib/pusher-auth-route-handlers'
import {
  privateConversationChannel,
  privateLearningSpaceChannel,
  privateUserChannel,
} from '../../../src/lib/realtime-channels'
import {
  AuthorizationError,
  type AuthenticatedUser,
} from '../../../src/lib/server-authorization'

const ACTOR: AuthenticatedUser = Object.freeze({
  id: 'user-a',
  email: 'a@example.com',
  name: 'User A',
})

const CONVERSATION = {
  id: 'conversation-1',
  userAId: ACTOR.id,
  userBId: 'user-b',
}

function authRequest(channelName: string) {
  return new NextRequest('http://local/api/pusher/auth', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      socket_id: '123.456',
      channel_name: channelName,
    }),
  })
}

type Dependencies = Parameters<typeof createPusherAuthRouteHandler>[0]

function dependenciesWith(overrides: Partial<Dependencies> = {}): Dependencies {
  return {
    pusherServer: {
      authorizeChannel: (socketId: string, channelName: string) => ({
        auth: `signed:${socketId}:${channelName}`,
      }),
    } as Dependencies['pusherServer'],
    requireAuthenticatedUser: async () => ACTOR,
    requireConversationParticipant: async (conversationId, actor) => {
      assert.equal(conversationId, CONVERSATION.id)
      assert.equal(actor?.id, ACTOR.id)
      return CONVERSATION
    },
    ...overrides,
  }
}

test('unauthorized private channel subscription fails before provider authorization', async () => {
  let providerCalled = false
  const post = createPusherAuthRouteHandler(dependenciesWith({
    pusherServer: {
      authorizeChannel: () => {
        providerCalled = true
        return { auth: 'must-not-run' }
      },
    } as Dependencies['pusherServer'],
    requireAuthenticatedUser: async () => {
      throw new AuthorizationError(401, 'Authentication required')
    },
  }))

  const response = await post(authRequest(privateConversationChannel(CONVERSATION.id)))

  assert.equal(response.status, 401)
  assert.equal(providerCalled, false)
})

test('a nonmember cannot subscribe by guessing a conversation or user ID', async () => {
  let providerCalled = false
  const post = createPusherAuthRouteHandler(dependenciesWith({
    pusherServer: {
      authorizeChannel: () => {
        providerCalled = true
        return { auth: 'must-not-run' }
      },
    } as Dependencies['pusherServer'],
    requireConversationParticipant: async () => {
      throw new AuthorizationError(403, 'You are not a participant of this conversation')
    },
  }))

  const conversationResponse = await post(
    authRequest(privateConversationChannel('guessed-conversation')),
  )
  const userResponse = await post(authRequest(privateUserChannel('user-b')))

  assert.equal(conversationResponse.status, 403)
  assert.equal(userResponse.status, 403)
  assert.equal(providerCalled, false)
})

test('a participant receives a legitimate private conversation authorization', async () => {
  const post = createPusherAuthRouteHandler(dependenciesWith())
  const channelName = privateConversationChannel(CONVERSATION.id)

  const response = await post(authRequest(channelName))
  const payload = await response.json() as { auth: string }

  assert.equal(response.status, 200)
  assert.equal(payload.auth, `signed:123.456:${channelName}`)
})

test('private user notifications authorize only the matching session and LearningSpace stays deny-by-default', async () => {
  const post = createPusherAuthRouteHandler(dependenciesWith())

  assert.equal((await post(authRequest(privateUserChannel(ACTOR.id)))).status, 200)
  assert.equal((await post(authRequest(privateLearningSpaceChannel('space-1')))).status, 403)
  assert.equal((await post(authRequest('conversation-conversation-1'))).status, 403)
})
