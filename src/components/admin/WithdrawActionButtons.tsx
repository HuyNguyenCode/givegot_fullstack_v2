'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { updateWithdrawStatus } from '@/actions/admin-finance'

interface WithdrawActionButtonsProps {
  requestId: string
}

export default function WithdrawActionButtons({ requestId }: WithdrawActionButtonsProps) {
  const [isPending, setIsPending] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleAction = async (newStatus: 'APPROVED' | 'REJECTED') => {
    setIsPending(newStatus)
    try {
      const result = await updateWithdrawStatus(requestId, newStatus)
      if (result.success) {
        showToast(
          newStatus === 'APPROVED' ? 'Request approved.' : 'Request rejected.',
          newStatus === 'APPROVED' ? 'success' : 'error',
        )
        // Page will revalidate automatically via revalidatePath in the action
      } else {
        showToast(result.message, 'error')
      }
    } catch {
      showToast('Unexpected error. Please try again.', 'error')
    } finally {
      setIsPending(null)
    }
  }

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Approve */}
        <button
          onClick={() => handleAction('APPROVED')}
          disabled={isPending !== null}
          title="Approve and mark as transferred"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-lg hover:bg-emerald-100 hover:border-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending === 'APPROVED' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5" />
          )}
          Approve
        </button>

        {/* Reject */}
        <button
          onClick={() => handleAction('REJECTED')}
          disabled={isPending !== null}
          title="Reject this request"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending === 'REJECTED' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <XCircle className="w-3.5 h-3.5" />
          )}
          Reject
        </button>
      </div>

      {/* Inline toast anchored to this row */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-slide-in ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </>
  )
}
