import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { NextRequest } from 'next/server'

import {
  authorizeCronRequest,
  LOCAL_CRON_BYPASS_HEADER,
} from '../../../src/lib/cron-auth'
import {
  parsePrivateRealtimeChannel,
  privateConversationChannel,
  privateLearningSpaceChannel,
  privateUserChannel,
} from '../../../src/lib/realtime-channels'

function cronRequest(headers: Record<string, string> = {}) {
  return new NextRequest('http://local/api/cron/auto-complete', { headers })
}

test('private realtime channel helpers never produce public channel names', () => {
  assert.equal(privateConversationChannel('conversation-1'), 'private-conversation-conversation-1')
  assert.equal(privateUserChannel('user-a'), 'private-user-user-a')
  assert.equal(privateLearningSpaceChannel('space-1'), 'private-learning-space-space-1')
  assert.deepEqual(
    parsePrivateRealtimeChannel('private-conversation-conversation-1'),
    { kind: 'conversation', id: 'conversation-1' },
  )
  assert.equal(parsePrivateRealtimeChannel('conversation-conversation-1'), null)
  assert.throws(() => privateConversationChannel('../conversation-1'))
})

test('production cron requests reject missing and invalid secrets, including the local bypass header', async () => {
  const missing = authorizeCronRequest(cronRequest(), {
    nodeEnv: 'production',
    cronSecret: undefined,
  })
  assert.equal(missing?.status, 500)

  const invalid = authorizeCronRequest(cronRequest({ authorization: 'Bearer wrong' }), {
    nodeEnv: 'production',
    cronSecret: 'cron-secret-value',
  })
  assert.equal(invalid?.status, 401)

  const bypassAttempt = authorizeCronRequest(cronRequest({
    [LOCAL_CRON_BYPASS_HEADER]: '1',
  }), {
    nodeEnv: 'production',
    cronSecret: 'cron-secret-value',
  })
  assert.equal(bypassAttempt?.status, 401)

  const responseText = JSON.stringify(await invalid?.json())
  assert.doesNotMatch(responseText, /cron-secret-value/)
})

test('a valid cron secret works and the explicit local test path is unavailable in production', () => {
  const valid = authorizeCronRequest(cronRequest({
    authorization: 'Bearer cron-secret-value',
  }), {
    nodeEnv: 'production',
    cronSecret: 'cron-secret-value',
  })
  assert.equal(valid, null)

  const local = authorizeCronRequest(cronRequest({
    [LOCAL_CRON_BYPASS_HEADER]: '1',
  }), {
    nodeEnv: 'test',
    cronSecret: undefined,
  })
  assert.equal(local, null)

  const implicitLocal = authorizeCronRequest(cronRequest(), {
    nodeEnv: 'test',
    cronSecret: undefined,
  })
  assert.equal(implicitLocal?.status, 500)
})

test('security boundaries contain no secret or private-payload logging', () => {
  const sources = [
    'src/lib/cron-auth.ts',
    'src/lib/pusher-auth-route-handlers.ts',
    'src/lib/realtime-channels.ts',
  ].map((file) => readFileSync(file, 'utf8')).join('\n')

  assert.doesNotMatch(sources, /console\.(?:log|error|warn)/)
})
