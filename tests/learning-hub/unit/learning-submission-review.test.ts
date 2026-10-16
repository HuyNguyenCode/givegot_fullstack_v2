import assert from 'node:assert/strict'
import test from 'node:test'
import { reviewInput } from '../../../src/lib/learning-submission-review-service'
import { reviewBody, reviewFixture, reviewNow } from '../helpers/submission-review-fixture'

test('eligible task creator reviews privately regardless of reversed Booking roles; public rating, Trust and GP unchanged', async () => {
  const f = reviewFixture(); f.linkBooking('CONFIRMED')
  const before = f.snapshot().booking
  const result = await f.reviews.review('space', 'task', reviewBody())
  assert.equal(result.review.reviewerId, 'creator')
  assert.equal(result.review.content, 'Private feedback')
  assert.equal(result.review.reviewedAt, reviewNow)
  assert.equal(result.task.status, 'COMPLETED')
  assert.equal(result.task.version, 3)
  assert.equal(result.submission.status, 'REVIEWED')
  assert.equal(result.submission.revisionCount, 1)
  assert.deepEqual(f.snapshot().booking, before)
  assert.deepEqual(f.sideEffects, [])
  assert.deepEqual(f.transactions[0], { isolationLevel: 'Serializable' })
  const event = f.snapshot().events[0]
  assert.equal(event.eventKey, 'learning-submission-review:submission:revision:1')
  assert.equal(event.eventType, 'LEARNING_SUBMISSION_REVIEWED')
  assert.doesNotMatch(JSON.stringify(event), /Private feedback|Private answer|storageKey|linkUrl/)
})

test('nonreviewer, outsider, spoofed identity, self-review and inconsistent author are denied', async () => {
  const f = reviewFixture(); f.actor('assignee')
  await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 403 })
  f.actor('outsider')
  await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 403 })
  f.actor('creator')
  await assert.rejects(f.reviews.review('space', 'task', { ...reviewBody(), reviewerId: 'creator' }), { status: 400 })
  f.actor('assignee'); f.selfTask()
  await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 403 })
  const broken = reviewFixture(); broken.author('outsider')
  await assert.rejects(broken.reviews.review('space', 'task', reviewBody()), { status: 409 })
  assert.equal(f.snapshot().events.length, 0)
})

test('revision request reopens both records; optional dueAt is independent and G2 resubmits then G3 reviews the same rows', async () => {
  const f = reviewFixture()
  const deadline = '2030-01-03T12:00:00+07:00'
  await f.reviews.review('space', 'task', { ...reviewBody('REVISION_REQUESTED'), revisionDueAt: deadline })
  let state = f.snapshot()
  assert.equal(state.task.status, 'REVISION_REQUESTED')
  assert.equal(state.submission.status, 'REVISION_REQUESTED')
  assert.equal((state.task.dueAt as Date).toISOString(), '2030-01-03T05:00:00.000Z')
  assert.equal(state.events[0].eventType, 'LEARNING_REVISION_REQUESTED')
  f.actor('assignee')
  const revised = await f.submissions.submit('space', 'task', { content: 'Revised private answer' })
  assert.equal(revised.id, 'submission'); assert.equal(revised.revisionCount, 2)
  assert.equal((await f.reviews.current('space', 'task')).review, null)
  f.actor('creator')
  await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 409 })
  await f.reviews.review('space', 'task', { ...reviewBody('REVIEWED', 2), content: 'Updated private feedback' })
  state = f.snapshot()
  assert.equal(state.review?.id, 'review'); assert.equal(state.review?.content, 'Updated private feedback')
  assert.equal(state.submission.revisionCount, 2)
  assert.deepEqual(state.events.map(event => event.eventKey), ['learning-submission-review:submission:revision:1', 'learning-submission:submission:revision:2', 'learning-submission-review:submission:revision:2'])
  assert.equal((state.events[0].metadata as Record<string, unknown>).outcome, 'REVISION_REQUESTED')
})

test('omitted revision deadline preserves existing dueAt; null clears it; malformed or past deadlines fail', async () => {
  const f = reviewFixture()
  await f.reviews.review('space', 'task', { ...reviewBody('REVISION_REQUESTED'), revisionDueAt: '2030-02-01T00:00:00Z' })
  f.actor('assignee'); await f.submissions.submit('space', 'task', { content: 'v2' }); f.actor('creator')
  await f.reviews.review('space', 'task', reviewBody('REVISION_REQUESTED', 2))
  assert.equal((f.snapshot().task.dueAt as Date).toISOString(), '2030-02-01T00:00:00.000Z')
  f.actor('assignee'); await f.submissions.submit('space', 'task', { content: 'v3' }); f.actor('creator')
  await f.reviews.review('space', 'task', { ...reviewBody('REVISION_REQUESTED', 3), revisionDueAt: null })
  assert.equal(f.snapshot().task.dueAt, null)
  for (const due of ['2030-01-01T00:00:00Z', '2029-01-01T00:00:00Z', '2030-02-01', 'nonsense']) assert.throws(() => reviewInput({ ...reviewBody('REVISION_REQUESTED'), revisionDueAt: due }, reviewNow), { status: 400 })
  for (const input of [{ ...reviewBody(), content: ' ' }, { ...reviewBody(), content: 'x'.repeat(20001) }, { ...reviewBody(), outcome: 'COMPLETED' }, { ...reviewBody(), revisionCount: 0 }, { ...reviewBody(), revisionDueAt: null }]) assert.throws(() => reviewInput(input, reviewNow), { status: 400 })
})

test('duplicate and concurrent review requests commit one outcome and one audit event', async () => {
  const f = reviewFixture()
  const result = await Promise.allSettled([f.reviews.review('space', 'task', reviewBody()), f.reviews.review('space', 'task', reviewBody('REVISION_REQUESTED'))])
  assert.equal(result.filter(value => value.status === 'fulfilled').length, 1)
  assert.equal(result.filter(value => value.status === 'rejected').length, 1)
  await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 409 })
  assert.equal(f.snapshot().events.length, 1)
  assert.equal(f.snapshot().task.version, 3)
})

test('claim failure, unique event collision and serialization conflict roll back every review write', async () => {
  for (const mode of ['task', 'submission', 'P2002', 'P2034']) {
    const f = reviewFixture(); const before = f.snapshot()
    if (mode.startsWith('P')) f.fail(mode); else f.claim(mode)
    await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 409 })
    assert.deepEqual(f.snapshot(), before)
  }
})

test('disputed, cancelled, missed Booking and closed/inconsistent Task or Submission reject review', async () => {
  for (const status of ['DISPUTED', 'CANCELLED', 'MISSED']) {
    const f = reviewFixture(); f.linkBooking(status)
    const before = f.snapshot()
    await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 409 })
    assert.deepEqual(f.snapshot(), before)
    assert.equal((await f.reviews.current('space', 'task')).canReview, false)
  }
  for (const status of ['OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REVISION_REQUESTED']) {
    const f = reviewFixture(); f.taskState(status)
    await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 409 })
  }
  const f = reviewFixture(); f.submissionState('REVIEWED')
  await assert.rejects(f.reviews.review('space', 'task', reviewBody()), { status: 409 })
})

test('feedback is member-only; archived members can read; inactive/suspended pairs cannot write', async () => {
  const f = reviewFixture(); await f.reviews.review('space', 'task', reviewBody())
  f.actor('assignee')
  assert.equal((await f.reviews.current('space', 'task')).review?.content, 'Private feedback')
  f.archive()
  assert.equal((await f.reviews.current('space', 'task')).review?.content, 'Private feedback')
  f.actor('outsider')
  await assert.rejects(f.reviews.current('space', 'task'), { status: 403 })
  f.actor('creator'); await assert.rejects(f.reviews.current('other-space', 'task'), { status: 403 })
  await assert.rejects(f.reviews.current('space', 'other-task'), { status: 404 })
  const archived = reviewFixture(); archived.archive()
  await assert.rejects(archived.reviews.review('space', 'task', reviewBody()), { status: 409 })
  for (const user of ['creator', 'assignee']) {
    const suspended = reviewFixture(); suspended.members.get(user)!.suspended = true
    await assert.rejects(suspended.reviews.review('space', 'task', reviewBody()), { status: user === 'creator' ? 403 : 409 })
    const inactive = reviewFixture(); inactive.members.get(user)!.active = false
    await assert.rejects(inactive.reviews.review('space', 'task', reviewBody()), { status: user === 'creator' ? 403 : 409 })
  }
})
