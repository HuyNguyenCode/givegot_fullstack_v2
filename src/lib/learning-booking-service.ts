import type { LearningModeValue } from '@/lib/learning-mode-contracts'
import { isLearningMode } from '@/lib/learning-mode-contracts'

export class LearningBookingValidationError extends Error {
  readonly status = 400
}

export class LearningBookingAuthorizationError extends Error {
  readonly status = 404
}

export type LearningBookingSelectionInput = {
  learningSpaceId: string
  learningMode: LearningModeValue
  topicId?: string | null
  objective?: string | null
  definitionOfDone?: string | null
}

export type LearningBookingRecord = {
  id: string
  title: string
  state: 'ACTIVE' | 'ARCHIVED'
  objective: string | null
  definitionOfDone: string | null
  members: Array<{ userId: string; status: 'ACTIVE' | 'LEFT' | 'REMOVED' }>
  topics: Array<{ id: string; label: string; state: 'ACTIVE' | 'ARCHIVED' }>
}

export type LearningBookingRepository = {
  lockSpace(spaceId: string): Promise<unknown>
  isActiveMember(spaceId: string, userId: string): Promise<boolean>
  findSpace(spaceId: string): Promise<LearningBookingRecord | null>
}

export type LearningBookingSnapshot = {
  learningSpaceId: string
  topicId: string | null
  learningMode: LearningModeValue
  objective: string | null
  definitionOfDone: string | null
  fulfillmentStatus: 'NOT_STARTED'
}

export type LearningBookingContext = {
  id: string
  title: string
  state: 'ACTIVE' | 'ARCHIVED'
  objective: string | null
  definitionOfDone: string | null
  topics: Array<{ id: string; label: string }>
}

const requiredText = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new LearningBookingValidationError(`${field} is required`)
  }
  return value.trim()
}

const optionalText = (value: unknown, field: string): string | null | undefined => {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') throw new LearningBookingValidationError(`${field} must be text`)
  const result = value.trim()
  return result || null
}

function assertPairMembership(
  space: LearningBookingRecord,
  actorId: string,
  mentorId: string,
  menteeId: string,
): void {
  const activeMemberIds = new Set(
    space.members.filter((member) => member.status === 'ACTIVE').map((member) => member.userId),
  )
  if (
    actorId !== menteeId
    || mentorId === menteeId
    || !activeMemberIds.has(actorId)
    || !activeMemberIds.has(mentorId)
    || !activeMemberIds.has(menteeId)
  ) {
    // Use one privacy-safe result for missing, inactive, third-party, and
    // mismatched-pair spaces so a caller cannot enumerate private membership.
    throw new LearningBookingAuthorizationError('Learning space is unavailable for this booking')
  }
}

export async function loadLearningBookingContext(
  repository: LearningBookingRepository,
  input: { learningSpaceId: string; actorId: string; mentorId: string },
): Promise<LearningBookingContext> {
  const learningSpaceId = requiredText(input.learningSpaceId, 'learningSpaceId')
  if (!await repository.isActiveMember(learningSpaceId, input.actorId)) {
    throw new LearningBookingAuthorizationError('Learning space is unavailable for this booking')
  }
  const space = await repository.findSpace(learningSpaceId)
  if (!space) throw new LearningBookingAuthorizationError('Learning space is unavailable for this booking')
  assertPairMembership(space, input.actorId, input.mentorId, input.actorId)
  return {
    id: space.id,
    title: space.title,
    state: space.state,
    objective: space.objective,
    definitionOfDone: space.definitionOfDone,
    topics: space.topics
      .filter((topic) => topic.state === 'ACTIVE')
      .map(({ id, label }) => ({ id, label })),
  }
}

export async function prepareLearningBookingSnapshot(
  repository: LearningBookingRepository,
  params: {
    actorId: string
    mentorId: string
    menteeId: string
    startTime: Date
    endTime: Date
    selection?: LearningBookingSelectionInput | null
  },
): Promise<LearningBookingSnapshot | Record<string, never>> {
  const { selection } = params
  if (selection == null) return {}

  const learningSpaceId = requiredText(selection.learningSpaceId, 'learningSpaceId')
  if (!isLearningMode(selection.learningMode)) {
    throw new LearningBookingValidationError('learningMode must be LIVE, EXERCISE_REVIEW, or HYBRID')
  }
  if (!(params.startTime instanceof Date) || !(params.endTime instanceof Date) || params.endTime <= params.startTime) {
    throw new LearningBookingValidationError('A linked booking needs a valid scheduled time')
  }

  await repository.lockSpace(learningSpaceId)
  if (!await repository.isActiveMember(learningSpaceId, params.actorId)) {
    throw new LearningBookingAuthorizationError('Learning space is unavailable for this booking')
  }
  const space = await repository.findSpace(learningSpaceId)
  if (!space) throw new LearningBookingAuthorizationError('Learning space is unavailable for this booking')
  assertPairMembership(space, params.actorId, params.mentorId, params.menteeId)

  const topicId = optionalText(selection.topicId, 'topicId') ?? null
  if (topicId && !space.topics.some((topic) => topic.id === topicId && topic.state === 'ACTIVE')) {
    throw new LearningBookingValidationError('topicId must reference an active topic in the learning space')
  }

  const objective = optionalText(selection.objective, 'objective')
  const definitionOfDone = optionalText(selection.definitionOfDone, 'definitionOfDone')
  const objectiveSnapshot = objective === undefined ? space.objective : objective
  const definitionSnapshot = definitionOfDone === undefined
    ? space.definitionOfDone
    : definitionOfDone

  if (selection.learningMode === 'LIVE' && !objectiveSnapshot?.trim()) {
    throw new LearningBookingValidationError('LIVE requires an objective')
  }

  return {
    learningSpaceId,
    topicId,
    learningMode: selection.learningMode,
    objective: objectiveSnapshot?.trim() || null,
    definitionOfDone: definitionSnapshot?.trim() || null,
    fulfillmentStatus: 'NOT_STARTED',
  }
}
