'use client'

import { useUser } from '@/contexts/UserContext'
import { useEffect, useState } from 'react'
import { getUserTransactions, getUserBookingHistory, getTransactionSummary } from '@/actions/transactions'
import { format } from 'date-fns'
import Image from 'next/image'
import Link from 'next/link'

interface Transaction {
  id: string
  userId: string
  amount: number
  type: string
  bookingId: string | null
  createdAt: Date
  booking?: {
    id: string
    startTime: Date
    status: string
    mentor: {
      id: string
      name: string | null
      email: string
      avatarUrl: string | null
    }
    mentee: {
      id: string
      name: string | null
      email: string
      avatarUrl: string | null
    }
  } | null
}

interface Booking {
  id: string
  mentorId: string
  menteeId: string
  startTime: Date
  endTime: Date
  status: string
  note: string | null
  createdAt: Date
  mentor: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  mentee: {
    id: string
    name: string | null
    email: string
    avatarUrl: string | null
  }
  slot: {
    id: string
    startTime: Date
    endTime: Date
  } | null
  review: {
    id: string
    rating: number
    comment: string | null
  } | null
}

interface Summary {
  totalEarned: number
  totalSpent: number
  bookingsCreated: number
  sessionsCompleted: number
  refundsReceived: number
}

export default function HistoryPage() {
  const { currentUser, refreshUser, isLoading: userLoading } = useUser()
  const [activeTab, setActiveTab] = useState<'bookings' | 'transactions'>('bookings')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [summary, setSummary] = useState<Summary>({
    totalEarned: 0,
    totalSpent: 0,
    bookingsCreated: 0,
    sessionsCompleted: 0,
    refundsReceived: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  const loadData = async () => {
    if (!currentUser) return

    setIsLoading(true)
    await refreshUser()

    const [bookingData, transactionData, summaryData] = await Promise.all([
      getUserBookingHistory(currentUser.id),
      getUserTransactions(currentUser.id),
      getTransactionSummary(currentUser.id),
    ])

    setBookings(bookingData)
    setTransactions(transactionData)
    setSummary(summaryData)
    setIsLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [currentUser?.id])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'CONFIRMED':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'CANCELLED':
        return 'bg-red-100 text-red-800 border-red-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  const getTransactionTypeLabel = (type: string) => {
    switch (type) {
      case 'BOOKING_CREATED':
        return 'Booking Created'
      case 'BOOKING_COMPLETED':
        return 'Session Completed'
      case 'BOOKING_CANCELLED':
        return 'Booking Cancelled'
      case 'BOOKING_DECLINED':
        return 'Booking Declined'
      case 'INITIAL_BONUS':
        return 'Welcome Bonus'
      case 'ADMIN_ADJUSTMENT':
        return 'Admin Adjustment'
      default:
        return type
    }
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'BOOKING_CREATED':
        return 'text-red-600'
      case 'BOOKING_COMPLETED':
        return 'text-green-600'
      case 'BOOKING_CANCELLED':
      case 'BOOKING_DECLINED':
        return 'text-blue-600'
      case 'INITIAL_BONUS':
        return 'text-purple-600'
      default:
        return 'text-gray-600'
    }
  }

  if (userLoading || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Booking & Transaction History</h1>
          </div>
          <p className="text-gray-600 ml-14">
            View all your bookings and GivePoint transactions
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Current Balance</p>
                <p className="text-3xl font-bold text-purple-600">{currentUser.givePoints}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Earned</p>
                <p className="text-3xl font-bold text-green-600">+{summary.totalEarned}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Spent</p>
                <p className="text-3xl font-bold text-red-600">-{summary.totalSpent}</p>
              </div>
              <div className="bg-red-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Sessions Done</p>
                <p className="text-3xl font-bold text-blue-600">{summary.sessionsCompleted}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Bookings Made</p>
                <p className="text-3xl font-bold text-orange-600">{summary.bookingsCreated}</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex">
              <button
                onClick={() => setActiveTab('bookings')}
                className={`flex-1 px-6 py-4 text-center font-semibold transition ${
                  activeTab === 'bookings'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>My Bookings</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {bookings.length}
                  </span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('transactions')}
                className={`flex-1 px-6 py-4 text-center font-semibold transition ${
                  activeTab === 'transactions'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>GivePoint Ledger</span>
                  <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
                    {transactions.length}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading history...</p>
              </div>
            ) : (
              <>
                {/* Bookings Tab */}
                {activeTab === 'bookings' && (
                  <div>
                    {bookings.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">📅</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Bookings Yet</h3>
                        <p className="text-gray-600 mb-6">Start by discovering mentors or setting your availability!</p>
                        <div className="flex gap-3 justify-center">
                          <Link
                            href="/discover"
                            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition"
                          >
                            Discover Mentors
                          </Link>
                          <Link
                            href="/dashboard"
                            className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
                          >
                            Manage Availability
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Session Time</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Role</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">With</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Points</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Review</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bookings.map((booking) => {
                              const isMentor = booking.mentorId === currentUser.id
                              const otherUser = isMentor ? booking.mentee : booking.mentor
                              const pointImpact = isMentor
                                ? booking.status === 'COMPLETED' ? '+1' : '0'
                                : booking.status === 'CANCELLED' ? '+1' : '-1'

                              return (
                                <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                  <td className="py-4 px-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {format(new Date(booking.createdAt), 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {format(new Date(booking.createdAt), 'h:mm a')}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {format(new Date(booking.startTime), 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-xs text-gray-600">
                                      {format(new Date(booking.startTime), 'h:mm a')} - {format(new Date(booking.endTime), 'h:mm a')}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                      isMentor 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {isMentor ? '👨‍🏫 Mentor' : '👨‍🎓 Mentee'}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className="flex items-center gap-2">
                                      {otherUser.avatarUrl && (
                                        <Image
                                          src={otherUser.avatarUrl}
                                          alt={otherUser.name || 'User'}
                                          width={32}
                                          height={32}
                                          className="rounded-full"
                                        />
                                      )}
                                      <div>
                                        <div className="text-sm font-medium text-gray-900">
                                          {otherUser.name || 'Unknown'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {otherUser.email}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(booking.status)}`}>
                                      {booking.status}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4">
                                    <span className={`text-sm font-bold ${
                                      pointImpact.startsWith('+') ? 'text-green-600' :
                                      pointImpact.startsWith('-') ? 'text-red-600' :
                                      'text-gray-400'
                                    }`}>
                                      {pointImpact} pt
                                    </span>
                                  </td>
                                  <td className="py-4 px-4">
                                    {booking.review ? (
                                      <div className="flex items-center gap-1">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                          <svg
                                            key={i}
                                            className={`w-4 h-4 ${
                                              i < booking.review!.rating ? 'text-yellow-400' : 'text-gray-300'
                                            }`}
                                            fill="currentColor"
                                            viewBox="0 0 20 20"
                                          >
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                          </svg>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">No review</span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Transactions Tab */}
                {activeTab === 'transactions' && (
                  <div>
                    {transactions.length === 0 ? (
                      <div className="text-center py-12">
                        <div className="text-6xl mb-4">💰</div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">No Transactions Yet</h3>
                        <p className="text-gray-600 mb-6">Your GivePoint activity will appear here</p>
                        <Link
                          href="/discover"
                          className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition"
                        >
                          Start Exploring
                        </Link>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b-2 border-gray-200">
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date & Time</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Transaction Type</th>
                              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Related To</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Amount</th>
                              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Balance Impact</th>
                            </tr>
                          </thead>
                          <tbody>
                            {transactions.map((transaction, index) => {
                              const runningBalance = currentUser.givePoints - transactions
                                .slice(0, index)
                                .reduce((sum, t) => sum + t.amount, 0)

                              return (
                                <tr key={transaction.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                                  <td className="py-4 px-4">
                                    <div className="text-sm font-medium text-gray-900">
                                      {format(new Date(transaction.createdAt), 'MMM d, yyyy')}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {format(new Date(transaction.createdAt), 'h:mm:ss a')}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    <div className={`text-sm font-medium ${getTransactionTypeColor(transaction.type)}`}>
                                      {getTransactionTypeLabel(transaction.type)}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {transaction.type}
                                    </div>
                                  </td>
                                  <td className="py-4 px-4">
                                    {transaction.booking ? (
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const otherUser = transaction.booking.mentorId === currentUser.id
                                            ? transaction.booking.mentee
                                            : transaction.booking.mentor
                                          return (
                                            <>
                                              {otherUser.avatarUrl && (
                                                <Image
                                                  src={otherUser.avatarUrl}
                                                  alt={otherUser.name || 'User'}
                                                  width={24}
                                                  height={24}
                                                  className="rounded-full"
                                                />
                                              )}
                                              <div>
                                                <div className="text-xs font-medium text-gray-900">
                                                  {otherUser.name || 'Unknown'}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {format(new Date(transaction.booking.startTime), 'MMM d, h:mm a')}
                                                </div>
                                              </div>
                                            </>
                                          )
                                        })()}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <span className={`text-lg font-bold ${
                                      transaction.amount > 0 ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                      {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                                    </span>
                                  </td>
                                  <td className="py-4 px-4 text-right">
                                    <div className="text-sm font-semibold text-gray-900">
                                      {runningBalance} pts
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      after transaction
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex gap-4">
          <Link
            href="/dashboard"
            className="flex-1 bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Go to Dashboard</h3>
                <p className="text-sm text-gray-600">Manage your bookings and availability</p>
              </div>
            </div>
          </Link>

          <Link
            href="/discover"
            className="flex-1 bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition group"
          >
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg group-hover:bg-green-200 transition">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">Discover Mentors</h3>
                <p className="text-sm text-gray-600">Find experts to learn from</p>
              </div>
            </div>
          </Link>
        </div>
      </main>
    </div>
  )
}
