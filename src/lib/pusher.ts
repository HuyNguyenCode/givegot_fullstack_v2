/**
 * Server-side Pusher instance.
 * Import ONLY in API route handlers or server actions — never in client components.
 * Uses the `pusher` npm package which requires Node.js runtime.
 */
import Pusher from 'pusher'

export const pusherServer = new Pusher({
  appId:   process.env.PUSHER_APP_ID!,
  key:     process.env.NEXT_PUBLIC_PUSHER_APP_KEY!,
  secret:  process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS:  true,
})
