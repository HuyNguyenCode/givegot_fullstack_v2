export const LEARNING_MODES = ['LIVE', 'EXERCISE_REVIEW', 'HYBRID'] as const

export type LearningModeValue = (typeof LEARNING_MODES)[number]

export type LearningArtifactRequirement =
  | 'OBJECTIVE'
  | 'SCHEDULED_BOOKING'
  | 'MEETING_LINK'
  | 'RECAP'
  | 'TASK'
  | 'SUBMISSION'
  | 'FEEDBACK'
  | 'PREWORK_ARTIFACT'
  | 'ACKNOWLEDGEMENT_OR_QUESTIONS'

export type LearningTimingBasis = 'BOOKING_END' | 'DELIVERED_AT'

export type LearningModeContract = {
  mode: LearningModeValue
  label: string
  summary: string
  requiredArtifacts: readonly LearningArtifactRequirement[]
  timingBasis: LearningTimingBasis
  reviewWindowAnchor: 'NONE' | 'DELIVERED_AT'
  preworkDeadlineAnchor: 'NONE' | 'PREWORK_ARTIFACT_DUE_AT'
  requiresLearnerAcceptance: boolean
  permitsReviewWindowExpiry: boolean
  meetingEndAloneCompletes: false
}

export const LEARNING_MODE_CONTRACTS: Readonly<Record<LearningModeValue, LearningModeContract>> = {
  LIVE: {
    mode: 'LIVE',
    label: 'Học trực tiếp',
    summary: 'Mục tiêu, lịch học, liên kết Meet và phần tóm tắt sau buổi học.',
    requiredArtifacts: ['OBJECTIVE', 'SCHEDULED_BOOKING', 'MEETING_LINK', 'RECAP'],
    timingBasis: 'BOOKING_END',
    reviewWindowAnchor: 'NONE',
    preworkDeadlineAnchor: 'NONE',
    requiresLearnerAcceptance: true,
    permitsReviewWindowExpiry: false,
    meetingEndAloneCompletes: false,
  },
  EXERCISE_REVIEW: {
    mode: 'EXERCISE_REVIEW',
    label: 'Bài tập và nhận xét',
    summary: 'Bài tập, bài nộp và phản hồi; thời hạn đánh giá bắt đầu từ lúc giao phản hồi.',
    requiredArtifacts: ['TASK', 'SUBMISSION', 'FEEDBACK'],
    timingBasis: 'DELIVERED_AT',
    reviewWindowAnchor: 'DELIVERED_AT',
    preworkDeadlineAnchor: 'NONE',
    requiresLearnerAcceptance: false,
    permitsReviewWindowExpiry: true,
    meetingEndAloneCompletes: false,
  },
  HYBRID: {
    mode: 'HYBRID',
    label: 'Kết hợp',
    summary: 'Bài chuẩn bị, xác nhận hoặc câu hỏi, lịch Meet và phần tóm tắt.',
    requiredArtifacts: [
      'PREWORK_ARTIFACT',
      'ACKNOWLEDGEMENT_OR_QUESTIONS',
      'SCHEDULED_BOOKING',
      'MEETING_LINK',
      'RECAP',
    ],
    timingBasis: 'DELIVERED_AT',
    reviewWindowAnchor: 'DELIVERED_AT',
    preworkDeadlineAnchor: 'PREWORK_ARTIFACT_DUE_AT',
    requiresLearnerAcceptance: true,
    permitsReviewWindowExpiry: false,
    meetingEndAloneCompletes: false,
  },
}

export type LearningModeEvidence = {
  objective?: string | null
  scheduledStart?: Date | null
  scheduledEnd?: Date | null
  meetingUrl?: string | null
  recapCompleted?: boolean
  taskCompleted?: boolean
  submissionCompleted?: boolean
  feedbackCompleted?: boolean
  preworkCompleted?: boolean
  acknowledgementOrQuestionsCompleted?: boolean
  deliveredAt?: Date | null
  learnerAccepted?: boolean
  reviewWindowEndsAt?: Date | null
  disputed?: boolean
}

export type LearningModeCompletionReadiness = {
  mode: LearningModeValue | null
  legacy: boolean
  eligible: boolean
  missingArtifacts: LearningArtifactRequirement[]
  blockedBy: Array<'NOT_DELIVERED' | 'LEARNER_ACCEPTANCE' | 'REVIEW_WINDOW' | 'DISPUTE'>
  timingBasis: LearningTimingBasis | 'LEGACY_BOOKING_POLICY'
}

const present = (value: string | null | undefined) => Boolean(value?.trim())

function missingArtifacts(
  contract: LearningModeContract,
  evidence: LearningModeEvidence,
): LearningArtifactRequirement[] {
  const available: Record<LearningArtifactRequirement, boolean> = {
    OBJECTIVE: present(evidence.objective),
    SCHEDULED_BOOKING: Boolean(
      evidence.scheduledStart
      && evidence.scheduledEnd
      && evidence.scheduledEnd > evidence.scheduledStart,
    ),
    MEETING_LINK: present(evidence.meetingUrl),
    RECAP: evidence.recapCompleted === true,
    TASK: evidence.taskCompleted === true,
    SUBMISSION: evidence.submissionCompleted === true,
    FEEDBACK: evidence.feedbackCompleted === true,
    PREWORK_ARTIFACT: evidence.preworkCompleted === true,
    ACKNOWLEDGEMENT_OR_QUESTIONS: evidence.acknowledgementOrQuestionsCompleted === true,
  }

  return contract.requiredArtifacts.filter((requirement) => !available[requirement])
}

/**
 * Evaluates workflow evidence only. It never releases GivePoints, changes a
 * Booking status, or decides a settlement amount.
 */
export function evaluateLearningModeCompletion(
  mode: LearningModeValue | null | undefined,
  evidence: LearningModeEvidence,
  now = new Date(),
): LearningModeCompletionReadiness {
  if (mode == null) {
    return {
      mode: null,
      legacy: true,
      eligible: false,
      missingArtifacts: [],
      blockedBy: [],
      timingBasis: 'LEGACY_BOOKING_POLICY',
    }
  }

  const contract = LEARNING_MODE_CONTRACTS[mode]
  const missing = missingArtifacts(contract, evidence)
  const blockedBy: LearningModeCompletionReadiness['blockedBy'] = []

  if (evidence.disputed) blockedBy.push('DISPUTE')

  if (mode === 'LIVE') {
    if (!evidence.scheduledEnd || evidence.scheduledEnd > now) blockedBy.push('NOT_DELIVERED')
    if (!evidence.learnerAccepted) blockedBy.push('LEARNER_ACCEPTANCE')
  } else {
    if (!evidence.deliveredAt) blockedBy.push('NOT_DELIVERED')

    if (contract.requiresLearnerAcceptance && !evidence.learnerAccepted) {
      blockedBy.push('LEARNER_ACCEPTANCE')
    }

    if (contract.permitsReviewWindowExpiry && !evidence.learnerAccepted) {
      if (!evidence.reviewWindowEndsAt || evidence.reviewWindowEndsAt > now) {
        blockedBy.push('REVIEW_WINDOW')
      }
    }
  }

  return {
    mode,
    legacy: false,
    eligible: missing.length === 0 && blockedBy.length === 0,
    missingArtifacts: missing,
    blockedBy,
    timingBasis: contract.timingBasis,
  }
}

export function isLearningMode(value: unknown): value is LearningModeValue {
  return typeof value === 'string' && LEARNING_MODES.includes(value as LearningModeValue)
}

export function assertLearningModeChangeAllowed(
  currentMode: LearningModeValue,
  nextMode: LearningModeValue,
  fulfillmentStatus: string | null | undefined,
): void {
  if (currentMode === nextMode) return
  if (!fulfillmentStatus || ['NOT_STARTED', 'IN_PROGRESS'].includes(fulfillmentStatus)) return
  throw new Error('Learning mode cannot change after delivery')
}
