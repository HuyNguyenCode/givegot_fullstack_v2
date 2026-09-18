import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LearningModeSelector } from '../../../src/components/learning/LearningModeSelector'
import {
  LEARNING_MODE_CONTRACTS,
  assertLearningModeChangeAllowed,
  evaluateLearningModeCompletion,
} from '../../../src/lib/learning-mode-contracts'

const now = new Date('2026-09-17T12:00:00.000Z')
const before = new Date('2026-09-17T10:00:00.000Z')
const after = new Date('2026-09-17T14:00:00.000Z')

test('LIVE requires objective, scheduled booking, meeting link, recap, and learner confirmation', () => {
  assert.deepEqual(LEARNING_MODE_CONTRACTS.LIVE.requiredArtifacts, [
    'OBJECTIVE', 'SCHEDULED_BOOKING', 'MEETING_LINK', 'RECAP',
  ])
  const incomplete = evaluateLearningModeCompletion('LIVE', {
    scheduledStart: new Date('2026-09-17T09:00:00.000Z'),
    scheduledEnd: before,
  }, now)
  assert.deepEqual(incomplete.missingArtifacts, ['OBJECTIVE', 'MEETING_LINK', 'RECAP'])
  assert.deepEqual(incomplete.blockedBy, ['LEARNER_ACCEPTANCE'])

  const complete = evaluateLearningModeCompletion('LIVE', {
    objective: 'Practice a client presentation',
    scheduledStart: new Date('2026-09-17T09:00:00.000Z'),
    scheduledEnd: before,
    meetingUrl: 'https://meet.google.com/example',
    recapCompleted: true,
    learnerAccepted: true,
  }, now)
  assert.equal(complete.eligible, true)
  assert.equal(complete.timingBasis, 'BOOKING_END')
})

test('EXERCISE_REVIEW uses task, submission, feedback, deliveredAt, and its review window instead of Meet endTime', () => {
  assert.deepEqual(LEARNING_MODE_CONTRACTS.EXERCISE_REVIEW.requiredArtifacts, [
    'TASK', 'SUBMISSION', 'FEEDBACK',
  ])
  const notDelivered = evaluateLearningModeCompletion('EXERCISE_REVIEW', {
    taskCompleted: true,
    submissionCompleted: true,
    feedbackCompleted: true,
    scheduledEnd: before,
    reviewWindowEndsAt: before,
  }, now)
  assert.equal(notDelivered.eligible, false)
  assert.deepEqual(notDelivered.blockedBy, ['NOT_DELIVERED'])

  const inReviewWindow = evaluateLearningModeCompletion('EXERCISE_REVIEW', {
    taskCompleted: true,
    submissionCompleted: true,
    feedbackCompleted: true,
    deliveredAt: before,
    scheduledEnd: new Date('2020-01-01T00:00:00.000Z'),
    reviewWindowEndsAt: after,
  }, now)
  assert.deepEqual(inReviewWindow.blockedBy, ['REVIEW_WINDOW'])

  const expired = evaluateLearningModeCompletion('EXERCISE_REVIEW', {
    taskCompleted: true,
    submissionCompleted: true,
    feedbackCompleted: true,
    deliveredAt: before,
    reviewWindowEndsAt: before,
  }, now)
  assert.equal(expired.eligible, true)
  assert.equal(expired.timingBasis, 'DELIVERED_AT')
})

test('HYBRID requires prework, acknowledgement or questions, scheduled Meet, recap, delivery, and acceptance', () => {
  assert.deepEqual(LEARNING_MODE_CONTRACTS.HYBRID.requiredArtifacts, [
    'PREWORK_ARTIFACT',
    'ACKNOWLEDGEMENT_OR_QUESTIONS',
    'SCHEDULED_BOOKING',
    'MEETING_LINK',
    'RECAP',
  ])
  assert.equal(LEARNING_MODE_CONTRACTS.HYBRID.preworkDeadlineAnchor, 'PREWORK_ARTIFACT_DUE_AT')
  assert.equal(LEARNING_MODE_CONTRACTS.HYBRID.reviewWindowAnchor, 'DELIVERED_AT')

  const meetEndedOnly = evaluateLearningModeCompletion('HYBRID', {
    scheduledStart: new Date('2026-09-17T09:00:00.000Z'),
    scheduledEnd: before,
    meetingUrl: 'https://meet.google.com/example',
  }, now)
  assert.equal(meetEndedOnly.eligible, false)
  assert.deepEqual(meetEndedOnly.missingArtifacts, [
    'PREWORK_ARTIFACT', 'ACKNOWLEDGEMENT_OR_QUESTIONS', 'RECAP',
  ])

  const complete = evaluateLearningModeCompletion('HYBRID', {
    preworkCompleted: true,
    acknowledgementOrQuestionsCompleted: true,
    scheduledStart: new Date('2026-09-17T09:00:00.000Z'),
    scheduledEnd: before,
    meetingUrl: 'https://meet.google.com/example',
    recapCompleted: true,
    deliveredAt: before,
    learnerAccepted: true,
  }, now)
  assert.equal(complete.eligible, true)
  assert.equal(complete.timingBasis, 'DELIVERED_AT')
})

test('disputes block every mode contract and null learningMode remains a legacy booking', () => {
  const disputed = evaluateLearningModeCompletion('EXERCISE_REVIEW', {
    taskCompleted: true,
    submissionCompleted: true,
    feedbackCompleted: true,
    deliveredAt: before,
    learnerAccepted: true,
    disputed: true,
  }, now)
  assert.equal(disputed.eligible, false)
  assert.ok(disputed.blockedBy.includes('DISPUTE'))

  assert.deepEqual(evaluateLearningModeCompletion(null, {}, now), {
    mode: null,
    legacy: true,
    eligible: false,
    missingArtifacts: [],
    blockedBy: [],
    timingBasis: 'LEGACY_BOOKING_POLICY',
  })
})

test('mode changes are allowed before delivery and rejected after delivery', () => {
  assert.doesNotThrow(() => assertLearningModeChangeAllowed('LIVE', 'HYBRID', 'NOT_STARTED'))
  assert.doesNotThrow(() => assertLearningModeChangeAllowed('HYBRID', 'EXERCISE_REVIEW', 'IN_PROGRESS'))
  assert.doesNotThrow(() => assertLearningModeChangeAllowed('LIVE', 'LIVE', 'SETTLED'))
  assert.throws(
    () => assertLearningModeChangeAllowed('LIVE', 'HYBRID', 'DELIVERED'),
    /cannot change after delivery/,
  )
})

test('mode selector presents three distinct evidence contracts and async timing copy', () => {
  const exerciseHtml = renderToStaticMarkup(createElement(LearningModeSelector, {
    value: 'EXERCISE_REVIEW',
    onChange: () => undefined,
  }))
  assert.match(exerciseHtml, /Học trực tiếp/)
  assert.match(exerciseHtml, /Bài tập và nhận xét/)
  assert.match(exerciseHtml, /Kết hợp/)
  assert.match(exerciseHtml, /deliveredAt/)

  const hybridHtml = renderToStaticMarkup(createElement(LearningModeSelector, {
    value: 'HYBRID',
    onChange: () => undefined,
  }))
  assert.match(hybridHtml, /Hạn prework/)
  assert.match(hybridHtml, /độc lập với giờ kết thúc Meet/)
})
