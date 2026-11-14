import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LearningSpaceShell, requestSpaceLifecycle, SpaceLifecycleConflict } from '../../../src/components/learning/LearningSpaceShell'

const space = { id: 'space', viewerId: 'a', title: 'Học', state: 'ACTIVE' as const, version: 1, primarySkillName: 'Việt', objective: null, definitionOfDone: null, members: [{ id: 'a', name: 'An', email: null }, { id: 'b', name: 'Bình', email: null }], topics: [], bookings: [] }

test('archive and restore send sequential versions and consume returned state', async () => {
  const requests: Array<{ url: string; method?: string; body?: string }> = []
  const request = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), method: init?.method, body: String(init?.body) })
    return Response.json({ space: { state: requests.length === 1 ? 'ARCHIVED' : 'ACTIVE', version: requests.length + 4 } })
  }) as typeof fetch
  const archived = await requestSpaceLifecycle('s/1', 'archive', 4, request)
  const restored = await requestSpaceLifecycle('s/1', 'restore', archived.version, request)
  assert.deepEqual(archived, { state: 'ARCHIVED', version: 5 })
  assert.deepEqual(restored, { state: 'ACTIVE', version: 6 })
  assert.deepEqual(requests, [
    { url: '/api/learning/spaces/s%2F1', method: 'PATCH', body: JSON.stringify({ action: 'archive', expectedVersion: 4 }) },
    { url: '/api/learning/spaces/s%2F1', method: 'PATCH', body: JSON.stringify({ action: 'restore', expectedVersion: 5 }) },
  ])
})

test('conflicts, API failures and malformed success do not yield a lifecycle update', async () => {
  await assert.rejects(requestSpaceLifecycle('s', 'archive', 1, (async () => Response.json({ error: 'conflict' }, { status: 409 })) as typeof fetch), SpaceLifecycleConflict)
  await assert.rejects(requestSpaceLifecycle('s', 'archive', 1, (async () => Response.json({ error: 'denied' }, { status: 403 })) as typeof fetch), /denied/)
  await assert.rejects(requestSpaceLifecycle('s', 'archive', 1, (async () => Response.json({ space: { state: 'ACTIVE', version: 2 } })) as typeof fetch))
  await assert.rejects(requestSpaceLifecycle('s', 'archive', 1, (async () => { throw new Error('offline') }) as typeof fetch), /offline/)
})

test('active and archived shell show lifecycle action and retain rebooking', () => {
  const active = renderToStaticMarkup(createElement(LearningSpaceShell, { space }))
  assert.match(active, /Lưu trữ không gian/)
  const archived = renderToStaticMarkup(createElement(LearningSpaceShell, { space: { ...space, state: 'ARCHIVED' } }))
  assert.match(archived, /Khôi phục không gian/)
  assert.match(archived, /Đặt buổi học tiếp theo/)
  assert.match(archived, /LearningSpace đã lưu trữ/)
})
