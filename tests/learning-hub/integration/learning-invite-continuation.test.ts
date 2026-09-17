import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'

import { readLearningInviteContinuation, setLearningInviteContinuation } from '../../../src/lib/learning-invite-continuation'
import { createLearningInviteAcceptHandlers, createLearningInvitePreviewHandlers } from '../../../src/lib/learning-invite-route-handlers'

const SECRET = 'invite-continuation-test-secret'
const TOKEN = '4f_DdsMNjrFKri7cogT10OCcYDI3aaOdBvyNkYmNQjg'

test('C1 preserves a logged-out invite only in a short-lived encrypted HttpOnly continuation cookie', async () => {
  let acceptedToken: string | null = null
  const service: any = {
    preview: async () => ({ invite: { id: 'invite-1' }, status: 'ACTIVE', canAccept: true }),
    accept: async (token: string) => { acceptedToken = token; return { invite: { id: 'invite-1' }, space: { id: 'space-1' }, idempotent: false } },
  }
  const preview = createLearningInvitePreviewHandlers(service, (response, token) => setLearningInviteContinuation(response, token, SECRET)).POST
  const previewResponse = await preview(new NextRequest('http://local/api/learning/invites/preview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) }))
  const setCookie = previewResponse.headers.get('set-cookie')!
  assert.match(setCookie, /HttpOnly/); assert.doesNotMatch(setCookie, new RegExp(TOKEN))
  const cookie = setCookie.split(';', 1)[0]
  const accept = createLearningInviteAcceptHandlers(service, request => readLearningInviteContinuation(request, SECRET)).POST
  const acceptResponse = await accept(new NextRequest('http://local/api/learning/invites/accept', { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: JSON.stringify({}) }))
  assert.equal(acceptResponse.status, 200); assert.equal(acceptedToken, TOKEN); assert.match(acceptResponse.headers.get('set-cookie')!, /Max-Age=0/)
})
