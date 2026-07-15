'use client'

/**
 * BlindReviewSection — Two-way Blind Review.
 *
 * Drop-in replacement for the old "mentee review button/section" inside
 * `SessionDetailDialog`. It is self-contained: given only a `bookingId` and
 * the viewer's `currentUserId`, it fetches the current blind-review status
 * and renders the correct one of three states:
 *
 *   1. Needs Action    — "Write Review" button (mentee or mentor form).
 *   2. Pending Reveal  — I've reviewed, they haven't yet → 🔒 locked message.
 *   3. Revealed        — both reviews exist → show both, side by side.
 *
 * Mentee submissions reuse the existing `ReviewForm` UI/styling (exported
 * from `SessionDetailDialog`) so the look & feel stays identical to the
 * legacy one-way flow. Mentor submissions use the same `ReviewForm` with
 * mentor-appropriate copy — a "matching" form, per design.
 */

import { useCallback, useEffect, useState } from 'react'
import { ReviewForm, Info, PrimaryButton } from '@/components/SessionDetailDialog'
import {
  getBlindReviewStatus,
  submitMentorReview,
  submitMenteeReview,
  type BlindReviewStatus,
} from '@/actions/blind-review'
import { completeBooking } from '@/actions/booking'

interface BlindReviewSectionProps {
  booking: { id: string }
  currentUserId: string
}

export default function BlindReviewSection({ booking, currentUserId }: BlindReviewSectionProps) {
  const [status, setStatus] = useState<BlindReviewStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    console.log('[BlindReviewSection] fetching status for', {
      bookingId: booking.id,
      currentUserId,
    })
    const data = await getBlindReviewStatus(booking.id, currentUserId)
    console.log('[BlindReviewSection] getBlindReviewStatus →', data)
    setStatus(data)
    setLoading(false)
  }, [booking.id, currentUserId])

  useEffect(() => {
    setLoading(true)
    setShowForm(false)
    setRating(0)
    setHover(0)
    setComment('')
    setError(null)
    load()
  }, [load])

  const handleSubmit = async () => {
    if (rating === 0 || !status?.myRole) return
    setSubmitting(true)
    setError(null)
    try {
      const result =
        status.myRole === 'mentor'
          ? await submitMentorReview({
              bookingId: booking.id,
              rating,
              comment: comment.trim() || undefined,
            })
          : await submitMenteeReview({
              bookingId: booking.id,
              rating,
              comment: comment.trim() || undefined,
              receiverId: status.mentorId,
              authorId: status.menteeId,
            })

      if (result.success) {
        // Legacy behavior: submitting the mentee's review is what marks the
        // booking COMPLETED and transfers the GivePoint to the mentor. The
        // mentor's blind review has no such side effect.
        if (status.myRole === 'mentee') {
          await completeBooking(booking.id, currentUserId)
        }
        setShowForm(false)
        await load()
      } else {
        setError(result.message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Still fetching — render a tiny placeholder instead of `null` so the
  // section doesn't just vanish/flicker while `status` resolves.
  if (loading) {
    return <p className="text-xs text-gray-400 italic">Loading review status…</p>
  }

  if (!status) {
    console.warn('[BlindReviewSection] Booking not found — rendering nothing.', { bookingId: booking.id })
    return null
  }

  // ── State 3: Revealed — HIGHEST priority ────────────────────────────────
  // Once both sides have reviewed, the pair must ALWAYS be visible to the
  // participants. This is checked before the `myRole` guard below so a
  // `myRole` resolution edge-case can never hide an already-revealed pair.
  if (status.isReviewRevealed) {
    console.log('[BlindReviewSection] isReviewRevealed=true → showing Revealed state', status)
    return (
      <div className="space-y-2">
        <p className="text-xs font-bold text-gray-700">⭐ Reviews revealed</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <ReviewSummaryCard label="Mentee's review" entry={status.menteeReview} />
          <ReviewSummaryCard label="Mentor's review" entry={status.mentorReview} />
        </div>
      </div>
    )
  }

  // Not a participant in this booking — nothing else to render.
  if (!status.myRole) {
    console.warn(
      '[BlindReviewSection] currentUserId matches neither mentorId nor menteeId — not a participant. Rendering nothing.',
      { currentUserId, mentorId: status.mentorId, menteeId: status.menteeId, bookingId: booking.id }
    )
    return null
  }

  // ── State 2: Pending Reveal ────────────────────────────────────────────
  if (status.myReviewSubmitted) {
    console.log('[BlindReviewSection] myReviewSubmitted=true, waiting on the other side.', status)
    return <Info icon="🔒">Hidden until they review</Info>
  }

  // ── State 1: Needs Action ──────────────────────────────────────────────
  console.log('[BlindReviewSection] Needs Action — showing "Write review".', status)
  if (!showForm) {
    return (
      <div className="space-y-2">
        {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
        <PrimaryButton color="orange" onClick={() => setShowForm(true)} className="w-full">
          Write review
        </PrimaryButton>
      </div>
    )
  }

  return (
    <ReviewForm
      rating={rating}
      hover={hover}
      comment={comment}
      submitting={submitting}
      onRating={setRating}
      onHover={setHover}
      onComment={setComment}
      onSubmit={handleSubmit}
      onCancel={() => setShowForm(false)}
      title={status.myRole === 'mentor' ? 'Rate your mentee' : 'Rate your mentor'}
      submitLabel="Submit review"
    />
  )
}

function ReviewSummaryCard({
  label,
  entry,
}: {
  label: string
  entry: { rating: number; comment: string | null } | null
}) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-1">
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      {entry ? (
        <>
          <div className="text-sm">
            {'⭐'.repeat(entry.rating)}
            <span className="text-gray-300">{'⭐'.repeat(5 - entry.rating)}</span>
          </div>
          {entry.comment && <p className="text-xs text-gray-600 italic">&quot;{entry.comment}&quot;</p>}
        </>
      ) : (
        <p className="text-xs text-gray-400">No review</p>
      )}
    </div>
  )
}

