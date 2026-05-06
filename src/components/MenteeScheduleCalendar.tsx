'use client'

/**
 * MenteeScheduleCalendar — read-only FullCalendar showing only the sessions
 * where the current user is the MENTEE (learning view). Clicking an event opens
 * the shared SessionDetailDialog with mentee-appropriate actions.
 */

import { useState, useEffect, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import type { EventInput, EventClickArg } from '@fullcalendar/core'
import { differenceInHours } from 'date-fns'
import { getMyBookings } from '@/actions/booking'
import { BookingWithDetails } from '@/types'
import SessionDetailDialog, { SessionInfo } from '@/components/SessionDetailDialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MenteeScheduleCalendarProps {
  currentUserId: string
  onDataChange?: () => void
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let _tc = 0

// ── Orange-palette color resolver ─────────────────────────────────────────────

interface EventStyle {
  bgColor: string
  borderColor: string
  textColor: string
  icon: string
  label: string
}

function resolveStyle(
  status: string,
  sessionEnded: boolean,
  awaitingReview: boolean,
): EventStyle {
  if (awaitingReview) {
    return {
      bgColor: '#fef3c7',
      borderColor: '#fbbf24',
      textColor: '#78350f',
      icon: '⭐',
      label: 'Chờ đánh giá',
    }
  }
  if (sessionEnded) {
    return {
      bgColor: '#e2e8f0', borderColor: '#94a3b8', textColor: '#475569',
      icon: '⏰', label: 'Đã qua',
    }
  }
  const map: Record<string, EventStyle> = {
    PENDING:   { bgColor: '#f59e0b', borderColor: '#d97706', textColor: '#fff', icon: '⏳', label: 'Chờ xác nhận' },
    CONFIRMED: { bgColor: '#f97316', borderColor: '#ea580c', textColor: '#fff', icon: '📚', label: 'Đã xác nhận' },
    COMPLETED: { bgColor: '#22c55e', borderColor: '#16a34a', textColor: '#fff', icon: '🎓', label: 'Hoàn thành'   },
    CANCELLED: { bgColor: '#94a3b8', borderColor: '#64748b', textColor: '#fff', icon: '✕',  label: 'Đã hủy'       },
    MISSED:    { bgColor: '#e2e8f0', borderColor: '#94a3b8', textColor: '#475569', icon: '⏰', label: 'Vắng mặt' },
    DISPUTED:  { bgColor: '#f59e0b', borderColor: '#d97706', textColor: '#fff', icon: '⚖️', label: 'Tranh chấp'   },
  }
  return map[status] ?? { bgColor: '#f97316', borderColor: '#ea580c', textColor: '#fff', icon: '?', label: status }
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const day = start.toLocaleDateString('vi-VN', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  return `${day}, ${fmt(start)} – ${fmt(end)}`
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MenteeScheduleCalendar({
  currentUserId,
  onDataChange,
}: MenteeScheduleCalendarProps) {
  const [mounted, setMounted]         = useState(false)
  const [isLoading, setIsLoading]     = useState(false)
  const [bookings, setBookings]       = useState<BookingWithDetails[]>([])
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
  const [dialogOpen, setDialogOpen]   = useState(false)
  const [toasts, setToasts]           = useState<Toast[]>([])

  useEffect(() => setMounted(true), [])

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = ++_tc
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await getMyBookings(currentUserId)
      setBookings(result.asMentee as BookingWithDetails[])
    } finally {
      setIsLoading(false)
    }
  }, [currentUserId])

  useEffect(() => { loadData() }, [loadData])

  const now = new Date()

  // ── Build FullCalendar events ────────────────────────────────────────────

  const calendarEvents: EventInput[] = bookings.map(b => {
    const end = new Date(b.endTime)
    const sessionEnded = end < now
    const awaitingReview =
      b.status === 'CONFIRMED' &&
      sessionEnded &&
      differenceInHours(now, end) <= 48
    const style = resolveStyle(b.status, sessionEnded, awaitingReview)
    const isPast = sessionEnded
    const name   = b.mentor.name ?? b.mentor.email ?? 'Gia sư'
    return {
      id:              `learning-${b.id}`,
      title:           `${style.icon} ${name}`,
      start:           new Date(b.startTime),
      end:             new Date(b.endTime),
      backgroundColor: style.bgColor,
      borderColor:     style.borderColor,
      textColor:       style.textColor,
      editable:        false,
      extendedProps: {
        bookingId:     b.id,
        bookingStatus: b.status,
        meetingUrl:    b.meetingUrl,
        note:          b.note,
        isPast,
        partner: {
          name:      b.mentor.name,
          email:     b.mentor.email,
          avatarUrl: b.mentor.avatarUrl,
        },
        startTime: b.startTime,
        endTime:   b.endTime,
        label:     style.label,
      },
    }
  })

  // ── Click handler ────────────────────────────────────────────────────────

  const handleEventClick = (info: EventClickArg) => {
    const p = info.event.extendedProps
    setSelectedSession({
      type:          'booking',
      role:          'mentee',
      bookingId:     p.bookingId as string,
      bookingStatus: p.bookingStatus as string,
      meetingUrl:    p.meetingUrl as string | null,
      note:          p.note as string | null,
      isPast:        p.isPast as boolean,
      partner:       p.partner as SessionInfo['partner'],
      startTime:     new Date(p.startTime as Date),
      endTime:       new Date(p.endTime as Date),
      sessionLabel:  formatRange(new Date(p.startTime as Date), new Date(p.endTime as Date)),
    })
    setDialogOpen(true)
  }

  const handleMutate = async () => {
    showToast('Cập nhật thành công!', 'success')
    await loadData()
    onDataChange?.()
  }

  // ── Toast styles ─────────────────────────────────────────────────────────
  const toastStyle: Record<Toast['type'], string> = {
    success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600',
  }

  // ── Empty state ──────────────────────────────────────────────────────────
  const hasAny = bookings.length > 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-orange-500 to-amber-400 p-2.5 rounded-xl shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lịch học của tôi</h2>
            <p className="text-xs text-gray-400 mt-0.5">Nhấn vào buổi học để xem chi tiết &amp; thực hiện hành động</p>
          </div>
        </div>
        <button
          onClick={() => loadData()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-semibold transition disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isLoading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {/* Legend */}
      <div className="px-6 pt-3 pb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-full">Màu trạng thái</span>
        {[
          { color: '#f59e0b', label: 'Chờ xác nhận' },
          { color: '#f97316', label: 'Đã xác nhận' },
          { color: '#fef3c7', border: '#fbbf24', label: 'Chờ đánh giá' },
          { color: '#22c55e', label: 'Hoàn thành' },
          { color: '#94a3b8', label: 'Đã hủy' },
          { color: '#e2e8f0', border: '#94a3b8', label: 'Đã qua' },
        ].map(({ color, border, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
            <div
              className="w-3 h-3 rounded shrink-0"
              style={{ backgroundColor: color, border: border ? `1px solid ${border}` : undefined }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* Calendar or empty state */}
      <div className="px-6 pb-6 pt-3">
        {!hasAny && !isLoading ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📚</div>
            <p className="font-semibold text-gray-500">Chưa có buổi học nào</p>
            <p className="text-sm mt-1">Đặt lịch với một gia sư để bắt đầu!</p>
          </div>
        ) : (
          mounted && (
            <FullCalendar
              plugins={[timeGridPlugin, dayGridPlugin]}
              initialView="timeGridWeek"
              headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,dayGridMonth' }}
              buttonText={{ today: 'Hôm nay', week: 'Tuần', day: 'Ngày', month: 'Tháng' }}
              locale="vi"
              height="auto"
              contentHeight={580}
              slotMinTime="06:00:00"
              slotMaxTime="23:00:00"
              slotDuration="00:30:00"
              allDaySlot={false}
              nowIndicator={true}
              selectable={false}
              editable={false}
              slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
              dayHeaderFormat={{ weekday: 'short', month: 'short', day: 'numeric', omitCommas: true }}
              events={calendarEvents}
              eventClick={handleEventClick}
              eventDidMount={info => {
                const p      = info.event.extendedProps
                const isPast = p.isPast as boolean
                const status = p.bookingStatus as string
                const name   = (p.partner as SessionInfo['partner'])?.name ?? 'Gia sư'
                const label  = p.label as string

                let tip = `${name} · ${label}`
                if (isPast) {
                  if (status === 'CONFIRMED') tip += ' · Nhấn để báo cáo vắng mặt (còn trong 48h)'
                  else tip += ' · Xem lịch sử'
                } else {
                  if (status === 'CONFIRMED') tip += ' · Nhấn để đánh giá hoặc hủy'
                  if (status === 'PENDING')   tip += ' · Đang chờ gia sư xác nhận'
                }
                info.el.setAttribute('title', tip)
              }}
            />
          )
        )}
      </div>

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white pointer-events-auto ${toastStyle[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>

      {/* Session detail dialog */}
      <SessionDetailDialog
        open={dialogOpen}
        session={selectedSession}
        currentUserId={currentUserId}
        onClose={() => setDialogOpen(false)}
        onMutate={handleMutate}
      />
    </div>
  )
}
