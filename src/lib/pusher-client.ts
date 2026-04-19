/**
 * Browser-side Pusher singleton.
 * Import ONLY in client components (inside useEffect or event handlers).
 * The singleton pattern prevents creating multiple connections on re-renders.
 */
import PusherClient from 'pusher-js'

// Lazily created on first call — avoids SSR instantiation errors
let _client: PusherClient | null = null

export function getPusherClient(): PusherClient | null {
  if (typeof window === 'undefined') return null
  if (!_client) {
    _client = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_APP_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    })
  }
  return _client
}

/**
 * Channel name conventions:
 *   conversation-<id>   public channel for a single conversation
 *
 * Event names:
 *   new-message         emitted when a message is saved (data = MessagePayload)
 */
