'use client'

import { useUser } from '@/contexts/UserContext'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { currentUser, isLoading } = useUser()
  const router = useRouter()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    )
  }

  // DevMode: show fallback when no user selected. Production: middleware redirects before we get here.
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Không Tìm Thấy Người Dùng</h2>
          <p className="text-gray-600">Vui lòng chọn một người dùng từ bộ chuyển đổi phía trên.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50">
      <main className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Chào mừng đến với <span className="text-purple-600">GiveGot</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Nền tảng Mentorship Time-Banking: Dạy 1 giờ, kiếm 1 điểm.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12 max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-purple-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                Số dư của Bạn
              </h2>
              <div className="bg-purple-100 p-3 rounded-full">
                <svg
                  className="w-8 h-8 text-purple-600"
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
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-5xl font-bold text-purple-600">
                {currentUser.givePoints}
              </span>
              <span className="text-xl text-gray-600">GivePoints</span>
            </div>
            <p className="text-sm text-gray-500">
              {currentUser.givePoints === 0
                ? 'Bạn cần điểm để đặt lịch buổi học. Hãy dạy để kiếm thêm điểm!'
                : currentUser.givePoints < 3
                ? 'Điểm đang cạn dần! Hãy dạy thêm để kiếm nhiều điểm hơn.'
                : 'Bạn có đủ điểm để đặt lịch buổi học!'}
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8 border-t-4 border-blue-600">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-semibold text-gray-800">
                Hồ sơ của Bạn
              </h2>
              <div className="bg-blue-100 p-3 rounded-full">
                <svg
                  className="w-8 h-8 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {currentUser.avatarUrl && (
                  <Link href="/profile" className="hover:opacity-80 transition-all hover:cursor-pointer">
                    <Image
                      src={currentUser.avatarUrl}
                      alt={currentUser.name || 'Người dùng'}
                      width={56}
                      height={56}
                      className="rounded-full"
                    />
                  </Link>
                )}
                <div>
                  <Link href="/profile" className="hover:text-blue-600 transition-all hover:cursor-pointer">
                    <p className="font-semibold text-gray-900 text-lg">
                      {currentUser.name || 'Người dùng ẩn danh'}
                    </p>
                  </Link>
                  <p className="text-sm text-gray-500">{currentUser.email}</p>
                </div>
              </div>
              {currentUser.bio && (
                <p className="text-sm text-gray-600 mt-3 italic line-clamp-2">
                  {currentUser.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 justify-center mb-12 max-w-5xl mx-auto">
          <Link
            href="/discover"
            className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-purple-700 transition shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Khám phá
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-blue-700 transition shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Bảng điều khiển
          </Link>
          <Link
            href="/history"
            className="flex items-center justify-center gap-2 bg-green-600 text-white px-6 py-4 rounded-lg font-semibold hover:bg-green-700 transition shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Lịch sử
          </Link>
          <Link
            href="/profile"
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Hồ sơ
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-semibold text-gray-800 mb-6 text-center">
            Time-Banking Hoạt Động Như Thế Nào
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-purple-50 rounded-xl">
              <div className="text-5xl mb-3">🎯</div>
              <h4 className="font-semibold text-purple-900 mb-2 text-lg">
                1. Tìm Mentor
              </h4>
              <p className="text-sm text-purple-700">
                Tìm mentor dạy những kỹ năng bạn muốn học
              </p>
            </div>
            <div className="text-center p-6 bg-blue-50 rounded-xl">
              <div className="text-5xl mb-3">📅</div>
              <h4 className="font-semibold text-blue-900 mb-2 text-lg">
                2. Đặt Lịch Học
              </h4>
              <p className="text-sm text-blue-700">
                1 buổi học 1 giờ = 1 GivePoint (giữ lại cho đến khi hoàn thành)
              </p>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-xl">
              <div className="text-5xl mb-3">✨</div>
              <h4 className="font-semibold text-green-900 mb-2 text-lg">
                3. Hoàn Thành & Chuyển Điểm
              </h4>
              <p className="text-sm text-green-700">
                Sau buổi học, điểm sẽ được chuyển cho mentor của bạn
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
