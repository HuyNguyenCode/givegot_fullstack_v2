'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  getBookingCancellationReceipt,
  type CancellationReceipt,
} from '@/actions/booking'

interface CancellationReceiptDetailsProps {
  bookingId: string
  userId: string
}

function PointOutcome({ receipt }: { receipt: CancellationReceipt }) {
  if (receipt.givePointRecipient === 'mentor') {
    return <>1 GivePoint đã được chuyển cho Mentor để bồi thường.</>
  }

  return <>1 GivePoint đã được hoàn lại đầy đủ cho Mentee.</>
}

/**
 * Read-only receipt shown after a user reopens a cancelled item in either the
 * teaching or learning calendar. It never performs a mutation.
 */
export default function CancellationReceiptDetails({
  bookingId,
  userId,
}: CancellationReceiptDetailsProps) {
  const [receipt, setReceipt] = useState<CancellationReceipt | null>(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCurrent = true

    getBookingCancellationReceipt(bookingId, userId)
      .then(result => {
        if (!isCurrent) return
        if (result.success && result.receipt) setReceipt(result.receipt)
        else setError(result.message)
      })
      .catch(() => {
        if (isCurrent) setError('Không thể tải chi tiết hủy. Vui lòng thử lại.')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })

    return () => { isCurrent = false }
  }, [bookingId, userId])

  if (isLoading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        Đang tải chi tiết hủy lịch…
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
        {error}
      </div>
    )
  }

  if (!receipt) return null

  const isDeclined = receipt.outcome === 'DECLINED'
  const isLate = receipt.timing === 'late'
  const timingText = isDeclined
    ? 'Yêu cầu ở trạng thái chờ đã được từ chối; chính sách hoàn 100% được áp dụng.'
    : receipt.timing === 'pending'
      ? 'Lịch được hủy khi còn chờ phản hồi; chính sách hoàn 100% được áp dụng.'
      : isLate
        ? 'Hủy muộn (dưới ' + receipt.thresholdHours + ' giờ trước buổi học).'
        : 'Hủy đúng hạn (từ ' + receipt.thresholdHours + ' giờ trước buổi học).'
  const actorText = isDeclined
    ? null
    : receipt.cancelledBy === 'unknown'
      ? 'Bản ghi lịch sử này không lưu người khởi tạo hủy.'
      : receipt.cancelledBy === 'mentor'
        ? 'Mentor là người hủy lịch.'
        : 'Mentee là người hủy lịch.'

  return (
    <section className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
      <div>
        <p className="font-bold">{isDeclined ? 'Yêu cầu đã được Mentor từ chối' : 'Chi tiết hủy lịch'}</p>
        <p className="mt-1 text-xs text-red-800">{timingText}</p>
        {actorText && <p className="mt-1 text-xs text-red-800">{actorText}</p>}
      </div>

      <div className="rounded-lg border border-red-100 bg-white/80 p-3">
        <p className="font-semibold">GivePoint</p>
        <p className="mt-1"><PointOutcome receipt={receipt} /></p>
      </div>

      {receipt.trust ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-orange-950">
          <p className="font-semibold">Trust Score</p>
          <p className="mt-1">
            {receipt.trust.previousScore} → {receipt.trust.newScore} ({receipt.trust.delta})
          </p>
          {receipt.trust.willSuspend && (
            <p className="mt-1 font-semibold text-red-700">Tài khoản bị đình chỉ vì điểm mới dưới 30.</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
          Trust Score không thay đổi.
        </div>
      )}

      <div className="text-xs text-red-800">
        Mã booking: <span className="font-semibold">#{receipt.bookingId.slice(0, 8).toUpperCase()}</span>
        <Link href="/history" className="ml-2 font-semibold underline hover:text-red-950">
          Xem lịch sử giao dịch →
        </Link>
      </div>
    </section>
  )
}
