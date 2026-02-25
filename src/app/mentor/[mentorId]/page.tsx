'use client'

import { useEffect, useState, use } from 'react'
import { getUserById } from '@/actions/user'
import { getReviewsWithReviewerDetails, getMentorRating } from '@/actions/booking'
import { getUserTeachingSkills } from '@/actions/user'
import { User, Review } from '@/types'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface ReviewWithReviewer {
  id: string
  bookingId: string
  receiverId: string
  authorId: string
  rating: number
  comment: string | null
  createdAt: Date
  reviewer: {
    id: string
    name: string | null
    avatarUrl: string | null
  }
  booking: any
}

export default function MentorProfilePage({ params }: { params: Promise<{ mentorId: string }> }) {
  const { mentorId } = use(params)
  const router = useRouter()
  
  const [mentor, setMentor] = useState<User | null>(null)
  const [teachingSkills, setTeachingSkills] = useState<string[]>([])
  const [reviews, setReviews] = useState<ReviewWithReviewer[]>([])
  const [rating, setRating] = useState<{ average: number; count: number }>({ average: 0, count: 0 })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function loadMentorProfile() {
      setIsLoading(true)
      
      const mentorData = await getUserById(mentorId)
      setMentor(mentorData)
      
      if (mentorData) {
        const skills = await getUserTeachingSkills(mentorId)
        setTeachingSkills(skills)
        
        const reviewsData = await getReviewsWithReviewerDetails(mentorId)
        setReviews(reviewsData)
        
        const ratingData = await getMentorRating(mentorId)
        setRating(ratingData)
      }
      
      setIsLoading(false)
    }

    loadMentorProfile()
  }, [mentorId])

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading mentor profile...</p>
        </div>
      </div>
    )
  }

  if (!mentor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Mentor Not Found</h2>
          <p className="text-gray-600 mb-4">This mentor profile could not be found.</p>
          <Link
            href="/discover"
            className="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition"
          >
            Back to Discovery
          </Link>
        </div>
      </div>
    )
  }

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`w-5 h-5 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-12">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {mentor.avatarUrl && (
                <Image
                  src={mentor.avatarUrl}
                  alt={mentor.name || 'Mentor'}
                  width={120}
                  height={120}
                  className="rounded-full ring-4 ring-white shadow-xl"
                />
              )}
              
              <div className="flex-1 text-center md:text-left">
                <h1 className="text-3xl font-bold text-white mb-2">
                  {mentor.name || 'Anonymous Mentor'}
                </h1>
                <p className="text-purple-100 mb-3">{mentor.email}</p>
                
                {rating.count > 0 ? (
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-4">
                    {renderStars(Math.round(rating.average))}
                    <span className="text-white font-semibold">
                      {rating.average.toFixed(1)}
                    </span>
                    <span className="text-purple-200 text-sm">
                      ({rating.count} review{rating.count !== 1 ? 's' : ''})
                    </span>
                  </div>
                ) : (
                  <p className="text-purple-200 text-sm mb-4">No reviews yet</p>
                )}

                <div className="flex items-center justify-center md:justify-start gap-2 text-white">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                  <span className="font-semibold">{mentor.givePoints} GivePoints</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 space-y-8">
            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">About</h2>
              {mentor.bio ? (
                <p className="text-gray-700 leading-relaxed">{mentor.bio}</p>
              ) : (
                <p className="text-gray-400 italic">No bio provided yet.</p>
              )}
            </section>

            <section>
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Teaching Skills</h2>
              {teachingSkills.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {teachingSkills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-4 py-2 bg-purple-100 text-purple-700 rounded-full font-medium"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400 italic">No teaching skills listed yet.</p>
              )}
            </section>

            <div className="border-t border-gray-200 pt-6">
              <Link
                href={`/book/${mentor.id}`}
                className="block w-full md:w-auto md:inline-block text-center bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition shadow-lg"
              >
                Book Session with {mentor.name?.split(' ')[0] || 'Mentor'} (1 pt)
              </Link>
            </div>

            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Reviews ({rating.count})
                </h2>
              </div>

              {reviews.length > 0 ? (
                <div className="space-y-6">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:border-purple-300 transition"
                    >
                      <div className="flex items-start gap-4">
                        {review.reviewer?.avatarUrl && (
                          <Image
                            src={review.reviewer.avatarUrl}
                            alt={review.reviewer.name || 'Reviewer'}
                            width={48}
                            height={48}
                            className="rounded-full ring-2 ring-purple-200"
                          />
                        )}
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {review.reviewer?.name || 'Anonymous'}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric'
                                })}
                              </p>
                            </div>
                            {renderStars(review.rating)}
                          </div>
                          
                          {review.comment && (
                            <p className="text-gray-700 leading-relaxed mt-3">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-12 text-center border-2 border-dashed border-purple-200">
                  <svg
                    className="w-16 h-16 text-purple-300 mx-auto mb-4"
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
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    No Reviews Yet
                  </h3>
                  <p className="text-gray-600 mb-6">
                    Be the first to book a session with {mentor.name?.split(' ')[0] || 'this mentor'} and leave a review!
                  </p>
                  <Link
                    href={`/book/${mentor.id}`}
                    className="inline-block bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
                  >
                    Book First Session
                  </Link>
                </div>
              )}
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
