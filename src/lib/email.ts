import { Resend } from 'resend'
import type { ReactElement } from 'react'

// Lazily instantiated so a missing RESEND_API_KEY never crashes the app at
// import time — it only matters once someone actually tries to send an email.
let resendClient: Resend | null = null

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return null
  if (!resendClient) {
    resendClient = new Resend(apiKey)
  }
  return resendClient
}

/** Base URL used to build absolute links inside email templates. */
export function getAppUrl(): string {
  return process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
}

/** Formats a session date/time for display inside Vietnamese email templates. */
export function formatEmailDateTime(date: Date): string {
  return new Date(date).toLocaleString('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

interface SendEmailParams {
  to: string | string[]
  subject: string
  react: ReactElement
}

interface SendEmailResult {
  success: boolean
  error?: string
}

/**
 * Sends a transactional email via Resend using a React Email template.
 *
 * Additive utility — intentionally isolated from all core GiveGot logic
 * (bookings, GivePoints, trust score, AI matching). Callers should always
 * wrap this in a try/catch or Promise.allSettled so an email failure can
 * never break the primary database transaction that triggered it.
 */
export async function sendEmail({ to, subject, react }: SendEmailParams): Promise<SendEmailResult> {
  const client = getResendClient()

  if (!client) {
    console.warn('[Email] RESEND_API_KEY is not set — skipping email send:', subject)
    return { success: false, error: 'RESEND_API_KEY not configured' }
  }

  try {
    const { error } = await client.emails.send({
      from: 'GiveGot <onboarding@resend.dev>',
      to,
      subject,
      react,
    })

    if (error) {
      console.error('[Email] Resend returned an error:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[Email] Failed to send email:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
