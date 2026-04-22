'use client'

import { useUser } from '@/contexts/UserContext'
import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  ArrowLeft,
  RefreshCw,
  BookOpen,
  Gift,
  Settings,
} from 'lucide-react'
import { getUserTransactions, getTransactionSummary } from '@/actions/transactions'
import { POINTS_TO_VND_RATE } from '@/lib/constants'
import TopupModal from '@/components/wallet/TopupModal'
import CashoutModal from '@/components/wallet/CashoutModal'

// ── Types ──────────────────────────────────────────────────────────────────────

type TransactionRow = Awaited<ReturnType<typeof getUserTransactions>>[number]

// ── Helpers ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  BOOKING_CREATED:         { label: 'Session Booked',          icon: <BookOpen className="w-4 h-4" />,       color: 'text-blue-600 bg-blue-50'     },
  BOOKING_COMPLETED:       { label: 'Session Completed',        icon: <CheckCircle2 className="w-4 h-4" />,   color: 'text-emerald-600 bg-emerald-50' },
  BOOKING_CANCELLED:       { label: 'Session Cancelled',        icon: <XCircle className="w-4 h-4" />,        color: 'text-gray-500 bg-gray-100'    },
  BOOKING_DECLINED:        { label: 'Session Declined',         icon: <XCircle className="w-4 h-4" />,        color: 'text-red-500 bg-red-50'       },
  INITIAL_BONUS:           { label: 'Welcome Bonus',            icon: <Gift className="w-4 h-4" />,           color: 'text-purple-600 bg-purple-50' },
  ADMIN_ADJUSTMENT:        { label: 'Admin Adjustment',         icon: <Settings className="w-4 h-4" />,       color: 'text-gray-600 bg-gray-100'    },
  CANCELLATION_COMPENSATION: { label: 'Cancellation Refund',   icon: <RefreshCw className="w-4 h-4" />,      color: 'text-teal-600 bg-teal-50'     },
  TOPUP:                   { label: 'Top Up',                   icon: <ArrowUpCircle className="w-4 h-4" />,  color: 'text-purple-600 bg-purple-50' },
  CASHOUT:                 { label: 'Cash Out',                 icon: <ArrowDownCircle className="w-4 h-4" />,color: 'text-orange-600 bg-orange-50' },
}

function getTypeMeta(type: string) {
  return TYPE_META[type] ?? {
    label: type.replace(/_/g, ' '),
    icon: <Zap className="w-4 h-4" />,
    color: 'text-gray-500 bg-gray-100',
  }
}

function formatDate(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatTime(date: Date | string) {
  const d = new Date(date)
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function getCounterpartyName(tx: TransactionRow, userId: string): string | null {
  if (!tx.booking) return null
  const { mentor, mentee } = tx.booking
  if (mentor && mentor.id !== userId) return mentor.name ?? mentor.email
  if (mentee && mentee.id !== userId) return mentee.name ?? mentee.email
  return null
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'SUCCESS') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
        <CheckCircle2 className="w-3 h-3" />
        Success
      </span>
    )
  }
  if (status === 'PENDING') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
      <XCircle className="w-3 h-3" />
      Failed
    </span>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function WalletPage() {
  const { currentUser, isLoading: userLoading, refreshUser } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [summary, setSummary] = useState({ totalEarned: 0, totalSpent: 0, bookingsCreated: 0 })
  const [isDataLoading, setIsDataLoading] = useState(true)
  const [isTopupOpen, setIsTopupOpen] = useState(false)
  const [isCashoutOpen, setIsCashoutOpen] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 5000)
  }

  const loadData = useCallback(async (userId: string) => {
    setIsDataLoading(true)
    try {
      const [txs, sum] = await Promise.all([
        getUserTransactions(userId),
        getTransactionSummary(userId),
      ])
      setTransactions(txs)
      setSummary(sum)
    } finally {
      setIsDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentUser) loadData(currentUser.id)
  }, [currentUser, loadData])

  // Handle VNPay return params: ?status=success  or  ?error=invalid_signature|payment_failed
  useEffect(() => {
    const status = searchParams.get('status')
    const error  = searchParams.get('error')
    if (!status && !error) return

    if (status === 'success') {
      showToast('Top-up successful! Your GivePoints balance has been updated.')
      if (currentUser) {
        refreshUser()
        loadData(currentUser.id)
      }
    } else if (error === 'invalid_signature') {
      showToast('Payment callback could not be verified. Please contact support.', 'error')
    } else {
      showToast('Payment failed or was cancelled. No points were added.', 'error')
    }

    // Strip query params from the URL without a full navigation
    router.replace('/wallet', { scroll: false })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // ── Auth guards ──────────────────────────────────────────────────────────────
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading wallet...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm text-center">
          <Wallet className="w-12 h-12 text-purple-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-gray-800 mb-2">Sign in to view your wallet</h2>
          <p className="text-sm text-gray-500">You need to be logged in to access wallet features.</p>
        </div>
      </div>
    )
  }

  const points = currentUser.givePoints ?? 0
  const vndValue = points * POINTS_TO_VND_RATE

  const handleCashoutSuccess = async () => {
    await refreshUser()
    if (currentUser) loadData(currentUser.id)
    showToast('Withdrawal request submitted. Admin will process within 1–3 business days.')
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* ── Back nav ── */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-purple-600 font-medium mb-6 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          Back
        </button>

        {/* ── Page title ── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900">My Wallet</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage your GivePoints balance and transactions</p>
          </div>
          <button
            onClick={() => loadData(currentUser.id)}
            disabled={isDataLoading}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:text-purple-600 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isDataLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Top row: Balance Card + Stats ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

          {/* Balance Card — 2/3 width */}
          <div className="lg:col-span-2 relative bg-gradient-to-br from-purple-600 via-purple-700 to-blue-700 rounded-2xl p-6 text-white shadow-xl shadow-purple-200 overflow-hidden">
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full" />
            <div className="absolute -bottom-12 -right-4 w-32 h-32 bg-white/5 rounded-full" />

            <div className="relative">
              <div className="flex items-center gap-2.5 mb-6">
                <div className="bg-white/20 p-2 rounded-xl">
                  <Wallet className="w-5 h-5" />
                </div>
                <span className="text-purple-200 text-sm font-semibold uppercase tracking-widest">
                  GivePoints Balance
                </span>
              </div>

              <div className="mb-1">
                <span className="text-6xl font-black tracking-tight">{points.toLocaleString()}</span>
                <span className="text-2xl font-bold text-purple-300 ml-2">pts</span>
              </div>
              <p className="text-purple-200 text-sm mb-8">
                ≈ {vndValue.toLocaleString('vi-VN')} ₫ equivalent
              </p>

              {/* CTA buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setIsTopupOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-700 rounded-xl text-sm font-bold hover:bg-purple-50 transition-colors shadow-sm"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  Top Up (Nạp điểm)
                </button>
                <button
                  onClick={() => setIsCashoutOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white/15 border border-white/30 text-white rounded-xl text-sm font-bold hover:bg-white/25 transition-colors"
                >
                  <ArrowDownCircle className="w-4 h-4" />
                  Cash Out (Rút tiền)
                </button>
              </div>
            </div>
          </div>

          {/* Stats column — 1/3 width */}
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
              <div className="bg-emerald-100 p-3 rounded-xl">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Earned</p>
                <p className="text-xl font-extrabold text-gray-800">+{summary.totalEarned.toLocaleString()} pts</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
              <div className="bg-red-100 p-3 rounded-xl">
                <TrendingDown className="w-5 h-5 text-red-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Spent</p>
                <p className="text-xl font-extrabold text-gray-800">−{summary.totalSpent.toLocaleString()} pts</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <BookOpen className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sessions</p>
                <p className="text-xl font-extrabold text-gray-800">{summary.bookingsCreated}</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Transaction History ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-gray-900">Transaction History</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
              </p>
            </div>
          </div>

          {isDataLoading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
              <span className="text-sm font-medium">Loading transactions...</span>
            </div>
          ) : transactions.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-gray-400">
              <Wallet className="w-10 h-10 text-gray-300" />
              <p className="text-sm font-medium">No transactions yet</p>
              <p className="text-xs text-gray-400">Top up your wallet to get started</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Date & Time
                      </th>
                      <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Description
                      </th>
                      <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Amount
                      </th>
                      <th className="px-6 py-3.5 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {transactions.map((tx) => {
                      const meta = getTypeMeta(tx.type)
                      const counterparty = getCounterpartyName(tx, currentUser.id)
                      const isCredit = tx.amount > 0
                      return (
                        <tr key={tx.id} className="hover:bg-gray-50/60 transition-colors">
                          {/* Date */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-semibold text-gray-700">{formatDate(tx.createdAt)}</div>
                            <div className="text-xs text-gray-400">{formatTime(tx.createdAt)}</div>
                          </td>

                          {/* Description */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <span className={`inline-flex p-1.5 rounded-lg flex-shrink-0 ${meta.color}`}>
                                {meta.icon}
                              </span>
                              <div>
                                <div className="font-semibold text-gray-800">{meta.label}</div>
                                {counterparty && (
                                  <div className="text-xs text-gray-400 mt-0.5">with {counterparty}</div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <span
                              className={`text-base font-extrabold ${
                                isCredit ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            >
                              {isCredit ? '+' : ''}{tx.amount.toLocaleString()} pts
                            </span>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {(Math.abs(tx.amount) * POINTS_TO_VND_RATE).toLocaleString('vi-VN')} ₫
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-6 py-4 text-center">
                            <StatusBadge status={tx.status} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile card list */}
              <div className="sm:hidden divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const meta = getTypeMeta(tx.type)
                  const counterparty = getCounterpartyName(tx, currentUser.id)
                  const isCredit = tx.amount > 0
                  return (
                    <div key={tx.id} className="p-4 flex items-center gap-3">
                      <span className={`inline-flex p-2 rounded-xl flex-shrink-0 ${meta.color}`}>
                        {meta.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-gray-800 text-sm truncate">{meta.label}</div>
                        {counterparty && (
                          <div className="text-xs text-gray-400 truncate">with {counterparty}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          {formatDate(tx.createdAt)} · {formatTime(tx.createdAt)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-sm font-extrabold ${isCredit ? 'text-emerald-600' : 'text-red-500'}`}>
                          {isCredit ? '+' : ''}{tx.amount.toLocaleString()} pts
                        </span>
                        <StatusBadge status={tx.status} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </main>

      {/* ── Modals ── */}
      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        userId={currentUser.id}
        currentPoints={points}
      />
      <CashoutModal
        isOpen={isCashoutOpen}
        onClose={() => setIsCashoutOpen(false)}
        userId={currentUser.id}
        currentPoints={points}
        onSuccess={handleCashoutSuccess}
      />

      {/* ── Global toast ── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-40 max-w-sm px-5 py-3.5 rounded-xl shadow-xl text-sm font-semibold animate-slide-in ${
            toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
