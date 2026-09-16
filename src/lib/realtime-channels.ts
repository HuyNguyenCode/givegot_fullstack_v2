const CHANNEL_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

export type PrivateRealtimeChannel =
  | Readonly<{ kind: 'conversation'; id: string }>
  | Readonly<{ kind: 'user'; id: string }>
  | Readonly<{ kind: 'learning-space'; id: string }>

function assertChannelId(id: string): string {
  if (!CHANNEL_ID_PATTERN.test(id)) {
    throw new Error('Invalid realtime channel identifier')
  }

  return id
}

export function privateConversationChannel(conversationId: string): string {
  return `private-conversation-${assertChannelId(conversationId)}`
}

export function privateUserChannel(userId: string): string {
  return `private-user-${assertChannelId(userId)}`
}

export function privateLearningSpaceChannel(spaceId: string): string {
  return `private-learning-space-${assertChannelId(spaceId)}`
}

export function parsePrivateRealtimeChannel(
  channelName: string,
): PrivateRealtimeChannel | null {
  const prefixes = [
    ['private-conversation-', 'conversation'],
    ['private-user-', 'user'],
    ['private-learning-space-', 'learning-space'],
  ] as const

  for (const [prefix, kind] of prefixes) {
    if (!channelName.startsWith(prefix)) continue
    const id = channelName.slice(prefix.length)
    if (!CHANNEL_ID_PATTERN.test(id)) return null
    return Object.freeze({ kind, id })
  }

  return null
}
