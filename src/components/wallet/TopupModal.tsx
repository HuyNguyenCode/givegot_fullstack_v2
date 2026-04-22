'use client'

import { useState } from 'react'
import { X, Wallet, CheckCircle, Zap } from 'lucide-react'
import { POINTS_TO_VND_RATE } from '@/lib/constants'

interface TopupModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  currentPoints: number
}

interface Package {
  points: number
  label: string
  badge: string | null
  highlight: boolean
}

const TOPUP_PACKAGES: Package[] = [
  { points: 1,  label: 'Starter',   badge: null,            highlight: false },
  { points: 5,  label: 'Basic',     badge: null,            highlight: false },
  { points: 10, label: 'Popular',   badge: '🔥 Popular',    highlight: true  },
  { points: 20, label: 'Best Value',badge: '💎 Best Value', highlight: false },
]

export default function TopupModal({ isOpen, onClose, userId, currentPoints }: TopupModalProps) {
  const [selected, setSelected] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  if (!isOpen) return null

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const handleConfirm = async () => {
    if (selected === null) {
      showToast('Please select a package first.', 'error')
      return
    }

    setIsLoading(true)
    try {
      const amountVND = selected * POINTS_TO_VND_RATE

      const res = await fetch('/api/vnpay/create-payment', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userId, amountVND, pointsToAdd: selected }),
      })

      const data = await res.json()

      if (!res.ok || !data.paymentUrl) {
        showToast(data.error ?? 'Failed to create payment. Please try again.', 'error')
        return
      }

      showToast('Redirecting to VNPay...')
      // Hand off to VNPay checkout — user leaves this page
      window.location.href = data.paymentUrl
    } catch {
      showToast('Network error. Please check your connection and try again.', 'error')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-fade-in overflow-hidden">
        {/* Gradient header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2.5 rounded-xl">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Top Up GivePoints</h2>
                <p className="text-purple-200 text-sm">Nạp điểm vào ví của bạn</p>
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

        <div className="p-6">
          {/* Current balance pill */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-3.5 mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-purple-700 font-medium">
              <Zap className="w-4 h-4" />
              Current Balance
            </div>
            <span className="text-base font-bold text-purple-800">{currentPoints} pts</span>
          </div>

          {/* Rate badge */}
          <p className="text-xs text-gray-400 text-center mb-4">
            1 GivePoint = {POINTS_TO_VND_RATE.toLocaleString('vi-VN')} ₫
          </p>

          {/* Package grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {TOPUP_PACKAGES.map((pkg) => {
              const vnd = pkg.points * POINTS_TO_VND_RATE
              const isSelected = selected === pkg.points
              return (
                <button
                  key={pkg.points}
                  onClick={() => setSelected(pkg.points)}
                  className={`relative border-2 rounded-xl p-4 text-left transition-all duration-150 ${
                    isSelected
                      ? 'border-purple-600 bg-purple-50 shadow-md shadow-purple-100'
                      : pkg.highlight
                      ? 'border-amber-300 bg-amber-50 hover:border-amber-400'
                      : 'border-gray-200 hover:border-purple-300 hover:bg-gray-50'
                  }`}
                >
                  {pkg.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-amber-400 text-amber-900 font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
                      {pkg.badge}
                    </span>
                  )}
                  {isSelected && (
                    <CheckCircle className="absolute top-2 right-2 w-4 h-4 text-purple-600" />
                  )}
                  <span className={`block text-2xl font-extrabold leading-none mb-1 ${isSelected ? 'text-purple-700' : 'text-gray-800'}`}>
                    {pkg.points}
                    <span className="text-sm font-semibold ml-1">pts</span>
                  </span>
                  <span className={`block text-sm font-semibold ${isSelected ? 'text-purple-600' : 'text-gray-600'}`}>
                    {vnd.toLocaleString('vi-VN')} ₫
                  </span>
                  <span className={`block text-xs mt-0.5 ${isSelected ? 'text-purple-400' : 'text-gray-400'}`}>
                    {pkg.label}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected === null || isLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl text-sm font-bold text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Redirecting...
                </span>
              ) : selected !== null ? (
                `Pay ${(selected * POINTS_TO_VND_RATE).toLocaleString('vi-VN')} ₫`
              ) : (
                'Select a Package'
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
