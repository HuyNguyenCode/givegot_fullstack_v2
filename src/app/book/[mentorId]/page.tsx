'use client'

import { useUser } from '@/contexts/UserContext'
import { useEffect, useState, use } from 'react'
import { getMentorById } from '@/actions/mentor'
import { createBooking } from '@/actions/booking'
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

export default function BookSessionPage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = use(params)
  const { currentUser, refreshUser } = useUser()
  const router = useRouter()
  const [mentor, setMentor] = useState<MentorWithSkills | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')

  useEffect(() => {
    async function loadMentor() {
      const mentorData = await getMentorById(mentorId)
      setMentor(mentorData)
      setIsLoading(false)
    }
    loadMentor()
  }, [mentorId])

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!currentUser || !mentor) return

    if (currentUser.id === mentor.id) {
      setError('Bạn không thể đặt lịch với chính mình!')
      return
    }

    if (!selectedDate || !selectedTime) {
      setError('Vui lòng chọn cả ngày và giờ cho buổi học.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    const startTime = new Date(`${selectedDate}T${selectedTime}:00`)
    const endTime = new Date(startTime)
    endTime.setHours(endTime.getHours() + 1)

    const result = await createBooking(
      mentor.id,
      currentUser.id,
      startTime,
      endTime,
      note
    )

    if (result.success) {
      await refreshUser()
      alert(`${result.message}`)
      router.push('/dashboard')
    } else {
      setError(result.message)
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
                  Giờ bắt đầu *
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
                disabled={isSubmitting || (currentUser?.givePoints ?? 0) < 1}
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
