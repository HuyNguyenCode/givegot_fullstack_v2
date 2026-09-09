'use client'

import { useState } from 'react'
import CancellationImpactDialog from '@/components/CancellationImpactDialog'
import { BookingWithDetails } from '@/types'

interface Props {
  booking: BookingWithDetails
  userId: string
  onSuccess: () => void | Promise<void>
}

/** Dashboard trigger kept for backwards-compatible callers. */
export default function CancelBookingDialog({ booking, userId, onSuccess }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-white border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 hover:border-red-400 transition text-sm"
      >
        Hủy lịch đặt
      </button>
      <CancellationImpactDialog
        open={isOpen}
        bookingId={booking.id}
        userId={userId}
        onClose={() => setIsOpen(false)}
        onMutate={onSuccess}
      />
    </>
  )
}
