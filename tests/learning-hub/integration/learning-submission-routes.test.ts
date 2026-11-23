import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { createLearningSubmissionHandlers } from '../../../src/lib/learning-submission-route-handlers'
import { reviewBody, reviewFixture } from '../helpers/submission-review-fixture'

const url = 'https://givegot.test/api/learning/spaces/space/tasks/task/submission'
const context = { params: Promise.resolve({ spaceId: 'space', taskId: 'task' }) }
const post = (body: object) => new NextRequest(url, { method: 'POST', body: JSON.stringify(body) })

test('G2 route preserves its error envelope and types only confirmed freshness mismatches', async () => {
  const f = reviewFixture()
  const route = createLearningSubmissionHandlers(f.submissions)
  await f.reviews.review('space', 'task', { ...reviewBody('REVISION_REQUESTED'), revisionDueAt: '2030-02-01T00:00:00Z' })
  f.actor('assignee')
  const before = f.snapshot()
  const freshness = f.freshness()
  const answer = { content: 'New answer' }
  for (const input of [answer, { ...answer, freshness: {} }]) {
    const response = await route.POST(post(input), context)
    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), { error: 'Invalid submission freshness precondition' })
  }
  const staleRequirements = await route.POST(post({ ...answer, freshness: { ...freshness, requirements: { ...freshness.requirements, dueAt: null } } }), context)
  assert.equal(staleRequirements.status, 409)
  assert.equal(staleRequirements.headers.get('Cache-Control'), 'no-store')
  assert.deepEqual(await staleRequirements.json(), { error: 'Task requirements changed', code: 'TASK_REQUIREMENTS_CHANGED' })
  const staleRevision = await route.POST(post({ ...answer, freshness: { ...freshness, previousSubmission: null } }), context)
  assert.equal(staleRevision.status, 409)
  assert.deepEqual(await staleRevision.json(), { error: 'Submission revision changed', code: 'STALE_SUBMISSION_REVISION' })
  assert.deepEqual(f.snapshot(), before)
  const saved = await route.POST(post({ ...answer, freshness }), context)
  assert.equal(saved.status, 201)
  assert.equal((await saved.json()).submission.revisionCount, 2)
  const locked = await route.POST(post({ ...answer, freshness }), context)
  assert.equal(locked.status, 409)
  assert.deepEqual(await locked.json(), { error: 'Submission is not editable in the current task state' })
})

test('G2 refresh reads current Task and Submission together, with existing private read authorization', async () => {
  const f = reviewFixture()
  const route = createLearningSubmissionHandlers(f.submissions)
  const refresh = () => route.GET(new NextRequest(url + '?view=requirements'), context)
  f.actor('outsider')
  assert.equal((await refresh()).status, 403)
  f.actor('assignee')
  const response = await refresh()
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
  const data = await response.json()
  assert.equal(data.task.title, 'Task')
  assert.equal(data.submission.id, 'submission')
  assert.equal(data.archived, false)
  assert.deepEqual(f.transactions[0], { isolationLevel: 'Serializable' })
  const standard = await route.GET(new NextRequest(url), context)
  assert.deepEqual(await standard.json(), { submission: data.submission })
  f.archive()
  assert.equal((await (await refresh()).json()).archived, true)
})

test('G2 serialization failure leaves the Task, Submission and activity unchanged', async () => {
  const f = reviewFixture()
  await f.reviews.review('space', 'task', reviewBody('REVISION_REQUESTED'))
  f.actor('assignee')
  f.fail('P2034')
  const before = f.snapshot()
  const route = createLearningSubmissionHandlers(f.submissions)
  const response = await route.POST(post({ content: 'New answer', freshness: f.freshness() }), context)
  assert.equal(response.status, 409)
  assert.deepEqual(await response.json(), { error: 'Submission changed; refresh and try again' })
  assert.deepEqual(f.snapshot(), before)
})
