'use client'

import { useUser } from '@/contexts/UserContext'
import { useEffect, useState } from 'react'
import { getAutoMatchedMentors } from '@/actions/mentor'
import { getMentorRating } from '@/actions/booking'
import Image from 'next/image'
import Link from 'next/link'

interface MentorMatch {
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
  }>
  matchedSkills: string[]
  matchScore: number
  rating?: {
    average: number
    count: number
  }
}

export default function DiscoverPage() {
  const { currentUser, isLoading: userLoading } = useUser()
  const [bestMatches, setBestMatches] = useState<MentorMatch[]>([])
  const [otherMentors, setOtherMentors] = useState<MentorMatch[]>([])
  const [userGoals, setUserGoals] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadMentors() {
      if (!currentUser) return
      
      setIsLoading(true)
      const result = await getAutoMatchedMentors(currentUser.id)
      
      const bestMatchesWithRatings = await Promise.all(
        result.bestMatches.map(async (mentor) => {
          const rating = await getMentorRating(mentor.id)
          return { ...mentor, rating }
        })
      )
      
      const otherMentorsWithRatings = await Promise.all(
        result.otherMentors.map(async (mentor) => {
          const rating = await getMentorRating(mentor.id)
          return { ...mentor, rating }
        })
      )
      
      setBestMatches(bestMatchesWithRatings)
      setOtherMentors(otherMentorsWithRatings)
      setUserGoals(result.userLearningGoals)
      setIsLoading(false)
    }

    loadMentors()
  }, [currentUser])

  if (userLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding your perfect mentors...</p>
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

  const renderMentorCard = (mentor: MentorMatch, isMatch: boolean = false) => (
    <div
      key={mentor.id}
      className={`bg-white rounded-lg shadow-md hover:shadow-xl transition-all p-6 border-2 ${
        isMatch ? 'border-green-400 bg-gradient-to-br from-white to-green-50' : 'border-gray-200'
      }`}
    >
      {isMatch && (
        <div className="flex items-center gap-2 mb-3 bg-green-100 px-3 py-1.5 rounded-lg">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-bold text-green-800">
            {mentor.matchScore} Skill{mentor.matchScore > 1 ? 's' : ''} Match!
          </span>
        </div>
      )}

      <div className="flex items-start gap-4 mb-4">
        <Link href={`/mentor/${mentor.id}`} className="flex-shrink-0 group">
          {mentor.avatarUrl && (
            <Image
              src={mentor.avatarUrl}
              alt={mentor.name || 'Mentor'}
              width={64}
              height={64}
              className="rounded-full ring-2 ring-purple-200 group-hover:ring-purple-400 transition-all group-hover:scale-105"
            />
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <Link href={`/mentor/${mentor.id}`} className="group">
            <h3 className="text-lg font-semibold text-gray-900 truncate group-hover:text-purple-600 transition-colors">
              {mentor.name || 'Anonymous Mentor'}
            </h3>
          </Link>
          <p className="text-sm text-gray-500">{mentor.email}</p>
          {mentor.rating && mentor.rating.count > 0 && (
            <Link href={`/mentor/${mentor.id}`} className="inline-block group">
              <div className="flex items-center gap-2 mt-1 group-hover:opacity-80 transition-opacity">
                <div className="flex items-center gap-1">
                  <svg className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span className="text-sm font-semibold text-gray-900">
                    {mentor.rating.average.toFixed(1)}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  ({mentor.rating.count} review{mentor.rating.count !== 1 ? 's' : ''})
                </span>
              </div>
            </Link>
          )}
          {mentor.rating && mentor.rating.count === 0 && (
            <p className="text-xs text-gray-400 mt-1">No reviews yet</p>
          )}
        </div>
      </div>

      {mentor.bio && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-3">
          {mentor.bio}
        </p>
      )}

      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">
          Teaching Skills:
        </h4>
        <div className="flex flex-wrap gap-2">
          {mentor.teachingSkills.map((skill) => {
            const isMatched = mentor.matchedSkills.includes(skill.name)
            return (
              <span
                key={skill.id}
                className={`px-3 py-1 text-xs font-medium rounded-full ${
                  isMatched
                    ? 'bg-green-500 text-white ring-2 ring-green-300 shadow-sm'
                    : 'bg-purple-100 text-purple-700'
                }`}
              >
                {skill.name}
                {isMatched && ' ✓'}
              </span>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Link
          href={`/book/${mentor.id}`}
          className={`block w-full text-white text-center py-2.5 rounded-lg font-medium transition ${
            isMatch
              ? 'bg-green-600 hover:bg-green-700 shadow-md'
              : 'bg-purple-600 hover:bg-purple-700'
          }`}
        >
          Book Session (1 pt)
        </Link>
        <Link
          href={`/mentor/${mentor.id}`}
          className="block text-center text-sm text-purple-600 hover:text-purple-700 font-medium transition"
        >
          View Full Profile & Reviews →
        </Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Smart Mentor Discovery</h1>
          </div>
          <p className="text-gray-600 ml-14">
            AI-powered matching based on your learning goals
          </p>
          
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 bg-purple-100 px-4 py-2 rounded-lg">
              <svg
                className="w-5 h-5 text-purple-600"
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
              <span className="text-sm font-semibold text-purple-900">
                Your Balance: {currentUser.givePoints} GivePoints
              </span>
            </div>

            {userGoals.length > 0 && (
              <div className="inline-flex items-center gap-2 bg-blue-100 px-4 py-2 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span className="text-sm font-medium text-blue-900">
                  Learning: {userGoals.join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {bestMatches.length === 0 && otherMentors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              No Mentors Available
            </h2>
            <p className="text-gray-600">
              There are no mentors available at the moment. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            {bestMatches.length > 0 && (
              <section>
                <div className="mb-6 bg-gradient-to-r from-green-600 to-emerald-600 rounded-xl p-6 shadow-lg">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-white/20 p-2 rounded-lg">
                      <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        ✨ Best Matches for You
                      </h2>
                      <p className="text-green-100 text-sm">
                        These mentors teach skills you want to learn
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full">
                      {bestMatches.length} Perfect {bestMatches.length === 1 ? 'Match' : 'Matches'}
                    </span>
                    <span className="text-green-100 text-sm">
                      Priority recommendations
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {bestMatches.map((mentor) => renderMentorCard(mentor, true))}
                </div>
              </section>
            )}

            {otherMentors.length > 0 && (
              <section>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="bg-gray-100 p-2 rounded-lg">
                      <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">
                        Explore Other Mentors
                      </h2>
                      <p className="text-gray-600 text-sm">
                        Discover mentors teaching different skills
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {otherMentors.map((mentor) => renderMentorCard(mentor, false))}
                </div>
              </section>
            )}
          </div>
        )}

        {bestMatches.length === 0 && otherMentors.length === 0 && userGoals.length === 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-dashed border-blue-300 rounded-xl p-8 text-center">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              Set Your Learning Goals
            </h3>
            <p className="text-gray-600 mb-4">
              Define what skills you want to learn to get personalized mentor recommendations!
            </p>
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition">
              Add Learning Goals
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
