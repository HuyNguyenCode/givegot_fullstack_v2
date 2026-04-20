'use client'

import Image from 'next/image'
import Link from 'next/link'
import { PopularMentor } from '@/actions/analytics'

interface Props {
  data: PopularMentor[]
  isLoading?: boolean
}

const RANK_STYLES: Record<number, { badge: string; text: string }> = {
  1: { badge: 'bg-yellow-400 text-yellow-900', text: '#f59e0b' },
  2: { badge: 'bg-gray-300 text-gray-700', text: '#9ca3af' },
  3: { badge: 'bg-amber-600 text-amber-100', text: '#b45309' },
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`w-3.5 h-3.5 ${star <= Math.round(rating) ? 'text-yellow-400 fill-current' : 'text-gray-200 fill-current'}`}
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
      <span className="ml-1 text-xs font-semibold text-gray-600">{rating > 0 ? rating.toFixed(1) : '—'}</span>
    </div>
  )
}

export default function MentorLeaderboard({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="w-10 h-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-2.5 bg-gray-200 rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-48 flex flex-col items-center justify-center text-gray-400">
        <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm">No completed sessions yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {data.map((mentor, idx) => {
        const rank = idx + 1
        const rankStyle = RANK_STYLES[rank]
        return (
          <div
            key={mentor.id}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors group"
          >
            {/* Rank badge */}
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                rankStyle
                  ? rankStyle.badge
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {rank}
            </div>

            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {mentor.avatarUrl ? (
                <Image
                  src={mentor.avatarUrl}
                  alt={mentor.name}
                  width={40}
                  height={40}
                  className="rounded-full ring-2 ring-gray-100 group-hover:ring-purple-200 transition-all"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-blue-500 flex items-center justify-center ring-2 ring-gray-100">
                  <span className="text-white text-sm font-bold">
                    {mentor.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              {rank === 1 && (
                <span className="absolute -top-1 -right-1 text-sm">👑</span>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <Link
                href={`/discover?mentor=${mentor.id}`}
                className="text-sm font-semibold text-gray-900 hover:text-purple-600 transition-colors truncate block"
              >
                {mentor.name}
              </Link>
              {mentor.topSkill && (
                <span className="inline-block text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded-md font-medium mt-0.5 truncate max-w-[120px]">
                  {mentor.topSkill}
                </span>
              )}
            </div>

            {/* Stats */}
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-gray-800">
                {mentor.totalSessions}
                <span className="text-xs font-normal text-gray-500 ml-0.5">sessions</span>
              </p>
              <StarRating rating={mentor.avgRating} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
