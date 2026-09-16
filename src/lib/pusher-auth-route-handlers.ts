import { NextRequest, NextResponse } from 'next/server'

import { pusherServer } from '@/lib/pusher'
import { parsePrivateRealtimeChannel } from '@/lib/realtime-channels'
import {
  AuthorizationError,
  isAuthorizationError,
  type AuthenticatedUser,
  type ConversationParticipant,
} from '@/lib/server-authorization'

export type PusherAuthRouteDependencies = {
  pusherServer: Pick<typeof pusherServer, 'authorizeChannel'>
  requireAuthenticatedUser(): Promise<AuthenticatedUser>
  requireConversationParticipant(
    conversationId: string,
    authenticatedUser?: AuthenticatedUser,
  ): Promise<ConversationParticipant>
  authorizeLearningSpaceChannel?(
    spaceId: string,
    authenticatedUser: AuthenticatedUser,
  ): Promise<void>
}

function authorizationResponse(error: unknown): NextResponse | null {
  if (!isAuthorizationError(error)) return null
  return NextResponse.json({ error: error.message }, { status: error.status })
}

export function createPusherAuthRouteHandler(
  dependencies: PusherAuthRouteDependencies,
) {
  return async function POST(req: NextRequest) {
    try {
      const actor = await dependencies.requireAuthenticatedUser()
      const form = await req.formData()
      const socketId = form.get('socket_id')
      const channelName = form.get('channel_name')

      if (typeof socketId !== 'string' || typeof channelName !== 'string') {
        return NextResponse.json({ error: 'Invalid channel authorization request' }, { status: 400 })
      }

      const channel = parsePrivateRealtimeChannel(channelName)
      if (!channel) {
        throw new AuthorizationError(403, 'Realtime channel access denied')
      }

      if (channel.kind === 'conversation') {
        await dependencies.requireConversationParticipant(channel.id, actor)
      } else if (channel.kind === 'user') {
        if (channel.id !== actor.id) {
          throw new AuthorizationError(403, 'Realtime channel access denied')
        }
      } else {
        if (!dependencies.authorizeLearningSpaceChannel) {
          throw new AuthorizationError(403, 'Learning space realtime is not available')
        }
        await dependencies.authorizeLearningSpaceChannel(channel.id, actor)
      }

      return NextResponse.json(
        dependencies.pusherServer.authorizeChannel(socketId, channelName),
      )
    } catch (error) {
      const denied = authorizationResponse(error)
      if (denied) return denied

      // Never log the request body: it contains a socket identifier and the
      // name of a private channel.
      return NextResponse.json({ error: 'Invalid channel authorization request' }, { status: 400 })
    }
  }
}
