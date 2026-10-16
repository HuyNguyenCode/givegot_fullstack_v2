import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { createLearningNoteCollectionHandlers, createLearningNoteItemHandlers } from '../../../src/lib/learning-note-route-handlers'
import { LearningNoteError } from '../../../src/lib/learning-note-service'

const url = 'https://givegot.test/api/learning/spaces/space/notes'
const collection = { params: Promise.resolve({ spaceId: 'space' }) }
const item = { params: Promise.resolve({ spaceId: 'space', noteId: 'note' }) }
const request = (method: string, body?: unknown) => new NextRequest(url, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) })

test('H1 collection and item routes preserve status, no-store, and session service boundary', async () => {
  const calls: string[] = []
  const service = {
    list: async () => { calls.push('list'); return [] },
    create: async (_space: string, value: Record<string, unknown>) => { calls.push('create'); return { id: 'note', ...value } },
    read: async () => { calls.push('read'); return { id: 'note' } },
    update: async (_space: string, _note: string, value: Record<string, unknown>) => { calls.push('update'); return value },
    remove: async (_space: string, _note: string, value: Record<string, unknown>) => { calls.push('remove'); return value },
  }
  const c = createLearningNoteCollectionHandlers(service as never), i = createLearningNoteItemHandlers(service as never)
  assert.equal((await c.GET(request('GET'), collection)).status, 200)
  assert.equal((await c.POST(request('POST', { content: 'Xin chào' }), collection)).status, 201)
  assert.equal((await i.GET(request('GET'), item)).headers.get('Cache-Control'), 'no-store')
  assert.equal((await i.PATCH(request('PATCH', { expectedVersion: 1, content: 'sửa' }), item)).status, 200)
  assert.equal((await i.DELETE(request('DELETE', { expectedVersion: 2 }), item)).status, 200)
  assert.deepEqual(calls, ['list', 'create', 'read', 'update', 'remove'])
})

test('H1 routes reject malformed JSON and do not expose internal errors', async () => {
  const service = { list: async () => { throw new Error('secret note text') }, create: async () => { throw new LearningNoteError(409, 'Note version conflict') } }
  const c = createLearningNoteCollectionHandlers(service as never)
  const internal = await c.GET(request('GET'), collection)
  assert.equal(internal.status, 500)
  assert.doesNotMatch(await internal.text(), /secret note text/)
  assert.equal((await c.POST(request('POST', []), collection)).status, 400)
  assert.equal((await c.POST(request('POST', { content: 'x' }), collection)).status, 409)
})

