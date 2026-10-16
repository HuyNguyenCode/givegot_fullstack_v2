import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { createLearningSubmissionReviewHandlers } from '../../../src/lib/learning-submission-review-route-handlers'
import { reviewBody, reviewFixture } from '../helpers/submission-review-fixture'

const context = { params: Promise.resolve({ spaceId: 'space', taskId: 'task' }) }
const get = () => new NextRequest('https://givegot.test/api/learning/spaces/space/tasks/task/submission/review')
const post = (body: unknown) => new NextRequest(get().url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
test('G3 route integrates session reviewer, revision request, private read, G2 resubmit and final review', async () => {
  const f = reviewFixture(); const route = createLearningSubmissionReviewHandlers(f.reviews)
  let response: Response = await route.GET(get(), context)
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store')
  assert.equal((await response.json()).canReview, true)
  response = await route.POST(post(reviewBody('REVISION_REQUESTED')), context)
  assert.equal(response.status, 201)
  assert.equal((await response.json()).task.status, 'REVISION_REQUESTED')
  f.actor('assignee')
  response = await route.GET(get(), context)
  assert.equal((await response.json()).review.content, 'Private feedback')
  await f.submissions.submit('space', 'task', { content: 'Second answer' })
  f.actor('creator')
  response = await route.POST(post(reviewBody('REVIEWED', 2)), context)
  assert.equal(response.status, 201)
  assert.equal((await response.json()).submission.status, 'REVIEWED')
  assert.deepEqual(f.sideEffects, [])
})
test('G3 routes return 401/403 before private feedback, 404 for scoped task, 409 for duplicate, 400 for bad body', async () => {
  const f = reviewFixture(); const route = createLearningSubmissionReviewHandlers(f.reviews)
  await route.POST(post(reviewBody()), context)
  assert.equal((await route.POST(post(reviewBody()), context)).status, 409)
  f.actor('outsider')
  for (const response of [await route.GET(get(), context), await route.POST(post(reviewBody()), context)]) {
    assert.equal(response.status, 403); assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.doesNotMatch(await response.text(), /Private feedback|Private answer/)
  }
  f.actor('assignee'); assert.equal((await route.POST(post(reviewBody()), context)).status, 403)
  f.actor('creator')
  assert.equal((await route.GET(get(), { params: Promise.resolve({ spaceId: 'space', taskId: 'missing' }) })).status, 404)
  for (const value of [null, [], 'text', { ...reviewBody(), actorId: 'creator' }]) assert.equal((await route.POST(post(value), context)).status, 400)
  assert.equal((await route.POST(new NextRequest(get().url, { method: 'POST', body: '{' }), context)).status, 400)
  f.loggedOut()
  assert.equal((await route.GET(get(), context)).status, 401)
  assert.equal((await route.POST(post(reviewBody()), context)).status, 401)
})
test('G3 route hides unexpected internal errors and requires explicit revision identity', async () => {
  const f = reviewFixture(); const route = createLearningSubmissionReviewHandlers(f.reviews)
  for (const body of [{ content: 'feedback', outcome: 'REVIEWED' }, { ...reviewBody(), submissionId: 'wrong' }]) {
    assert.equal((await route.POST(post(body), context)).status, 'submissionId' in body ? 409 : 400)
  }
  f.fail('P9999')
  const response = await route.POST(post(reviewBody()), context)
  assert.equal(response.status, 500)
  assert.deepEqual(await response.json(), { error: 'Review request failed' })
  assert.equal(f.snapshot().review, null)
})
