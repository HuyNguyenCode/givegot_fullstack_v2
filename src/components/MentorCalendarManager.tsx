'use client'

import { useState, useEffect } from 'react'
import { addMentorSlots, getAllMentorSlots, deleteMentorSlot } from '@/actions/slots'
import { format, addDays, startOfWeek, isSameDay, setHours, setMinutes } from 'date-fns'

interface MentorCalendarManagerProps {
  mentorId: string
}

interface TimeSlot {
  startTime: Date
  endTime: Date
}

interface ExistingSlot {
  id: string
  startTime: Date
  endTime: Date
  isBooked: boolean
  booking?: {
    mentee: {
      id: string
      name: string | null
      avatarUrl: string | null
      email: string
    }
  } | null
}

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8 AM to 8 PM
const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function MentorCalendarManager({ mentorId }: MentorCalendarManagerProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date()
    return startOfWeek(today, { weekStartsOn: 1 }) // Monday
  })
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set())
  const [existingSlots, setExistingSlots] = useState<ExistingSlot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [showSuccessToast, setShowSuccessToast] = useState(false)

  const loadExistingSlots = async () => {
    setIsLoading(true)
    const slots = await getAllMentorSlots(mentorId)
    setExistingSlots(slots)
    setIsLoading(false)
  }

  useEffect(() => {
    loadExistingSlots()
  }, [mentorId])

  const getSlotKey = (day: Date, hour: number) => {
    return `${format(day, 'yyyy-MM-dd')}-${hour}`
  }

  // const parseSlotKey = (key: string): TimeSlot => {
  //   const [dateStr, hourStr] = key.split('-')
  //   const date = new Date(dateStr)
  //   const hour = parseInt(hourStr)
    
  //   const startTime = setMinutes(setHours(date, hour), 0)
  //   const endTime = setMinutes(setHours(date, hour + 1), 0)
    
  //   return { startTime, endTime }
  // }
  const parseSlotKey = (key: string): TimeSlot => {
    // Tìm dấu gạch ngang cuối cùng để tách chuẩn xác Ngày và Giờ
    const lastDashIndex = key.lastIndexOf('-');
    const dateStr = key.substring(0, lastDashIndex); // Lấy được "2026-03-05"
    const hourStr = key.substring(lastDashIndex + 1); // Lấy được "8"
    
    const date = new Date(dateStr)
    const hour = parseInt(hourStr)
    
    const startTime = setMinutes(setHours(date, hour), 0)
    const endTime = setMinutes(setHours(date, hour + 1), 0)
    
    return { startTime, endTime }
  }

  const toggleSlot = (day: Date, hour: number) => {
    const key = getSlotKey(day, hour)
    const newSelected = new Set(selectedSlots)
    
    if (newSelected.has(key)) {
      newSelected.delete(key)
    } else {
      newSelected.add(key)
    }
    
    setSelectedSlots(newSelected)
  }

  const isSlotSelected = (day: Date, hour: number) => {
    const key = getSlotKey(day, hour)
    return selectedSlots.has(key)
  }

  const isSlotExisting = (day: Date, hour: number) => {
    return existingSlots.some(slot => {
      const slotStart = new Date(slot.startTime)
      return (
        isSameDay(slotStart, day) &&
        slotStart.getHours() === hour
      )
    })
  }

  const getExistingSlot = (day: Date, hour: number): ExistingSlot | undefined => {
    return existingSlots.find(slot => {
      const slotStart = new Date(slot.startTime)
      return (
        isSameDay(slotStart, day) &&
        slotStart.getHours() === hour
      )
    })
  }

  const handleSaveSlots = async () => {
    if (selectedSlots.size === 0) {
      alert('⚠️ Please select at least one time slot')
      return
    }

    setIsSaving(true)

    const slotsToCreate: TimeSlot[] = Array.from(selectedSlots).map(key => parseSlotKey(key))

    const result = await addMentorSlots(mentorId, slotsToCreate)

    if (result.success) {
      setShowSuccessToast(true)
      setTimeout(() => setShowSuccessToast(false), 3000)
      setSelectedSlots(new Set())
      await loadExistingSlots()
    } else {
      alert(`❌ ${result.message}`)
    }

    setIsSaving(false)
  }

  const handleDeleteSlot = async (slotId: string) => {
    if (!confirm('Are you sure you want to delete this available slot?')) {
      return
    }

    const result = await deleteMentorSlot(slotId, mentorId)

    if (result.success) {
      await loadExistingSlots()
    } else {
      alert(`❌ ${result.message}`)
    }
  }

  const handleNextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const handlePrevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i))

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <span className="text-2xl">📅</span>
            Manage Your Available Slots
          </h2>
          <button
            onClick={loadExistingSlots}
            disabled={isLoading}
            className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-blue-800">
            <strong>💡 How it works:</strong> Click time blocks to select your available hours. 
            Green blocks are already saved. Orange blocks are booked by mentees.
          </p>
        </div>

        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevWeek}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
          >
            ← Previous Week
          </button>
          <div className="text-center">
            <p className="text-lg font-semibold text-gray-900">
              {format(currentWeekStart, 'MMM d')} - {format(addDays(currentWeekStart, 6), 'MMM d, yyyy')}
            </p>
          </div>
          <button
            onClick={handleNextWeek}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
          >
            Next Week →
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header Row - Days */}
          <div className="grid grid-cols-8 gap-2 mb-2">
            <div className="text-sm font-semibold text-gray-600 text-center py-2">
              Time
            </div>
            {weekDays.map((day, idx) => (
              <div
                key={idx}
                className="text-sm font-semibold text-gray-900 text-center py-2 bg-purple-50 rounded-lg"
              >
                <div>{DAYS_OF_WEEK[idx]}</div>
                <div className="text-xs text-gray-600">{format(day, 'MMM d')}</div>
              </div>
            ))}
          </div>

          {/* Time Slots Grid */}
          <div className="space-y-1">
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-8 gap-2">
                {/* Time Label */}
                <div className="text-sm font-medium text-gray-600 text-center py-3 bg-gray-50 rounded-lg">
                  {hour}:00
                </div>

                {/* Slots for each day */}
                {weekDays.map((day, dayIdx) => {
                  const existingSlot = getExistingSlot(day, hour)
                  const isExisting = !!existingSlot
                  const isBooked = existingSlot?.isBooked || false
                  const isSelected = isSlotSelected(day, hour)
                  const isPast = new Date(setHours(day, hour)) < new Date()

                  return (
                    <div key={dayIdx} className="relative group">
                      <button
                        type="button"
                        onClick={() => {
                          if (!isExisting && !isPast) {
                            toggleSlot(day, hour)
                          }
                        }}
                        disabled={isExisting || isPast}
                        className={`
                          w-full py-3 rounded-lg font-medium text-sm transition-all
                          ${isPast ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}
                          ${isBooked ? 'bg-orange-500 text-white cursor-not-allowed ring-2 ring-orange-300' : ''}
                          ${isExisting && !isBooked ? 'bg-green-500 text-white cursor-not-allowed ring-2 ring-green-300' : ''}
                          ${isSelected ? 'bg-purple-600 text-white ring-2 ring-purple-400 scale-105' : ''}
                          ${!isExisting && !isPast && !isSelected ? 'bg-gray-50 hover:bg-purple-100 border-2 border-gray-200 hover:border-purple-300' : ''}
                        `}
                        title={
                          isPast ? 'Past time' :
                          isBooked ? `Booked by ${existingSlot?.booking?.mentee.name}` :
                          isExisting ? 'Available slot (saved)' :
                          isSelected ? 'Click to deselect' :
                          'Click to select'
                        }
                      >
                        {isBooked && (
                          <span className="text-xs">📌 Booked</span>
                        )}
                        {isExisting && !isBooked && (
                          <span className="text-xs">✓ Available</span>
                        )}
                        {isSelected && (
                          <span className="text-xs">+ New</span>
                        )}
                        {!isExisting && !isSelected && !isPast && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                        {isPast && (
                          <span className="text-xs">—</span>
                        )}
                      </button>

                      {/* Delete button for existing unbooked slots - FIXED */}
                      {isExisting && !isBooked && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteSlot(existingSlot.id)
                          }}
                          className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shadow-lg"
                          title="Delete this slot"
                        >
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded"></div>
          <span className="text-gray-700">Selected (not saved yet)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-500 rounded"></div>
          <span className="text-gray-700">Available (saved)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-orange-500 rounded"></div>
          <span className="text-gray-700">Booked by mentee</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-100 rounded"></div>
          <span className="text-gray-700">Past / Unavailable</span>
        </div>
      </div>

      {/* Action Buttons */}
      {selectedSlots.size > 0 && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => setSelectedSlots(new Set())}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition"
          >
            Clear Selection ({selectedSlots.size})
          </button>
          <button
            onClick={handleSaveSlots}
            disabled={isSaving}
            className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition disabled:from-gray-300 disabled:to-gray-400 shadow-lg"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving...
              </span>
            ) : (
              `Save ${selectedSlots.size} Slot${selectedSlots.size !== 1 ? 's' : ''}`
            )}
          </button>
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
            <p className="font-semibold">Slots Saved!</p>
            <p className="text-sm text-green-100">Mentees can now book these times</p>
          </div>
        </div>
      )}
    </div>
  )
}
