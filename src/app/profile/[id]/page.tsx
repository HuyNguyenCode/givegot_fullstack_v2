import { notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserTeachingSkills } from '@/actions/user'
import {
  getReviewsWithReviewerDetails,
  getMentorRating,
  checkReviewGate,
} from '@/actions/booking'
import { getUserTrustDashboard } from '@/actions/analytics'
import TrustReputationCard from '@/components/TrustReputationCard'
import MenteeBookingCalendar from '@/components/MenteeBookingCalendar'
import Image from 'next/image'
import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${dim} ${s <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300 fill-current'}`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  )
}

// ── Page (Server Component) ───────────────────────────────────────────────────

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  // ── 1. Fetch profile subject ───────────────────────────────────────────────
  const profileUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      bio: true,
      givePoints: true,
      trustScore: true,
      isSuspended: true,
    },
  })

  if (!profileUser) notFound()

  // ── 2. Current session & ownership ────────────────────────────────────────
  const session = await auth()
  const viewerId = session?.user?.id ?? null
  const isOwner = viewerId === profileUser.id

  // ── 3. Parallel data fetches for the profile ───────────────────────────────
  const [teachingSkills, reviews, rating, trustData] = await Promise.all([
    getUserTeachingSkills(id),
    getReviewsWithReviewerDetails(id),
    getMentorRating(id),
    getUserTrustDashboard(id),
  ])

  // ── 4. Viewer-specific data (review gate + points balance) ─────────────────
  // Only needed when someone else is viewing the profile so they can book.
  type ReviewGate = Awaited<ReturnType<typeof checkReviewGate>>
  let reviewGate: ReviewGate = { blocked: false, pendingCount: 0, sessions: [] }
  let viewerPoints = 0

  if (viewerId && !isOwner) {
    const [gate, viewer] = await Promise.all([
      checkReviewGate(viewerId),
      prisma.user.findUnique({ where: { id: viewerId }, select: { givePoints: true } }),
    ])
    reviewGate = gate
    viewerPoints = viewer?.givePoints ?? 0
  }

  const hasTeachingSkills = teachingSkills.length > 0
  const firstName = profileUser.name?.split(' ')[0] ?? 'this mentor'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* ── Back navigation ─────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/discover"
            className="inline-flex items-center gap-1.5 text-purple-600 hover:text-purple-700 font-medium transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Discover
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">

          {/* ═══════════════════════════════════════════════════════════════
              HERO HEADER
          ═══════════════════════════════════════════════════════════════ */}
          <div className="relative bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-12">
            {/* Owner: Edit Profile shortcut */}
            {isOwner && (
              <div className="absolute top-5 right-6">
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-4 py-2 rounded-lg ring-1 ring-white/30 transition backdrop-blur-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </Link>
              </div>
            )}

            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                {profileUser.avatarUrl ? (
                  <Image
                    src={profileUser.avatarUrl}
                    alt={profileUser.name ?? 'Profile'}
                    width={120}
                    height={120}
                    className="rounded-full ring-4 ring-white shadow-xl"
                  />
                ) : (
                  <div className="w-[120px] h-[120px] rounded-full ring-4 ring-white shadow-xl bg-purple-400 flex items-center justify-center">
                    <span className="text-4xl font-bold text-white">
                      {(profileUser.name ?? profileUser.email)[0].toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name + meta */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                  <h1 className="text-3xl font-bold text-white">
                    {profileUser.name ?? 'Anonymous User'}
                  </h1>
                  {profileUser.trustScore >= 85 && (
                    <span className="inline-flex items-center gap-1 bg-emerald-400/30 text-emerald-100 text-xs font-semibold px-2.5 py-1 rounded-full ring-1 ring-emerald-300/50">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      High Trust
                    </span>
                  )}
                </div>

                <p className="text-purple-200 text-sm mb-4">{profileUser.email}</p>

                {/* Stats row */}
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm">
                  {rating.count > 0 && (
                    <div className="flex items-center gap-1.5">
                      <StarRating rating={Math.round(rating.average)} />
                      <span className="text-white font-semibold">{rating.average.toFixed(1)}</span>
                      <span className="text-purple-200">
                        ({rating.count} review{rating.count !== 1 ? 's' : ''})
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-white">
                    <svg className="w-4 h-4 text-purple-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                    <span className="font-semibold">
                      {trustData.breakdown.completedSessions} session{trustData.breakdown.completedSessions !== 1 ? 's' : ''} completed
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-white">
                    <svg className="w-4 h-4 text-purple-200" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">{profileUser.givePoints} GivePoints</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════
              CONTENT BODY
          ═══════════════════════════════════════════════════════════════ */}
          <div className="divide-y divide-gray-100">

            {/* ── About ─────────────────────────────────────────────────── */}
            <section className="px-8 py-8">
              <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                About
              </h2>
              {profileUser.bio ? (
                <p className="text-gray-700 leading-relaxed">{profileUser.bio}</p>
              ) : (
                <p className="text-gray-400 italic">No bio provided yet.</p>
              )}
            </section>

            {/* ── Trust & Reputation ────────────────────────────────────── */}
            <section className="px-8 py-8">
              <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Trust &amp; Reputation
              </h2>
              <p className="text-sm text-gray-500 mb-4 ml-7">
                {isOwner
                  ? 'Your reputation score and score breakdown'
                  : 'Based on completed sessions, ratings, and reliability'}
              </p>
              {/* isOwner=true → shows breakdown + action warning; isOwner=false → gauge + badges only */}
              <TrustReputationCard data={trustData} isOwner={isOwner} />
            </section>

            {/* ── Mentor Section (teaching skills + booking) ────────────── */}
            {hasTeachingSkills && (
              <section className="px-8 py-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Teaching Skills
                </h2>

                <div className="flex flex-wrap gap-3 mb-8">
                  {teachingSkills.map((skill) => (
                    <span
                      key={skill.id}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-medium ${
                        skill.isVerified
                          ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white ring-2 ring-purple-300 shadow-md'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {skill.isVerified && (
                        <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
                          <title>AI Verified Skill</title>
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                      {skill.name}
                      {skill.isVerified && (
                        <span className="text-xs bg-yellow-300 text-purple-900 px-2 py-0.5 rounded-full font-bold">
                          Verified
                        </span>
                      )}
                    </span>
                  ))}
                </div>

                {/* ── Booking ───────────────────────────────────────────── */}
                {isOwner ? (
                  // Owner sees a management shortcut instead of the booking form
                  <div className="bg-purple-50 border border-purple-200 rounded-xl p-5 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-purple-900">Manage your availability</p>
                      <p className="text-sm text-purple-700 mt-0.5">
                        Set the time slots when you are available to mentor others.
                      </p>
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
                    >
                      Go to Dashboard →
                    </Link>
                  </div>
                ) : viewerId ? (
                  // Logged-in visitor: show review gate warning + calendar
                  <>
                    {reviewGate.blocked && (
                      <div className="mb-6 bg-amber-50 border-2 border-amber-400 rounded-xl p-5 flex gap-4 items-start shadow-sm">
                        <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-amber-900">
                            ⚠️ Action Required: Review Past Sessions to Unlock Booking
                          </p>
                          <p className="text-sm text-amber-800 mt-1 mb-3">
                            You have{' '}
                            <strong>
                              {reviewGate.pendingCount} session{reviewGate.pendingCount !== 1 ? 's' : ''}
                            </strong>{' '}
                            that ended over 24 hours ago without a review.
                          </p>
                          <ul className="space-y-1 mb-4">
                            {reviewGate.sessions.map((s) => (
                              <li key={s.bookingId} className="flex items-center gap-2 text-xs text-amber-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                                Session with <span className="font-semibold">{s.mentorName}</span> on{' '}
                                {new Date(s.sessionDate).toLocaleDateString('en-US', {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                })}
                              </li>
                            ))}
                          </ul>
                          <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition shadow-sm"
                          >
                            Submit Review(s) in Dashboard
                          </Link>
                        </div>
                      </div>
                    )}

                    <MenteeBookingCalendar
                      mentorId={profileUser.id}
                      mentorName={profileUser.name ?? 'Mentor'}
                      currentUserId={viewerId}
                      currentUserPoints={viewerPoints}
                      bookingDisabled={reviewGate.blocked}
                      pendingReviewCount={reviewGate.pendingCount}
                    />
                  </>
                ) : (
                  // Logged-out visitor: prompt to sign in
                  <div className="bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-200 rounded-xl p-8 text-center">
                    <svg className="w-12 h-12 text-purple-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-gray-800 mb-1">
                      Book a Session with {firstName}
                    </h3>
                    <p className="text-sm text-gray-500 mb-4">
                      Sign in to view available slots and book your first session.
                    </p>
                    <Link
                      href="/auth/signin"
                      className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg transition"
                    >
                      Sign In to Book
                    </Link>
                  </div>
                )}
              </section>
            )}

            {/* ── Reviews ───────────────────────────────────────────────── */}
            <section id="reviews" className="px-8 py-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Reviews
                <span className="ml-1 text-sm font-normal text-gray-500">({rating.count})</span>
              </h2>

              {reviews.length > 0 ? (
                <div className="space-y-5">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      className="bg-gray-50 rounded-xl p-6 border border-gray-200 hover:border-purple-200 transition"
                    >
                      <div className="flex items-start gap-4">
                        {review.reviewer?.avatarUrl ? (
                          <Image
                            src={review.reviewer.avatarUrl}
                            alt={review.reviewer.name ?? 'Reviewer'}
                            width={44}
                            height={44}
                            className="rounded-full ring-2 ring-purple-100 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full ring-2 ring-purple-100 bg-purple-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-purple-700">
                              {(review.reviewer?.name ?? '?')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                            <div>
                              <p className="font-semibold text-gray-900 text-sm">
                                {review.reviewer?.name ?? 'Anonymous'}
                              </p>
                              <p className="text-xs text-gray-400">
                                {new Date(review.createdAt).toLocaleDateString('en-US', {
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </p>
                            </div>
                            <StarRating rating={review.rating} size="sm" />
                          </div>
                          {review.comment && (
                            <p className="text-gray-700 leading-relaxed text-sm mt-2">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-12 text-center border-2 border-dashed border-purple-200">
                  <svg className="w-14 h-14 text-purple-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                  <h3 className="text-lg font-bold text-gray-800 mb-2">No Reviews Yet</h3>
                  <p className="text-gray-500 text-sm">
                    Be the first to book a session with {firstName} and leave a review!
                  </p>
                </div>
              )}
            </section>

          </div>
        </div>
      </main>
    </div>
  )
}
