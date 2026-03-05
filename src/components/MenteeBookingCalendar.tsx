'use client'

import { useState, useEffect } from 'react'
import { getAvailableSlots } from '@/actions/slots'
import { bookAvailableSlot } from '@/actions/booking'
import { format, isSameDay, startOfWeek, addDays } from 'date-fns'
import { useRouter } from 'next/navigation'

interface MenteeBookingCalendarProps {
  mentorId: string
  mentorName: string
  currentUserId: string
  currentUserPoints: number
}

interface AvailableSlot {
  id: string
  startTime: Date
  endTime: Date
  isBooked: boolean
}

export default function MenteeBookingCalendar({
  mentorId,
  mentorName,
  currentUserId,
  currentUserPoints,
}: MenteeBookingCalendarProps) {
  const router = useRouter()
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [bookingNote, setBookingNote] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)
  const [showErrorToast, setShowErrorToast] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const loadSlots = async () => {
    setIsLoading(true)
    const slots = await getAvailableSlots(mentorId)
    setAvailableSlots(slots)
    setIsLoading(false)
  }

  useEffect(() => {
    loadSlots()
  }, [mentorId])

  const handleSlotClick = (slot: AvailableSlot) => {
    if (currentUserPoints < 1) {
      alert('⚠️ You need at least 1 GivePoint to book a session. Teach to earn more points!')
      return
    }

    setSelectedSlot(slot)
    setBookingNote('')
    setIsModalOpen(true)
  }

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return

    setIsBooking(true)

    const result = await bookAvailableSlot(selectedSlot.id, currentUserId, bookingNote.trim() || undefined)

    if (result.success) {
      setShowSuccessToast(true)
      setTimeout(() => {
        setShowSuccessToast(false)
        router.push('/dashboard')
      }, 2000)
      setIsModalOpen(false)
      await loadSlots()
    } else {
      // Handle concurrency error gracefully
      setErrorMessage(result.message)
      setShowErrorToast(true)
      setTimeout(() => setShowErrorToast(false), 4000)
      setIsModalOpen(false)
      await loadSlots() // Refresh to show updated availability
    }

    setIsBooking(false)
  }

  // Group slots by week
  const groupSlotsByWeek = () => {
    const weeks: Map<string, AvailableSlot[]> = new Map()

    availableSlots.forEach(slot => {
      const slotDate = new Date(slot.startTime)
      const weekStart = startOfWeek(slotDate, { weekStartsOn: 1 })
      const weekKey = format(weekStart, 'yyyy-MM-dd')

      if (!weeks.has(weekKey)) {
        weeks.set(weekKey, [])
      }
      weeks.get(weekKey)!.push(slot)
    })

    return Array.from(weeks.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }

  const groupedWeeks = groupSlotsByWeek()

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading available slots...</p>
      </div>
    )
  }

  if (availableSlots.length === 0) {
    return (
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl border-2 border-dashed border-purple-300 p-12 text-center">
        <div className="text-6xl mb-4">📅</div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          No Available Slots Yet
        </h3>
        <p className="text-gray-600">
          {mentorName} hasn't set up their availability calendar. Check back later!
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2 mb-2">
            <span className="text-2xl">📅</span>
            Available Time Slots
          </h2>
          <p className="text-gray-600">
            Click a green slot to book a 1-hour session with {mentorName}
          </p>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-purple-900 font-medium">Your Balance:</span>
            <span className="text-2xl font-bold text-purple-600">
              {currentUserPoints} pt{currentUserPoints !== 1 ? 's' : ''}
            </span>
          </div>
          {currentUserPoints < 1 && (
            <p className="text-sm text-red-600 mt-2">
              ⚠️ You need at least 1 point to book. Teach to earn more!
            </p>
          )}
        </div>

        {/* Slots grouped by week */}
        <div className="space-y-8">
          {groupedWeeks.map(([weekKey, slots]) => {
            const weekStart = new Date(weekKey)
            const weekEnd = addDays(weekStart, 6)

            return (
              <div key={weekKey}>
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Week of {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {slots.map(slot => {
                    const slotDate = new Date(slot.startTime)
                    const slotEnd = new Date(slot.endTime)

                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotClick(slot)}
                        disabled={currentUserPoints < 1}
                        className="group bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 border-2 border-green-400 rounded-lg p-4 text-left transition-all hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-bold text-green-700 uppercase">
                              Available
                            </span>
                          </div>
                          <svg
                            className="w-5 h-5 text-green-600 group-hover:scale-110 transition-transform"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </div>

                        <div className="space-y-1">
                          <p className="font-bold text-gray-900 text-lg">
                            {format(slotDate, 'EEEE, MMM d')}
                          </p>
                          <p className="text-2xl font-bold text-green-600">
                            {format(slotDate, 'h:mm a')} - {format(slotEnd, 'h:mm a')}
                          </p>
                          <p className="text-xs text-gray-600 mt-2">
                            Click to book • 1 GivePoint
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Booking Confirmation Modal */}
      {isModalOpen && selectedSlot && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-5 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold text-white">Confirm Booking</h3>
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isBooking}
                  className="text-white hover:text-gray-200 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-1">Session with</p>
                <p className="text-xl font-bold text-gray-900 mb-3">{mentorName}</p>
                
                <div className="flex items-center gap-2 text-purple-700 mb-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold">
                    {format(new Date(selectedSlot.startTime), 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-purple-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-semibold text-2xl">
                    {format(new Date(selectedSlot.startTime), 'h:mm a')} - {format(new Date(selectedSlot.endTime), 'h:mm a')}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="note" className="block text-sm font-semibold text-gray-900 mb-2">
                  Note for Mentor (Optional)
                </label>
                <textarea
                  id="note"
                  rows={3}
                  value={bookingNote}
                  onChange={(e) => setBookingNote(e.target.value)}
                  placeholder="What would you like to learn? Any specific topics?"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
                  maxLength={300}
                />
                <p className="text-xs text-gray-500 mt-1 text-right">
                  {bookingNote.length}/300 characters
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-blue-900">Time-Banking Rules</p>
                    <ul className="text-sm text-blue-800 mt-1 space-y-1">
                      <li>• 1 GivePoint will be held when you book</li>
                      <li>• Point transfers to mentor after session completion</li>
                      <li>• You can cancel anytime for a full refund</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsModalOpen(false)}
                  disabled={isBooking}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition disabled:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmBooking}
                  disabled={isBooking}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition disabled:from-gray-300 disabled:to-gray-400 shadow-lg"
                >
                  {isBooking ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Booking...
                    </span>
                  ) : (
                    'Confirm Booking (1 pt)'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {showSuccessToast && (
        <div className="fixed bottom-8 right-8 bg-green-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-in z-50">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-semibold">Booking Confirmed!</p>
            <p className="text-sm text-green-100">Redirecting to dashboard...</p>
          </div>
        </div>
      )}

      {/* Error Toast - Concurrency Handling */}
      {showErrorToast && (
        <div className="fixed bottom-8 right-8 bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 animate-slide-in z-50 max-w-md">
          <svg className="w-6 h-6 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="font-semibold">Booking Failed</p>
            <p className="text-sm text-red-100">{errorMessage}</p>
          </div>
        </div>
      )}
    </>
  )
}
