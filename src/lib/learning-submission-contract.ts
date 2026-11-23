export type SubmissionRequirements = {
  title: string
  description: string | null
  acceptanceCriteria: string | null
  dueAt: string | null
  topicId: string | null
}

export type SubmissionFreshness = {
  requirements: SubmissionRequirements
  previousSubmission: { submissionId: string; revisionCount: number } | null
}

export type SubmissionConflictCode = 'TASK_REQUIREMENTS_CHANGED' | 'STALE_SUBMISSION_REVISION'
