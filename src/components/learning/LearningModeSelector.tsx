'use client'

import {
  LEARNING_MODE_CONTRACTS,
  LEARNING_MODES,
  type LearningArtifactRequirement,
  type LearningModeValue,
} from '@/lib/learning-mode-contracts'

const ARTIFACT_LABELS: Record<LearningArtifactRequirement, string> = {
  OBJECTIVE: 'Mục tiêu',
  SCHEDULED_BOOKING: 'Lịch booking',
  MEETING_LINK: 'Liên kết Meet',
  RECAP: 'Phần tóm tắt',
  TASK: 'Bài tập',
  SUBMISSION: 'Bài nộp',
  FEEDBACK: 'Phản hồi',
  PREWORK_ARTIFACT: 'Tài liệu chuẩn bị',
  ACKNOWLEDGEMENT_OR_QUESTIONS: 'Xác nhận hoặc câu hỏi',
}

export function LearningModeSelector({
  value,
  onChange,
}: {
  value: LearningModeValue
  onChange(mode: LearningModeValue): void
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-gray-900">Hình thức học *</legend>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {LEARNING_MODES.map((mode) => {
          const contract = LEARNING_MODE_CONTRACTS[mode]
          const selected = value === mode
          return (
            <label
              key={mode}
              className={`cursor-pointer rounded-xl border p-4 transition focus-within:ring-2 focus-within:ring-purple-600 ${selected ? 'border-purple-600 bg-purple-50' : 'border-gray-200 bg-white hover:border-purple-300'}`}
            >
              <input
                type="radio"
                name="learningMode"
                value={mode}
                checked={selected}
                onChange={() => onChange(mode)}
                className="sr-only"
              />
              <span className="block font-semibold text-gray-950">{contract.label}</span>
              <span className="mt-1 block text-xs leading-5 text-gray-600">{contract.summary}</span>
              <span className="mt-3 block text-xs font-medium text-purple-800">
                {contract.requiredArtifacts.map((artifact) => ARTIFACT_LABELS[artifact]).join(' · ')}
              </span>
            </label>
          )
        })}
      </div>
      {value === 'EXERCISE_REVIEW' && (
        <p className="mt-3 text-xs leading-5 text-gray-600">
          Thời gian đánh giá bắt đầu từ lúc giao phản hồi (deliveredAt), không tính từ giờ kết thúc Meet.
        </p>
      )}
      {value === 'HYBRID' && (
        <p className="mt-3 text-xs leading-5 text-gray-600">
          Hạn prework, lúc giao kết quả và cửa sổ đánh giá độc lập với giờ kết thúc Meet.
        </p>
      )}
    </fieldset>
  )
}
