'use client'

import { useState } from 'react'
import {
  reportNoShow,
  type NoShowResult,
  type NoShowVerdict,
} from '@/actions/booking'

interface NoShowImpactDialogProps {
  open: boolean
  bookingId: string | null
  userId: string
  onClose: () => void
  onMutate: () => void | Promise<void>
  onComplete?: () => void
}

const OUTCOMES: Array<{
  verdict: NoShowVerdict
  title: string
  body: string
  color: string
}> = [
  {
    verdict: 'MENTOR_NO_SHOW',
    title: 'Mentor thực sự vắng mặt',
    body: 'Bạn được hoàn 1 GivePoint. Mentor bị trừ 20 Trust Score.',
    color: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  {
    verdict: 'FRAUD_DETECTED',
    title: 'Cả hai đã tham dự nhưng báo sai',
    body: 'Booking được hoàn thành, Mentor nhận 1 GivePoint và bạn bị trừ 30 Trust Score.',
    color: 'border-red-200 bg-red-50 text-red-900',
  },
  {
    verdict: 'DISPUTED',
    title: 'Dữ liệu tham dự không rõ',
    body: 'Booking chuyển sang DISPUTED. GivePoint tiếp tục bị giữ để Admin xem xét.',
    color: 'border-amber-200 bg-amber-50 text-amber-900',
  },
]

function verdictTitle(verdict?: NoShowVerdict) {
  if (verdict === 'MENTOR_NO_SHOW') return 'Đã xác minh Mentor vắng mặt'
  if (verdict === 'FRAUD_DETECTED') return 'Đã phát hiện báo cáo không chính xác'
  return 'Đã chuyển Admin xem xét'
}

function verdictMessage(result: NoShowResult) {
  if (result.verdict === 'MENTOR_NO_SHOW') {
    return 'Báo cáo đã được xác minh: Mentor vắng mặt. Bạn được hoàn 1 GivePoint và Mentor bị trừ 20 Trust Score.'
  }
  if (result.verdict === 'FRAUD_DETECTED') {
    return 'Dữ liệu cho thấy cả hai đã tham dự. Booking được hoàn thành, Mentor nhận 1 GivePoint và bạn bị trừ 30 Trust Score.'
  }
  if (result.verdict === 'DISPUTED') {
    return 'Dữ liệu chưa đủ rõ. Booking đã chuyển sang DISPUTED; GivePoint tiếp tục bị giữ để Admin xem xét.'
  }
  return result.message
}

export default function NoShowImpactDialog({
  open,
  bookingId,
  userId,
  onClose,
  onMutate,
  onComplete,
}: NoShowImpactDialogProps) {
  const [result, setResult] = useState<NoShowResult | null>(null)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async () => {
    if (!bookingId) return
    setError('')
    setIsSubmitting(true)
    try {
      const response = await reportNoShow(bookingId, userId)
      if (!response.success) {
        setError(response.message)
        return
      }
      setResult(response)
    } catch {
      setError('Không thể gửi báo cáo. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const close = () => {
    if (isSubmitting) return
    const didComplete = Boolean(result)
    onClose()
    setResult(null)
    setError('')
    if (didComplete) {
      void Promise.resolve(onMutate()).catch(refreshError => {
        console.error('[NoShowImpactDialog] Refresh after result failed:', refreshError)
      })
      onComplete?.()
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="no-show-impact-title">
      <button type="button" aria-label="Đóng" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={close} disabled={isSubmitting} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className={'px-6 py-5 text-white ' + (result ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-600 to-orange-600')}>
          <h2 id="no-show-impact-title" className="text-xl font-bold">
            {result ? 'Kết quả báo cáo vắng mặt' : 'Xác nhận báo cáo Mentor vắng mặt'}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            {result ? 'Hệ thống đã áp dụng kết quả xác minh.' : 'Hệ thống sẽ đối chiếu dữ liệu tham dự trước khi xử lý.'}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {result ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
              <p className="font-bold">{verdictTitle(result.verdict)}</p>
              <p className="mt-2 text-sm">{verdictMessage(result)}</p>
              {result.bookingId && (
                <p className="mt-3 text-xs font-medium">Mã booking: #{result.bookingId.slice(0, 8).toUpperCase()}</p>
              )}
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                Chỉ gửi báo cáo nếu bạn thực sự có mặt nhưng Mentor không xuất hiện. Kết quả phụ thuộc dữ liệu tham dự của buổi học.
              </div>
              <div className="space-y-3">
                {OUTCOMES.map(outcome => (
                  <div key={outcome.verdict} className={'rounded-xl border p-4 ' + outcome.color}>
                    <p className="font-semibold">{outcome.title}</p>
                    <p className="mt-1 text-sm">{outcome.body}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
          )}

          {result ? (
            <button onClick={close} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700">
              Đóng kết quả
            </button>
          ) : (
            <div className="flex gap-3">
              <button onClick={close} disabled={isSubmitting} className="flex-1 rounded-xl bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50">
                Quay lại
              </button>
              <button onClick={submit} disabled={!bookingId || isSubmitting} className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {isSubmitting ? 'Đang xác minh…' : 'Xác nhận báo cáo'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
