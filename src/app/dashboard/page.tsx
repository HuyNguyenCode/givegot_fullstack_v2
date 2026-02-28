'use client'

import { useUser } from '@/contexts/UserContext'
import { useEffect, useState } from 'react'
import { getMyBookings, acceptBooking, cancelBooking, completeSessionWithReview } from '@/actions/booking'
import { getUserLearningGoals } from '@/actions/user'
import { BookingWithDetails } from '@/types'
import { RoadmapStep } from '@/lib/gemini'
import LearningRoadmapCard from '@/components/LearningRoadmapCard'
import Image from 'next/image'
import { BookingStatus } from '@prisma/client'
import Link from 'next/link'

export default function DashboardPage() {
  const { currentUser, refreshUser, isLoading: userLoading } = useUser()
  const [mentoringBookings, setMentoringBookings] = useState<BookingWithDetails[]>([])
  const [learningBookings, setLearningBookings] = useState<BookingWithDetails[]>([])
  const [learningSkillsWithRoadmap, setLearningSkillsWithRoadmap] = useState<Array<{ id: string; name: string; roadmap: RoadmapStep[] | null }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null)
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)

  const loadBookings = async () => {
    if (!currentUser) return
    
    setIsLoading(true)
    await refreshUser()
    const bookings = await getMyBookings(currentUser.id)
    setMentoringBookings(bookings.asMentor)
    setLearningBookings(bookings.asMentee)
    
    // Load learning goals with roadmaps for the roadmap cards
    const rawLearningGoals = await getUserLearningGoals(currentUser.id)
    setLearningSkillsWithRoadmap(rawLearningGoals)
    
    setIsLoading(false)
  }

  useEffect(() => {
    loadBookings()
  }, [currentUser?.id])

  const handleAccept = async (bookingId: string) => {
    if (!currentUser) return
    setActionLoading(bookingId)
    
    const result = await acceptBooking(bookingId, currentUser.id)
    
    if (result.success) {
      alert(`✅ ${result.message}`)
      await refreshUser()
      await loadBookings()
    } else {
      alert(`❌ ${result.message}`)
    }
    
    setActionLoading(null)
  }

  const handleComplete = (booking: BookingWithDetails) => {
    setSelectedBooking(booking)
    setRating(0)
    setHoverRating(0)
    setComment('')
    setIsReviewModalOpen(true)
  }

  const handleSubmitReview = async () => {
    if (!currentUser || !selectedBooking) return
    
    if (rating === 0) {
      alert('❌ Please select a rating before submitting')
      return
    }

    setIsSubmittingReview(true)
    
    const result = await completeSessionWithReview(
      selectedBooking.id,
      currentUser.id,
      rating,
      comment.trim() || undefined
    )
    
    if (result.success) {
      alert(`✅ ${result.message}`)
      setIsReviewModalOpen(false)
      setSelectedBooking(null)
      await refreshUser()
      await loadBookings()
    } else {
      alert(`❌ ${result.message}`)
    }
    
    setIsSubmittingReview(false)
  }

  const handleCancel = async (bookingId: string) => {
    if (!currentUser) return
    
    if (!confirm('Are you sure you want to cancel this booking? Your point will be refunded.')) {
      return
    }
    
    setActionLoading(bookingId)
    
    const result = await cancelBooking(bookingId, currentUser.id)
    
    if (result.success) {
      alert(`✅ ${result.message}`)
      await refreshUser()
      await loadBookings()
    } else {
      alert(`❌ ${result.message}`)
    }
    
    setActionLoading(null)
  }

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600">Authentication Required</h2>
          <p className="text-gray-600 mt-2">Please select a user from the switcher above.</p>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: BookingStatus) => {
    const styles = {
      [BookingStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
      [BookingStatus.CONFIRMED]: 'bg-blue-100 text-blue-800',
      [BookingStatus.COMPLETED]: 'bg-green-100 text-green-800',
      [BookingStatus.CANCELLED]: 'bg-red-100 text-red-800',
    }
    return styles[status] || 'bg-gray-100 text-gray-800'
  }

  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">Manage your mentoring and learning sessions</p>
          </div>
          <button
            onClick={loadBookings}
            disabled={isLoading}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-purple-700 transition disabled:bg-gray-300 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">GivePoints</h2>
              <div className="bg-purple-100 p-2 rounded-full">
                <svg
                  className="w-6 h-6 text-purple-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold text-purple-600">{currentUser.givePoints}</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">As Mentor</h2>
              <div className="bg-green-100 p-2 rounded-full">
                <svg
                  className="w-6 h-6 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold text-green-600">{mentoringBookings.length}</span>
              <span className="text-sm text-gray-600 ml-2">sessions</span>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800">As Mentee</h2>
              <div className="bg-blue-100 p-2 rounded-full">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <span className="text-3xl font-bold text-blue-600">{learningBookings.length}</span>
              <span className="text-sm text-gray-600 ml-2">sessions</span>
            </div>
          </div>
        </div>

        <div className="mb-8 flex flex-wrap gap-3">
          <Link
            href="/discover"
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 transition shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Discover Mentors
          </Link>
          <Link
            href="/profile"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:from-purple-700 hover:to-blue-700 transition shadow-md"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Edit Profile
          </Link>
        </div>

        {/* AI Learning Roadmaps Section */}
        {learningSkillsWithRoadmap.length > 0 && (
          <section className="mb-8">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    🗺️ Your Learning Roadmaps
                  </h2>
                  <p className="text-gray-600 text-sm">
                    AI-generated step-by-step paths to master your goals
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {learningSkillsWithRoadmap.map((skillData) => (
                <LearningRoadmapCard
                  key={skillData.id}
                  userSkillId={skillData.id}
                  skillName={skillData.name}
                  initialRoadmap={skillData.roadmap}
                />
              ))}
            </div>
          </section>
        )}

        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">🎓</span>
              Mentoring Sessions
              {mentoringBookings.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({mentoringBookings.length} total)
                </span>
              )}
            </h2>

            {mentoringBookings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600">No one has booked you yet.</p>
                <p className="text-sm text-gray-500 mt-1">
                  Your teaching opportunities will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {mentoringBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        {booking.mentee.avatarUrl && (
                          <Image
                            src={booking.mentee.avatarUrl}
                            alt={booking.mentee.name || 'Mentee'}
                            width={56}
                            height={56}
                            className="rounded-full"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {booking.mentee.name || 'Anonymous'}
                          </h3>
                          <p className="text-sm text-gray-500">{booking.mentee.email}</p>
                          <div className="mt-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                                booking.status
                              )}`}
                            >
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {formatDateTime(booking.startTime)}
                        </p>
                        <p className="text-xs text-gray-500">1 hour session</p>
                      </div>
                    </div>

                    {booking.note && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Note:</span> {booking.note}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {booking.status === BookingStatus.PENDING && (
                        <>
                          <button
                            onClick={() => handleAccept(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="flex-1 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 transition disabled:bg-gray-300"
                          >
                            {actionLoading === booking.id ? 'Processing...' : 'Accept Booking'}
                          </button>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="px-4 bg-red-100 text-red-700 py-2 rounded-lg font-medium hover:bg-red-200 transition"
                          >
                            Decline
                          </button>
                        </>
                      )}
                      {booking.status === BookingStatus.CONFIRMED && (
                        <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                          <p className="text-sm text-blue-800">
                            ⏰ Session confirmed. Waiting for mentee to mark as complete.
                          </p>
                        </div>
                      )}
                      {booking.status === BookingStatus.COMPLETED && (
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <p className="text-sm text-green-800">
                            ✅ Session completed! You earned 1 GivePoint.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <span className="text-2xl">📚</span>
              Learning Sessions
              {learningBookings.length > 0 && (
                <span className="text-sm font-normal text-gray-500">
                  ({learningBookings.length} total)
                </span>
              )}
            </h2>

            {learningBookings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <p className="text-gray-600">You haven't booked any sessions yet.</p>
                <Link
                  href="/discover"
                  className="inline-block mt-4 text-purple-600 hover:text-purple-700 font-medium"
                >
                  Find a Mentor →
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {learningBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-600"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4 flex-1">
                        {booking.mentor.avatarUrl && (
                          <Image
                            src={booking.mentor.avatarUrl}
                            alt={booking.mentor.name || 'Mentor'}
                            width={56}
                            height={56}
                            className="rounded-full"
                          />
                        )}
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {booking.mentor.name || 'Anonymous'}
                          </h3>
                          <p className="text-sm text-gray-500">{booking.mentor.email}</p>
                          <div className="mt-2">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                                booking.status
                              )}`}
                            >
                              {booking.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">
                          {formatDateTime(booking.startTime)}
                        </p>
                        <p className="text-xs text-gray-500">1 hour session</p>
                      </div>
                    </div>

                    {booking.note && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-4">
                        <p className="text-sm text-gray-700">
                          <span className="font-semibold">Your note:</span> {booking.note}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-3">
                      {booking.status === BookingStatus.PENDING && (
                        <>
                          <div className="flex-1 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                            <p className="text-sm text-yellow-800">
                              ⏳ Waiting for mentor to accept...
                            </p>
                          </div>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="px-4 bg-red-100 text-red-700 py-2 rounded-lg font-medium hover:bg-red-200 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {booking.status === BookingStatus.CONFIRMED && (
                        <>
                          <button
                            onClick={() => handleComplete(booking)}
                            disabled={actionLoading === booking.id}
                            className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition disabled:bg-gray-300"
                          >
                            {actionLoading === booking.id ? 'Processing...' : 'Submit Review & Complete'}
                          </button>
                          <button
                            onClick={() => handleCancel(booking.id)}
                            disabled={actionLoading === booking.id}
                            className="px-4 bg-red-100 text-red-700 py-2 rounded-lg font-medium hover:bg-red-200 transition"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                      {booking.status === BookingStatus.COMPLETED && (
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                          <p className="text-sm text-green-800">
                            ✅ Session completed! 1 GivePoint transferred.
                          </p>
                        </div>
                      )}
                      {booking.status === BookingStatus.CANCELLED && (
                        <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                          <p className="text-sm text-red-800">
                            ❌ Booking cancelled. Point refunded.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      {isReviewModalOpen && selectedBooking && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Submit Review</h3>
                <button
                  onClick={() => setIsReviewModalOpen(false)}
                  className="text-white hover:text-gray-200 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Image
                  src={selectedBooking.mentor.avatarUrl || '/default-avatar.png'}
                  alt={selectedBooking.mentor.name || 'Mentor'}
                  width={64}
                  height={64}
                  className="rounded-full ring-2 ring-purple-200"
                />
                <div>
                  <p className="text-sm text-gray-600">Your session with</p>
                  <p className="font-bold text-lg text-gray-900">{selectedBooking.mentor.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedBooking.startTime).toLocaleString()}
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-3">
                  How would you rate this session? *
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoverRating(star)}
                      onMouseLeave={() => setHoverRating(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <svg
                        className={`w-10 h-10 ${
                          star <= (hoverRating || rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        } transition-colors`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
                {rating > 0 && (
                  <p className="text-sm text-purple-600 font-medium mt-2">
                    {rating === 5 && '⭐ Outstanding!'}
                    {rating === 4 && '⭐ Great session!'}
                    {rating === 3 && '⭐ Good session'}
                    {rating === 2 && '⭐ Could be better'}
                    {rating === 1 && '⭐ Needs improvement'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="comment" className="block text-sm font-semibold text-gray-900 mb-2">
                  Share your experience (optional)
                </label>
                <textarea
                  id="comment"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="What did you learn? How was the mentor? Any feedback..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {comment.length}/500 characters
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">What happens next?</p>
                    <p className="text-sm text-blue-800 mt-1">
                      Submitting this review will mark the session as complete and transfer 1 GivePoint to your mentor.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  disabled={isSubmittingReview}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition disabled:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReview}
                  disabled={isSubmittingReview || rating === 0}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed shadow-md"
                >
                  {isSubmittingReview ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </span>
                  ) : (
                    'Submit & Complete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
