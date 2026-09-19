'use client'

import { useUser } from '@/contexts/UserContext'
import { useCallback, useEffect, useState, use } from 'react'
import { getMentorById } from '@/actions/mentor'
import { bookAvailableSlot, createBooking } from '@/actions/booking'
import { getAvailableSlots } from '@/actions/slots'
import { getLearningBookingContext } from '@/actions/learning-booking'
import { LearningModeSelector } from '@/components/learning/LearningModeSelector'
import type { LearningBookingContext } from '@/lib/learning-booking-service'
import type { LearningModeValue } from '@/lib/learning-mode-contracts'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

interface MentorWithSkills {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  givePoints: number
  teachingSkills: Array<{
    id: string
    name: string
    slug: string
  } | undefined>
}

type AvailableSlot = Awaited<ReturnType<typeof getAvailableSlots>>[number]

export default function BookSessionPage({ params, searchParams }: { params: Promise<{ mentorId: string }>; searchParams: Promise<{ learningSpaceId?: string }> }) {
  const { mentorId } = use(params)
  const { learningSpaceId } = use(searchParams)
  const { currentUser, refreshUser } = useUser()
  const router = useRouter()
  const [mentor, setMentor] = useState<MentorWithSkills | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [learningContext, setLearningContext] = useState<LearningBookingContext | null>(null)
  const [learningContextLoading, setLearningContextLoading] = useState(Boolean(learningSpaceId))
  const [learningMode, setLearningMode] = useState<LearningModeValue>('LIVE')
  const [topicId, setTopicId] = useState('')
  const [objective, setObjective] = useState('')
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState('')
  const [slotsLoading, setSlotsLoading] = useState(false)
  const usesAvailableSlot = Boolean(
    learningSpaceId && (learningMode === 'LIVE' || learningMode === 'HYBRID'),
  )

  const loadAvailableSlots = useCallback(async () => {
    setSlotsLoading(true)
    const slots = await getAvailableSlots(mentorId)
    const now = new Date()
    setAvailableSlots(slots.filter((slot) => !slot.isBooked && new Date(slot.startTime) > now))
    setSelectedSlotId('')
    setSlotsLoading(false)
  }, [mentorId])

  useEffect(() => {
    async function loadMentor() {
      const mentorData = await getMentorById(mentorId)
      setMentor(mentorData)
      setIsLoading(false)
    }
    loadMentor()
  }, [mentorId])

  useEffect(() => {
    if (!learningSpaceId) return
    let cancelled = false
    getLearningBookingContext(mentorId, learningSpaceId)
      .then((result) => {
        if (cancelled) return
        if (result.success) {
          setLearningContext(result.context)
          setObjective(result.context.objective ?? '')
        } else {
          setError(result.message)
        }
      })
      .catch(() => {
        if (!cancelled) setError('Không thể tải thông tin LearningSpace cho booking này.')
      })
      .finally(() => {
        if (!cancelled) setLearningContextLoading(false)
      })
    return () => { cancelled = true }
  }, [learningSpaceId, mentorId])

  useEffect(() => {
    if (!usesAvailableSlot || !learningContext) return
    let cancelled = false
    async function loadSlots() {
      setSlotsLoading(true)
      const slots = await getAvailableSlots(mentorId)
      if (cancelled) return
      const now = new Date()
      setAvailableSlots(slots.filter((slot) => !slot.isBooked && new Date(slot.startTime) > now))
      setSelectedSlotId('')
      setSlotsLoading(false)
    }
    void loadSlots()
    return () => { cancelled = true }
  }, [learningContext, mentorId, usesAvailableSlot])

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUser || !mentor) return

    if (currentUser.id === mentor.id) {
      setError('Bạn không thể đặt lịch với chính mình!')
      return
    }

    if (learningSpaceId && !learningContext) {
      setError('LearningSpace này không thể dùng cho booking.')
      return
    }

    if (learningMode === 'LIVE' && learningContext && !objective.trim()) {
      setError('Hình thức Học trực tiếp cần có mục tiêu.')
      return
    }

    if (usesAvailableSlot && !selectedSlotId) {
      setError('Vui lòng chọn một khung giờ trống của Mentor.')
      return
    }

    if (!usesAvailableSlot && (!selectedDate || !selectedTime)) {
      setError('Vui lòng chọn cả ngày và giờ cho buổi học.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const learningSelection = learningContext ? {
        learningSpaceId: learningContext.id,
        learningMode,
        topicId: topicId || null,
        objective: objective.trim() || null,
        definitionOfDone: learningContext.definitionOfDone,
      } : undefined

    let result
    if (usesAvailableSlot) {
      result = await bookAvailableSlot(
        selectedSlotId,
        currentUser.id,
        note,
        learningSelection,
      )
    } else {
      const startTime = new Date(`${selectedDate}T${selectedTime}:00`)
      const endTime = new Date(startTime)
      endTime.setHours(endTime.getHours() + 1)
      result = await createBooking(
        mentor.id,
        currentUser.id,
        startTime,
        endTime,
        note,
        learningSelection,
      )
    }

    if (result.success) {
      await refreshUser()
      alert(`${result.message}`)
      router.push('/dashboard')
    } else if (result.message === 'ACCOUNT_SUSPENDED') {
      // Anti-Scam Auto-Suspension guard tripped server-side.
      setError('Tài khoản của bạn đã bị hạn chế do Trust Score quá thấp. Vui lòng liên hệ hỗ trợ.')
    } else {
      setError(result.message)
    }

    if (!result.success && usesAvailableSlot) {
      await loadAvailableSlots()
    }

    setIsSubmitting(false)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải thông tin Mentor...</p>
        </div>
      </div>
    )
  }

  if (!mentor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600">Không tìm thấy Mentor</h2>
          <button
            onClick={() => router.push('/discover')}
            className="mt-4 text-purple-600 hover:text-purple-700"
          >
            ← Về trang khám phá
          </button>
        </div>
      </div>
    )
  }

  const tomorrowDate = new Date()
  tomorrowDate.setDate(tomorrowDate.getDate() + 1)
  const minDate = tomorrowDate.toISOString().split('T')[0]

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push('/discover')}
          className="text-purple-600 hover:text-purple-700 font-medium mb-6 flex items-center gap-1"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Về trang khám phá
        </button>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Đặt lịch buổi học
          </h1>

          <div className="flex items-start gap-6 mb-8 pb-6 border-b">
            {mentor.avatarUrl && (
              <Image
                src={mentor.avatarUrl}
                alt={mentor.name || 'Mentor'}
                width={80}
                height={80}
                className="rounded-full"
              />
            )}
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {mentor.name || 'Mentor ẩn danh'}
              </h2>
              <p className="text-sm text-gray-500 mb-2">{mentor.email}</p>
              {mentor.bio && (
                <p className="text-gray-600 mb-3">{mentor.bio}</p>
              )}
              <div className="flex flex-wrap gap-2">
                {mentor.teachingSkills.map((skill) => (
                  <span
                    key={skill?.id}
                    className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full"
                  >
                    {skill?.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <form onSubmit={handleBooking} className="space-y-6">
            {learningSpaceId && (
              <section className="rounded-xl border border-purple-200 bg-white p-4" aria-labelledby="learning-booking-heading">
                <h2 id="learning-booking-heading" className="font-semibold text-gray-950">Booking trong LearningSpace</h2>
                {learningContextLoading ? (
                  <p className="mt-2 text-sm text-gray-600" role="status">Đang tải hợp đồng học tập…</p>
                ) : learningContext ? (
                  <div className="mt-4 space-y-5">
                    <p className="text-sm text-gray-700">Không gian: <span className="font-semibold">{learningContext.title}</span></p>
                    <LearningModeSelector value={learningMode} onChange={(mode) => {
                      setLearningMode(mode)
                      setSelectedSlotId('')
                    }} />
                    {learningContext.topics.length > 0 && (
                      <div>
                        <label htmlFor="learning-topic" className="block text-sm font-medium text-gray-700 mb-2">Chủ đề (không bắt buộc)</label>
                        <select id="learning-topic" value={topicId} onChange={(event) => setTopicId(event.target.value)} className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-purple-600">
                          <option value="">Không chọn chủ đề</option>
                          {learningContext.topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.label}</option>)}
                        </select>
                      </div>
                    )}
                    <div>
                      <label htmlFor="learning-objective" className="block text-sm font-medium text-gray-700 mb-2">
                        Mục tiêu {learningMode === 'LIVE' ? '*' : '(không bắt buộc)'}
                      </label>
                      <textarea id="learning-objective" rows={3} value={objective} onChange={(event) => setObjective(event.target.value)} maxLength={10000} className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-purple-600" />
                      <p className="mt-1 text-xs text-gray-500">Mục tiêu và chủ đề được lưu thành snapshot của booking này.</p>
                    </div>
                    <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                      Cả ba hình thức vẫn dùng đúng 1 GivePoint theo chính sách booking hiện tại. Hình thức học chỉ thay đổi bằng chứng hoàn thành.
                    </p>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-red-700">LearningSpace này không thể dùng cho booking.</p>
                )}
              </section>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="font-semibold text-blue-900">Quy tắc Time-Banking</h3>
              </div>
              <ul className="text-sm text-blue-800 space-y-1 ml-7">
                <li>• 1 giờ học = 1 GivePoint (giữ khi bạn đặt lịch)</li>
                <li>• Điểm sẽ chuyển cho Mentor sau khi buổi học hoàn thành</li>
                <li>• Bạn cần ít nhất 1 điểm để đặt lịch</li>
              </ul>
            </div>

            {currentUser && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-purple-900 font-medium">Số dư hiện tại của bạn:</span>
                  <span className="text-2xl font-bold text-purple-600">
                    {currentUser.givePoints} điểm
                  </span>
                </div>
                {currentUser.givePoints < 1 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ Bạn không có đủ điểm để đặt lịch buổi học này.
                  </p>
                )}
              </div>
            )}

            {usesAvailableSlot ? (
              <fieldset className="rounded-xl border border-green-200 bg-green-50/50 p-4">
                <legend className="px-1 text-sm font-semibold text-gray-900">Khung giờ trống của Mentor *</legend>
                {learningContextLoading || slotsLoading ? (
                  <p className="mt-2 text-sm text-gray-600" role="status">Đang tải các khung giờ trống…</p>
                ) : availableSlots.length === 0 ? (
                  <p className="mt-2 rounded-lg bg-white p-3 text-sm text-gray-700">
                    Mentor hiện chưa có khung giờ trống. LIVE và HYBRID không thể đặt bằng ngày giờ tự nhập.
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {availableSlots.map((slot) => {
                      const start = new Date(slot.startTime)
                      const end = new Date(slot.endTime)
                      const selected = selectedSlotId === slot.id
                      return (
                        <label
                          key={slot.id}
                          className={`cursor-pointer rounded-lg border p-3 transition ${selected ? 'border-purple-600 bg-purple-50 ring-2 ring-purple-200' : 'border-green-300 bg-white hover:border-green-500'}`}
                        >
                          <input
                            type="radio"
                            name="available-slot"
                            value={slot.id}
                            checked={selected}
                            onChange={() => setSelectedSlotId(slot.id)}
                            className="mr-2 accent-purple-600"
                          />
                          <span className="font-medium text-gray-900">
                            {start.toLocaleDateString('vi-VN')} · {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}–{end.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </fieldset>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-2">
                    Ngày học *
                  </label>
                  <input
                    type="date"
                    id="date"
                    required
                    min={minDate}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>

                <div>
                  <label htmlFor="time" className="block text-sm font-medium text-gray-700 mb-2">
                    Thời gian dự kiến *
                  </label>
                  <input
                    type="time"
                    id="time"
                    required
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="note" className="block text-sm font-medium text-gray-700 mb-2">
                Lời nhắn cho Mentor (Không bắt buộc)
              </label>
              <textarea
                id="note"
                rows={4}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Bạn muốn học gì? Có chủ đề cụ thể nào không?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600 focus:border-transparent resize-none"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push('/discover')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting || (usesAvailableSlot && (slotsLoading || !selectedSlotId)) || learningContextLoading || Boolean(learningSpaceId && !learningContext) || (currentUser?.givePoints ?? 0) < 1}
                className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-medium hover:bg-purple-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Đang đặt lịch...' : 'Đặt lịch (1 điểm)'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
