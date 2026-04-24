'use client'

/**
 * SessionDetailDialog — shared "click-to-inspect" panel used by both
 * MentorCalendarManager (role = mentor/owner) and MenteeScheduleCalendar
 * (role = mentee). It reads role + time state and renders the correct set of
 * actions, calling server actions internally.
 */

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  acceptBooking,
  declineBooking,
  cancelBooking,
  reportNoShow,
  completeSessionWithReview,
} from '@/actions/booking'
import { deleteMentorSlot } from '@/actions/slots'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionRole = 'mentor' | 'mentee' | 'owner'

export interface SessionInfo {
  /** 'booking' = has a booking record; 'slot' = bare available slot with no booking */
  type: 'booking' | 'slot'
  role: SessionRole
  bookingId?: string
  slotId?: string
  bookingStatus?: string
  meetingUrl?: string | null
  note?: string | null
  isPast: boolean
  partner: {
    name: string | null
    email: string
    avatarUrl: string | null
  }
  startTime: Date
  endTime: Date
  sessionLabel: string
}

interface SessionDetailDialogProps {
  open: boolean
  session: SessionInfo | null
  currentUserId: string
  onClose: () => void
  /** Called after any mutation so the parent calendar can reload its data. */
  onMutate: () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, string> = {
  PENDING:   'bg-amber-100 text-amber-700',
  CONFIRMED: 'bg-blue-100  text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100   text-red-700',
  MISSED:    'bg-slate-100 text-slate-600',
  DISPUTED:  'bg-indigo-100 text-indigo-700',
}

const ROLE_GRADIENT: Record<SessionRole, string> = {
  mentor: 'from-purple-600 to-blue-600',
  mentee: 'from-orange-500 to-amber-400',
  owner:  'from-emerald-500 to-teal-500',
}

const ROLE_LABEL: Record<SessionRole, string> = {
  mentor: 'Teaching session',
  mentee: 'Learning session',
  owner:  'Available slot',
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SessionDetailDialog({
  open,
  session: s,
  currentUserId,
  onClose,
  onMutate,
}: SessionDetailDialogProps) {
  const [isLoading, setIsLoading]               = useState(false)
  const [showReview, setShowReview]             = useState(false)
  const [reviewRating, setReviewRating]         = useState(0)
  const [hoverRating, setHoverRating]           = useState(0)
  const [reviewComment, setReviewComment]       = useState('')
  const [isSubmitting, setIsSubmitting]         = useState(false)
  const [feedback, setFeedback]                 = useState<{ ok: boolean; msg: string } | null>(null)

  // Reset internal state whenever a new session is shown
  useEffect(() => {
    if (open) {
      setShowReview(false)
      setReviewRating(0)
      setHoverRating(0)
      setReviewComment('')
      setFeedback(null)
    }
  }, [open, s?.bookingId, s?.slotId])

  if (!open || !s) return null

  // Derived timing flags
  const now              = Date.now()
  const isNearSession    = !s.isPast
    && now >= new Date(s.startTime).getTime() - 10 * 60 * 1000
    && now <= new Date(s.endTime).getTime()
  const isWithin48h      = s.isPast
    && now <= new Date(s.endTime).getTime() + 48 * 60 * 60 * 1000

  // ── Action helpers ──────────────────────────────────────────────────────────

  const run = async (fn: () => Promise<{ success: boolean; message: string }>) => {
    setIsLoading(true); setFeedback(null)
    try {
      const r = await fn()
      if (r.success) { setFeedback({ ok: true, msg: r.message }); onMutate(); onClose() }
      else             setFeedback({ ok: false, msg: r.message })
    } catch {
      setFeedback({ ok: false, msg: 'Đã xảy ra lỗi. Vui lòng thử lại.' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAccept      = ()  => run(() => acceptBooking(s.bookingId!, currentUserId))
  const handleDecline     = ()  => {
    if (!window.confirm('Từ chối buổi học này? Học viên sẽ được hoàn điểm.')) return
    run(() => declineBooking(s.bookingId!, currentUserId))
  }
  const handleCancel      = ()  => {
    if (!window.confirm('Hủy buổi học này? Điểm Trust Score có thể bị trừ.')) return
    run(() => cancelBooking(s.bookingId!, currentUserId))
  }
  const handleReportNoShow = () => {
    if (!window.confirm('Báo cáo vắng mặt? Hệ thống sẽ xác minh qua Google Meet API.')) return
    run(() => reportNoShow(s.bookingId!, currentUserId))
  }
  const handleDeleteSlot  = ()  => {
    if (!window.confirm(`Xóa khung giờ này?\n${s.sessionLabel}`)) return
    run(() => deleteMentorSlot(s.slotId!, currentUserId))
  }
  const handleSubmitReview = async () => {
    if (reviewRating === 0) return
    setIsSubmitting(true); setFeedback(null)
    try {
      const r = await completeSessionWithReview(
        s.bookingId!, currentUserId, reviewRating, reviewComment.trim() || undefined,
      )
      if (r.success) { setFeedback({ ok: true, msg: r.message }); onMutate(); onClose() }
      else             setFeedback({ ok: false, msg: r.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

        {/* ── Colored header ──────────────────────────────────────────────── */}
        <div className={`bg-gradient-to-r ${ROLE_GRADIENT[s.role]} px-5 py-4 text-white`}>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                  {ROLE_LABEL[s.role]}
                </span>
                {s.isPast && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/20">
                    Đã qua
                  </span>
                )}
              </div>
              {/* Partner info */}
              {s.type === 'booking' && s.partner.name ? (
                <div className="flex items-center gap-2.5 mt-1">
                  {s.partner.avatarUrl ? (
                    <Image
                      src={s.partner.avatarUrl}
                      alt={s.partner.name}
                      width={36} height={36}
                      className="rounded-full ring-2 ring-white/40 shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-base font-bold shrink-0">
                      {s.partner.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight truncate">{s.partner.name}</p>
                    <p className="text-xs opacity-70 truncate">{s.partner.email}</p>
                  </div>
                </div>
              ) : (
                <p className="font-bold text-base mt-1">{s.sessionLabel}</p>
              )}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition mt-0.5 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Session meta */}
          <div className="bg-gray-50 rounded-xl p-3.5 space-y-2 text-sm">
            <MetaRow label="Thời gian" value={s.sessionLabel} />
            {s.type === 'booking' && s.bookingStatus && (
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Trạng thái</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[s.bookingStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                  {s.bookingStatus}
                </span>
              </div>
            )}
            {s.note && (
              <div className="pt-2 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic">"{s.note}"</p>
              </div>
            )}
          </div>

          {/* Feedback banner */}
          {feedback && (
            <div className={`rounded-xl px-4 py-3 text-sm font-medium border ${
              feedback.ok
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-red-50 border-red-200 text-red-700'
            }`}>
              {feedback.ok ? '✅ ' : '❌ '}{feedback.msg}
            </div>
          )}

          {/* ── Join Meeting (always shown when near session) ───────────── */}
          {isNearSession && s.meetingUrl && (
            <a
              href={s.meetingUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 bg-green-600 text-white rounded-xl text-sm font-bold hover:bg-green-700 transition shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Vào buổi học ngay
            </a>
          )}

          {/* ── Role: owner (available slot) ─────────────────────────────── */}
          {s.type === 'slot' && s.role === 'owner' && (
            s.isPast ? (
              <Info icon="⏰">Khung giờ này đã qua — không có hành động nào khả dụng.</Info>
            ) : (
              <DangerButton onClick={handleDeleteSlot} loading={isLoading}>
                Xóa khung giờ
              </DangerButton>
            )
          )}

          {/* ── Role: mentor ─────────────────────────────────────────────── */}
          {s.type === 'booking' && s.role === 'mentor' && (
            <div className="space-y-2">
              {/* Future PENDING → Accept / Decline */}
              {!s.isPast && s.bookingStatus === 'PENDING' && (
                <div className="flex gap-2">
                  <PrimaryButton
                    color="purple"
                    onClick={handleAccept}
                    loading={isLoading}
                    className="flex-1"
                  >
                    Chấp nhận
                  </PrimaryButton>
                  <DangerButton onClick={handleDecline} loading={isLoading} className="flex-1">
                    Từ chối
                  </DangerButton>
                </div>
              )}

              {/* Future CONFIRMED → Cancel + Chat */}
              {!s.isPast && s.bookingStatus === 'CONFIRMED' && (
                <div className="flex gap-2">
                  {s.bookingId && (
                    <ChatLink bookingId={s.bookingId} className="flex-1" />
                  )}
                  <DangerButton onClick={handleCancel} loading={isLoading} className="flex-1">
                    Hủy buổi
                  </DangerButton>
                </div>
              )}

              {/* Past PENDING → expired */}
              {s.isPast && s.bookingStatus === 'PENDING' && (
                <Info icon="⚠️">Yêu cầu đặt lịch này đã hết hạn — buổi học đã qua giờ bắt đầu.</Info>
              )}

              {/* Past CONFIRMED → view history */}
              {s.isPast && s.bookingStatus === 'CONFIRMED' && (
                <>
                  <Info icon="⏰">Buổi đã xác nhận nhưng đã qua. Kiểm tra lịch sử chat.</Info>
                  {s.bookingId && <ChatLink bookingId={s.bookingId} />}
                </>
              )}

              {/* COMPLETED / MISSED */}
              {(s.bookingStatus === 'COMPLETED' || s.bookingStatus === 'MISSED') && s.bookingId && (
                <ChatLink bookingId={s.bookingId} label="🎓 Xem lịch sử chat" />
              )}

              {/* DISPUTED */}
              {s.bookingStatus === 'DISPUTED' && (
                <Info icon="⚖️">Buổi học đang được Admin xem xét. Điểm đang bị giữ lại.</Info>
              )}
            </div>
          )}

          {/* ── Role: mentee ─────────────────────────────────────────────── */}
          {s.type === 'booking' && s.role === 'mentee' && (
            <div className="space-y-2">
              {/* Future PENDING → Cancel */}
              {!s.isPast && s.bookingStatus === 'PENDING' && (
                <DangerButton onClick={handleCancel} loading={isLoading}>
                  Hủy đặt lịch
                </DangerButton>
              )}

              {/* Future CONFIRMED → Review / Cancel / Chat */}
              {!s.isPast && s.bookingStatus === 'CONFIRMED' && (
                <>
                  {!showReview ? (
                    <PrimaryButton color="orange" onClick={() => setShowReview(true)} className="w-full">
                      Nộp đánh giá &amp; Hoàn thành
                    </PrimaryButton>
                  ) : (
                    <ReviewForm
                      rating={reviewRating}
                      hover={hoverRating}
                      comment={reviewComment}
                      submitting={isSubmitting}
                      onRating={setReviewRating}
                      onHover={setHoverRating}
                      onComment={setReviewComment}
                      onSubmit={handleSubmitReview}
                      onCancel={() => setShowReview(false)}
                    />
                  )}
                  <div className="flex gap-2">
                    {s.bookingId && <ChatLink bookingId={s.bookingId} className="flex-1" />}
                    <DangerButton onClick={handleCancel} loading={isLoading} className="flex-1">
                      Hủy buổi
                    </DangerButton>
                  </div>
                </>
              )}

              {/* Past CONFIRMED — Report No-Show (within 48 h) */}
              {s.isPast && s.bookingStatus === 'CONFIRMED' && (
                <div className="space-y-2">
                  {isWithin48h ? (
                    <>
                      <Info icon="⚠️">
                        Gia sư không đến? Bạn có thể báo cáo trong vòng 48 giờ sau buổi học.
                      </Info>
                      <DangerButton
                        onClick={handleReportNoShow}
                        loading={isLoading}
                        className="!bg-red-600 hover:!bg-red-700 text-white"
                      >
                        🚨 Báo cáo vắng mặt
                      </DangerButton>
                    </>
                  ) : (
                    <Info icon="🔒">Thời hạn 48 giờ để báo cáo đã hết.</Info>
                  )}
                  {s.bookingId && <ChatLink bookingId={s.bookingId} />}
                </div>
              )}

              {/* COMPLETED / MISSED */}
              {(s.bookingStatus === 'COMPLETED' || s.bookingStatus === 'MISSED') && s.bookingId && (
                <ChatLink bookingId={s.bookingId} label="🎓 Xem lịch sử chat" />
              )}

              {/* DISPUTED */}
              {s.bookingStatus === 'DISPUTED' && (
                <>
                  <Info icon="⚖️">Tranh chấp đang được Admin xem xét. Điểm đang bị giữ.</Info>
                  {s.bookingId && <ChatLink bookingId={s.bookingId} />}
                </>
              )}

              {/* Past PENDING */}
              {s.isPast && s.bookingStatus === 'PENDING' && (
                <Info icon="⚠️">Yêu cầu đặt lịch đã hết hạn — gia sư không phản hồi.</Info>
              )}
            </div>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small helper sub-components ───────────────────────────────────────────────

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-semibold text-gray-800 text-right">{value}</span>
    </div>
  )
}

function Info({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700">
      <span className="shrink-0 text-base">{icon}</span>
      <span>{children}</span>
    </div>
  )
}

function PrimaryButton({
  children,
  color,
  onClick,
  loading,
  className = '',
}: {
  children: React.ReactNode
  color: 'purple' | 'orange' | 'blue'
  onClick?: () => void
  loading?: boolean
  className?: string
}) {
  const colors = {
    purple: 'bg-purple-600 hover:bg-purple-700',
    orange: 'bg-orange-500 hover:bg-orange-600',
    blue:   'bg-blue-600 hover:bg-blue-700',
  }
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`py-2.5 text-sm font-semibold text-white rounded-xl transition disabled:opacity-50 ${colors[color]} ${className}`}
    >
      {loading ? '…' : children}
    </button>
  )
}

function DangerButton({
  children,
  onClick,
  loading,
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  loading?: boolean
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`py-2.5 text-sm font-semibold rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition disabled:opacity-50 ${className}`}
    >
      {loading ? '…' : children}
    </button>
  )
}

function ChatLink({
  bookingId,
  label = '💬 Nhắn tin',
  className = 'w-full',
}: {
  bookingId: string
  label?: string
  className?: string
}) {
  return (
    <Link
      href={`/chat?bookingId=${bookingId}`}
      className={`block py-2.5 text-sm font-semibold text-center rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition ${className}`}
    >
      {label}
    </Link>
  )
}

function ReviewForm({
  rating, hover, comment, submitting,
  onRating, onHover, onComment, onSubmit, onCancel,
}: {
  rating: number; hover: number; comment: string; submitting: boolean
  onRating: (n: number) => void; onHover: (n: number) => void
  onComment: (s: string) => void; onSubmit: () => void; onCancel: () => void
}) {
  return (
    <div className="border border-orange-200 rounded-xl p-4 space-y-3 bg-orange-50">
      <p className="text-xs font-bold text-orange-900">Đánh giá buổi học</p>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star} type="button"
            onClick={() => onRating(star)}
            onMouseEnter={() => onHover(star)}
            onMouseLeave={() => onHover(0)}
            className="text-2xl leading-none transition-transform hover:scale-110"
          >
            {star <= (hover || rating) ? '⭐' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        rows={2}
        value={comment}
        onChange={e => onComment(e.target.value)}
        placeholder="Chia sẻ trải nghiệm của bạn (tùy chọn)…"
        className="w-full text-xs px-3 py-2 border border-orange-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-orange-400 bg-white"
        maxLength={300}
      />
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition"
        >
          Hủy
        </button>
        <button
          onClick={onSubmit}
          disabled={submitting || rating === 0}
          className="flex-1 py-1.5 text-xs font-bold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {submitting ? 'Đang gửi…' : 'Gửi & Hoàn thành (1 điểm → gia sư)'}
        </button>
      </div>
    </div>
  )
}
