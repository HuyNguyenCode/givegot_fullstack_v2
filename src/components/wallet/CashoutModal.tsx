'use client'

import { useState } from 'react'
import { X, ArrowDownCircle, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createWithdrawRequest } from '@/actions/wallet'
import { POINTS_TO_VND_RATE } from '@/lib/constants'

interface CashoutModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentPoints: number
  onSuccess: () => void
}

export default function CashoutModal({
  isOpen,
  onClose,
  userId,
  currentPoints,
  onSuccess,
}: CashoutModalProps) {
  const [points, setPoints] = useState('')
  const [bankDetails, setBankDetails] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ points?: string; bank?: string }>({})

  if (!isOpen) return null

  const pointsNum = parseInt(points) || 0
  const vndAmount = pointsNum * POINTS_TO_VND_RATE
  const isValidAmount = pointsNum > 0 && pointsNum <= currentPoints

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const validate = () => {
    const errors: { points?: string; bank?: string } = {}
    if (!pointsNum || pointsNum <= 0) {
      errors.points = 'Enter a valid number of points.'
    } else if (pointsNum > currentPoints) {
      errors.points = `Insufficient balance. You only have ${currentPoints} pts.`
    }
    if (!bankDetails.trim()) {
      errors.bank = 'Bank details are required.'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setIsLoading(true)
    try {
      const result = await createWithdrawRequest(userId, pointsNum, bankDetails)
      if (result.success) {
        showToast('Withdrawal request submitted successfully!')
        setTimeout(() => {
          onSuccess()
          onClose()
          setPoints('')
          setBankDetails('')
        }, 2000)
      } else {
        showToast(result.message, 'error')
      }
    } catch {
      showToast('An unexpected error occurred. Please try again.', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePointsChange = (val: string) => {
    setPoints(val)
    if (fieldErrors.points) setFieldErrors((e) => ({ ...e, points: undefined }))
  }

  const handleBankChange = (val: string) => {
    setBankDetails(val)
    if (fieldErrors.bank) setFieldErrors((e) => ({ ...e, bank: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl">
                <ArrowDownCircle className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Cash Out (Rút tiền)</h2>
                <p className="text-emerald-100 text-sm">Chuyển GivePoints thành VND</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Available balance */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Available Balance
            </div>
            <span className="text-base font-bold text-emerald-800">{currentPoints} pts</span>
          </div>

          {/* Rate info */}
          <p className="text-xs text-gray-400 text-center">
            1 GivePoint = {POINTS_TO_VND_RATE.toLocaleString('vi-VN')} ₫
          </p>

          {/* Points input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Points to Withdraw
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                max={currentPoints}
                value={points}
                onChange={(e) => handlePointsChange(e.target.value)}
                placeholder={`Max ${currentPoints} pts`}
                className={`w-full border rounded-xl px-4 py-3 text-sm pr-12 focus:outline-none focus:ring-2 transition-colors ${
                  fieldErrors.points
                    ? 'border-red-300 focus:ring-red-200'
                    : 'border-gray-200 focus:ring-purple-200 focus:border-purple-400'
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                pts
              </span>
            </div>
            {fieldErrors.points && (
              <p className="text-xs text-red-500 mt-1.5">{fieldErrors.points}</p>
            )}
            {isValidAmount && (
              <p className="text-xs text-emerald-600 mt-1.5 font-medium">
                You will receive ≈ {vndAmount.toLocaleString('vi-VN')} ₫
              </p>
            )}
          </div>

          {/* Bank details */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Bank Account Details
            </label>
            <textarea
              value={bankDetails}
              onChange={(e) => handleBankChange(e.target.value)}
              placeholder="e.g. Vietcombank – 0123456789 – Nguyen Van A"
              rows={3}
              className={`w-full border rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 transition-colors ${
                fieldErrors.bank
                  ? 'border-red-300 focus:ring-red-200'
                  : 'border-gray-200 focus:ring-purple-200 focus:border-purple-400'
              }`}
            />
            {fieldErrors.bank && (
              <p className="text-xs text-red-500 mt-1.5">{fieldErrors.bank}</p>
            )}
          </div>

          {/* Warning banner */}
          <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3.5">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              Points are deducted immediately. Bank transfer will be processed by an admin within{' '}
              <strong>1–3 business days</strong>.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-sm font-bold text-white hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Submitting...
                </span>
              ) : (
                'Confirm Withdrawal'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-slide-in ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
