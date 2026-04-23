'use client'

import { useState } from 'react'
import { cancelBooking } from '@/actions/booking'
import { BookingWithDetails } from '@/types'

interface Props {
  booking: BookingWithDetails
  userId: string
  onSuccess: () => void
}

export default function CancelBookingDialog({ booking, userId, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const hoursUntilStart =
    (new Date(booking.startTime).getTime() - Date.now()) / (1000 * 60 * 60)
  const isLateCancel = hoursUntilStart < 12

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 4500)
  }

  const handleConfirm = async () => {
    setIsLoading(true)
    const result = await cancelBooking(booking.id, userId)
    setIsLoading(false)

    if (result.success) {
      setIsOpen(false)
      showToast('success', result.message)
      onSuccess()
    } else {
      showToast('error', result.message)
    }
  }

  return (
    <>
      {/* ── Inline toast ─────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-[200] flex items-center gap-2 px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* ── Trigger button ────────────────────────────────────────────── */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 hover:border-red-400 transition text-sm"
      >
        Cancel Booking
      </button>

      {/* ── Confirmation modal ────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false)
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="bg-red-100 p-2.5 rounded-full shrink-0">
                <svg
                  className="w-6 h-6 text-red-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Xác nhận hủy lịch</h3>
                <p className="text-sm text-gray-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            {/* Trust Score warning */}
            <div
              className={`rounded-xl p-4 mb-5 border ${
                isLateCancel
                  ? 'bg-red-50 border-red-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  isLateCancel ? 'text-red-800' : 'text-yellow-800'
                }`}
              >
                ⚠️ Cảnh báo:{' '}
                {isLateCancel
                  ? 'Hủy sát giờ! Bạn sẽ bị trừ 20 điểm Trust Score.'
                  : 'Bạn sẽ bị trừ 5 điểm Trust Score.'}
              </p>
              <p
                className={`text-xs mt-1.5 ${
                  isLateCancel ? 'text-red-700' : 'text-yellow-700'
                }`}
              >
                {isLateCancel
                  ? 'Còn dưới 12 giờ trước buổi học — hủy muộn áp dụng mức phạt cao hơn.'
                  : 'Còn hơn 12 giờ trước buổi học — Mentee sẽ được hoàn lại điểm đầy đủ.'}
              </p>
            </div>

            {/* Booking summary */}
            <div className="bg-gray-50 rounded-lg p-3 mb-5 text-sm text-gray-700">
              <p>
                <span className="font-medium">Mentee:</span>{' '}
                {booking.mentee.name ?? booking.mentee.email}
              </p>
              <p className="mt-0.5">
                <span className="font-medium">Thời gian:</span>{' '}
                {new Date(booking.startTime).toLocaleString('vi-VN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                disabled={isLoading}
                className="flex-1 bg-gray-100 text-gray-700 py-2.5 rounded-lg font-semibold hover:bg-gray-200 transition disabled:opacity-50"
              >
                Quay lại
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Đang hủy...
                  </>
                ) : (
                  'Xác nhận hủy'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
