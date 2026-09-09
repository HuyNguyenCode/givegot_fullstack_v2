'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  cancelBooking,
  getCancellationPreview,
  type CancellationImpact,
} from '@/actions/booking'

interface CancellationImpactDialogProps {
  open: boolean
  bookingId: string | null
  userId: string
  onClose: () => void
  /** Refreshes the caller after the user has reviewed the committed receipt. */
  onMutate: () => void | Promise<void>
  /** For callers that should close their parent detail panel after the receipt. */
  onComplete?: () => void
}

function formatRemaining(hours: number) {
  const totalMinutes = Math.max(0, Math.floor(hours * 60))
  const days = Math.floor(totalMinutes / (24 * 60))
  const remainingMinutes = totalMinutes % (24 * 60)
  const remainingHours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60

  if (days > 0) return `${days} ngày ${remainingHours} giờ`
  return `${remainingHours} giờ ${minutes} phút`
}

function PointOutcome({ impact }: { impact: CancellationImpact }) {
  if (impact.givePointRecipient === 'mentor') {
    return (
      <p>
        Bạn mất <strong>1 GivePoint</strong>; Mentor nhận <strong>1 GivePoint bồi thường</strong>.
      </p>
    )
  }

  return impact.cancelledBy === 'mentee' ? (
    <p><strong>1 GivePoint</strong> được hoàn lại đầy đủ vào ví của bạn.</p>
  ) : (
    <p>Mentee được hoàn lại đầy đủ <strong>1 GivePoint</strong> vào ví.</p>
  )
}

export default function CancellationImpactDialog({
  open,
  bookingId,
  userId,
  onClose,
  onMutate,
  onComplete,
}: CancellationImpactDialogProps) {
  const [preview, setPreview] = useState<CancellationImpact | null>(null)
  const [receipt, setReceipt] = useState<CancellationImpact | null>(null)
  const [error, setError] = useState('')
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !bookingId) return

    let isCurrent = true
    setPreview(null)
    setReceipt(null)
    setError('')
    setIsLoadingPreview(true)

    getCancellationPreview(bookingId, userId)
      .then(result => {
        if (!isCurrent) return
        if (result.success && result.preview) setPreview(result.preview)
        else setError(result.message)
      })
      .catch(() => {
        if (isCurrent) setError('Không thể tải chính sách hủy. Vui lòng thử lại.')
      })
      .finally(() => {
        if (isCurrent) setIsLoadingPreview(false)
      })

    return () => { isCurrent = false }
  }, [open, bookingId, userId])

  const handleCancel = async () => {
    if (!bookingId || !preview) return

    setIsSubmitting(true)
    setError('')
    try {
      const result = await cancelBooking(bookingId, userId)
      if (!result.success) {
        setError(result.message)
        return
      }

      setReceipt(result.cancellation ?? preview)
    } catch {
      setError('Đã có lỗi khi hủy lịch. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (isSubmitting) return
    onClose()
    if (receipt) {
      // Keep the receipt mounted until the user closes it. In particular, a
      // Dashboard refresh can otherwise unmount this dialog before a Mentee
      // ever sees the completed cancellation outcome.
      void Promise.resolve(onMutate()).catch(error => {
        console.error('[CancellationImpactDialog] Refresh after receipt failed:', error)
      })
      onComplete?.()
    }
  }

  if (!open) return null

  const impact = receipt ?? preview
  const isReceipt = Boolean(receipt)
  const isLate = impact?.timing === 'late'
  const isPending = impact?.timing === 'pending'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="cancellation-impact-title">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        disabled={isSubmitting}
      />
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className={`px-6 py-5 text-white ${isReceipt ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-600 to-rose-600'}`}>
          <h2 id="cancellation-impact-title" className="text-xl font-bold">
            {isReceipt ? 'Biên nhận hủy lịch' : 'Xác nhận hậu quả hủy lịch'}
          </h2>
          <p className="mt-1 text-sm text-white/85">
            {isReceipt ? 'Thay đổi đã được ghi nhận vào hệ thống.' : 'Thông tin được tính theo trạng thái lịch hiện tại.'}
          </p>
        </div>

        <div className="space-y-4 p-6">
          {isLoadingPreview && (
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              Đang tính hậu quả theo chính sách hủy…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {impact && (
            <>
              <div className={`rounded-xl border p-4 ${isLate ? 'border-red-200 bg-red-50' : isPending ? 'border-blue-200 bg-blue-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className={`font-bold ${isLate ? 'text-red-900' : isPending ? 'text-blue-900' : 'text-amber-900'}`}>
                  {isPending
                    ? 'Yêu cầu đang chờ phản hồi'
                    : isLate
                      ? `Còn ${formatRemaining(impact.hoursUntilStart)} — đây là hủy muộn`
                      : `Còn ${formatRemaining(impact.hoursUntilStart)} — hủy đúng hạn`}
                </p>
                <p className={`mt-1 text-sm ${isLate ? 'text-red-800' : isPending ? 'text-blue-800' : 'text-amber-800'}`}>
                  {isPending
                    ? 'Hủy hoặc Mentor từ chối ở trạng thái này được hoàn 100%; không thay đổi Trust Score.'
                    : `Mốc chính sách là ${impact.thresholdHours} giờ trước buổi học.`}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-800">
                <p className="font-semibold text-slate-950">GivePoint</p>
                <div className="mt-1"><PointOutcome impact={impact} /></div>
              </div>

              {impact.trust ? (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
                  <p className="font-semibold">Trust Score</p>
                  <p className="mt-1">
                    {impact.trust.previousScore} → {impact.trust.newScore} ({impact.trust.delta})
                  </p>
                  {impact.trust.willSuspend && (
                    <p className="mt-2 font-semibold text-red-700">
                      Tài khoản sẽ bị đình chỉ vì điểm mới dưới 30.
                    </p>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Trust Score không thay đổi.
                </div>
              )}

              {isReceipt && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  <p className="font-semibold">Mã booking: #{impact.bookingId.slice(0, 8).toUpperCase()}</p>
                  <p className="mt-1">Điểm và Trust Score (nếu có) đã được ghi vào lịch sử giao dịch.</p>
                  <Link href="/history" className="mt-3 inline-flex font-semibold text-emerald-700 underline hover:text-emerald-900">
                    Xem lịch sử giao dịch →
                  </Link>
                </div>
              )}
            </>
          )}

          <div className="flex gap-3 pt-1">
            {isReceipt ? (
              <button onClick={handleClose} className="w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700">
                Đóng biên nhận
              </button>
            ) : (
              <>
                <button onClick={handleClose} disabled={isSubmitting} className="flex-1 rounded-xl bg-slate-100 py-3 font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50">
                  Quay lại
                </button>
                <button
                  onClick={handleCancel}
                  disabled={!preview || isLoadingPreview || isSubmitting}
                  className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang hủy…' : 'Xác nhận hủy'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
