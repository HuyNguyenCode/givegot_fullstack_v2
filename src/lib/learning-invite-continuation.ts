import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import type { NextRequest, NextResponse } from 'next/server'

export const LEARNING_INVITE_CONTINUATION_COOKIE = 'learning_invite_continuation'
const CONTINUATION_TTL_SECONDS = 10 * 60

type ContinuationPayload = { token: string; expiresAt: number }

function key(secret: string) {
  return createHash('sha256').update(secret).digest()
}

/**
 * The raw invite token is retained only in a short-lived, encrypted HttpOnly
 * cookie while the recipient crosses the existing login/signup boundary.
 */
export function sealLearningInviteContinuation(token: string, secret = process.env.NEXTAUTH_SECRET): string {
  if (!secret) throw new Error('NEXTAUTH_SECRET is required to preserve a LearningInvite through authentication')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(secret), iv)
  const payload = Buffer.from(JSON.stringify({ token, expiresAt: Date.now() + CONTINUATION_TTL_SECONDS * 1000 }))
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()])
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url')
}

export function openLearningInviteContinuation(value: string | undefined, secret = process.env.NEXTAUTH_SECRET): string | null {
  if (!value || !secret) return null
  try {
    const packed = Buffer.from(value, 'base64url')
    const iv = packed.subarray(0, 12)
    const tag = packed.subarray(12, 28)
    const ciphertext = packed.subarray(28)
    if (iv.length !== 12 || tag.length !== 16 || !ciphertext.length) return null
    const decipher = createDecipheriv('aes-256-gcm', key(secret), iv)
    decipher.setAuthTag(tag)
    const payload = JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString()) as ContinuationPayload
    if (typeof payload.token !== 'string' || !payload.token || !Number.isFinite(payload.expiresAt) || payload.expiresAt <= Date.now()) return null
    return payload.token
  } catch {
    return null
  }
}

export function setLearningInviteContinuation(response: NextResponse, token: string, secret?: string) {
  response.cookies.set(LEARNING_INVITE_CONTINUATION_COOKIE, sealLearningInviteContinuation(token, secret), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: CONTINUATION_TTL_SECONDS,
    path: '/',
  })
}

export function readLearningInviteContinuation(request: NextRequest, secret?: string) {
  return openLearningInviteContinuation(request.cookies.get(LEARNING_INVITE_CONTINUATION_COOKIE)?.value, secret)
}

export function clearLearningInviteContinuation(response: NextResponse) {
  response.cookies.set(LEARNING_INVITE_CONTINUATION_COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' })
}
