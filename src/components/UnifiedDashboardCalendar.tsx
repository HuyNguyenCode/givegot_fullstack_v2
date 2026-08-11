'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type {
  EventInput,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import {
  getMyBookings,
  acceptBooking,
  declineBooking,
  cancelBooking,
  reportNoShow,
} from '@/actions/booking'
import {
  getAllMentorSlots,
  addMentorSlots,
  deleteMentorSlot,
  updateMentorSlot,
} from '@/actions/slots'
import { BookingWithDetails } from '@/types'
import Link from 'next/link'
import BlindReviewSection from '@/components/reviews/BlindReviewSection'

// ── Types ─────────────────────────────────────────────────────────────────────

/** Which role the current user plays in this specific event. */
type EventRole = 'mentor' | 'mentee' | 'owner'

interface EventStyle {
  bgColor: string
  borderColor: string
  textColor: string
  icon: string
  label: string
}

/** Shape stored in state when an event is clicked to drive the detail panel. */
interface ClickedEvent {
  type: 'available' | 'booking'
  role: EventRole
  isPast: boolean
  // Available slot
  slotId?: string
  // Booking
  bookingId?: string
  bookingStatus?: string
  meetingUrl?: string | null
  note?: string | null
  // Display
  otherPartyName: string
  otherPartyEmail: string
  startTime: Date
  endTime: Date
  sessionLabel: string
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

export interface UnifiedDashboardCalendarProps {
  currentUserId: string
  /** Called after any mutation so the parent page can refresh its own state. */
  onDataChange?: () => void
}

// ── 2D Color Matrix: Time × Role ──────────────────────────────────────────────
//
// Priority 1 (highest): if startTime < now → ALWAYS Slate/Gray
// Priority 2: future events → color by role (mentor = purple/blue, mentee = orange, owner = green)

function resolveEventStyle(
  role: EventRole,
  status: string | undefined, // undefined = available slot
  isPast: boolean,
): EventStyle {
  // ── Priority 1: Past ─────────────────────────────────────────────────────
  if (isPast) {
    const slate = { bgColor: '#e2e8f0', borderColor: '#94a3b8', textColor: '#475569' }
    if (!status)                return { ...slate, icon: '✗',   label: 'Khung giờ đã qua'  }
    if (status === 'PENDING')   return { ...slate, icon: '⚠️',  label: 'Đã hết hạn'    }
    if (status === 'COMPLETED') return { ...slate, icon: '🎓',  label: 'Đã hoàn thành'  }
    if (status === 'MISSED')    return { ...slate, icon: '⏰',  label: 'Đã lỡ hẹn'     }
    if (status === 'DISPUTED')  return { ...slate, icon: '⚖️',  label: 'Tranh chấp'   }
    if (status === 'CANCELLED') return { ...slate, icon: '✕',   label: 'Đã hủy'  }
    // CONFIRMED past → "Missed / not-yet-reviewed"
    return { ...slate, icon: '🎓', label: 'Đã hoàn thành' }
  }

  // ── Priority 2: Future by role ────────────────────────────────────────────
  if (role === 'owner') {
    return { bgColor: '#10b981', borderColor: '#059669', textColor: '#fff', icon: '✓', label: 'Còn trống' }
  }

  if (role === 'mentor') {
    // Teaching palette: Purple → Blue → Teal
    const map: Record<string, EventStyle> = {
      PENDING:   { bgColor: '#7c3aed', borderColor: '#6d28d9', textColor: '#fff', icon: '⏳', label: 'Đang chờ'   },
      CONFIRMED: { bgColor: '#3b82f6', borderColor: '#2563eb', textColor: '#fff', icon: '📘', label: 'Đang dạy'  },
      COMPLETED: { bgColor: '#0d9488', borderColor: '#0f766e', textColor: '#fff', icon: '🎓', label: 'Hoàn thành'      },
      MISSED:    { bgColor: '#0d9488', borderColor: '#0f766e', textColor: '#fff', icon: '🎓', label: 'Hoàn thành'      },
      DISPUTED:  { bgColor: '#6366f1', borderColor: '#4f46e5', textColor: '#fff', icon: '⚖️', label: 'Tranh chấp'  },
      CANCELLED: { bgColor: '#94a3b8', borderColor: '#64748b', textColor: '#fff', icon: '✕', label: 'Đã hủy' },
    }
    return map[status ?? ''] ?? { bgColor: '#7c3aed', borderColor: '#6d28d9', textColor: '#fff', icon: '?', label: status ?? '' }
  }

  // Mentee palette: Amber → Orange → Green
  const map: Record<string, EventStyle> = {
    PENDING:   { bgColor: '#f59e0b', borderColor: '#d97706', textColor: '#fff', icon: '⏳', label: 'Đang chờ'  },
    CONFIRMED: { bgColor: '#f97316', borderColor: '#ea580c', textColor: '#fff', icon: '📚', label: 'Đang học' },
    COMPLETED: { bgColor: '#22c55e', borderColor: '#16a34a', textColor: '#fff', icon: '🎓', label: 'Hoàn thành'     },
    MISSED:    { bgColor: '#22c55e', borderColor: '#16a34a', textColor: '#fff', icon: '🎓', label: 'Hoàn thành'     },
    DISPUTED:  { bgColor: '#f59e0b', borderColor: '#d97706', textColor: '#fff', icon: '⚖️', label: 'Tranh chấp' },
    CANCELLED: { bgColor: '#94a3b8', borderColor: '#64748b', textColor: '#fff', icon: '✕', label: 'Đã hủy'},
  }
  return map[status ?? ''] ?? { bgColor: '#f97316', borderColor: '#ea580c', textColor: '#fff', icon: '?', label: status ?? '' }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let _toastCounter = 0

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const day = start.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  })
  return `${day}, ${fmt(start)} – ${fmt(end)}`
}

type SlotRow = Awaited<ReturnType<typeof getAllMentorSlots>>[number]

// ── Main Component ────────────────────────────────────────────────────────────

export default function UnifiedDashboardCalendar({
  currentUserId,
  onDataChange,
}: UnifiedDashboardCalendarProps) {
  const calendarRef = useRef<FullCalendar>(null)
  const [mounted, setMounted]               = useState(false)
  const [isLoading, setIsLoading]           = useState(false)
  const [isSaving, setIsSaving]             = useState(false)
  const [isActionLoading, setIsActionLoading] = useState(false)

  // Raw data
  const [slots, setSlots]                       = useState<SlotRow[]>([])
  const [mentoringBookings, setMentoringBookings] = useState<BookingWithDetails[]>([])
  const [learningBookings, setLearningBookings]   = useState<BookingWithDetails[]>([])

  // UI
  const [clickedEvent, setClickedEvent] = useState<ClickedEvent | null>(null)
  const [toasts, setToasts]             = useState<Toast[]>([])

  useEffect(() => setMounted(true), [])

  // ── Toast system ────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++_toastCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  // ── Data fetching ───────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setIsLoading(true)
    const [bookings, mentorSlots] = await Promise.all([
      getMyBookings(currentUserId),
      getAllMentorSlots(currentUserId),
    ])
    setMentoringBookings(bookings.asMentor as BookingWithDetails[])
    setLearningBookings(bookings.asMentee as BookingWithDetails[])
    setSlots(mentorSlots)
    setIsLoading(false)
  }, [currentUserId])

  useEffect(() => { loadData() }, [loadData])

  // ── Build calendar events using the 2D matrix ────────────────────────────

  const now = new Date()

  const calendarEvents: EventInput[] = [
    // ── 1. Available (unbooked) slots owned by this mentor → Green ──────────
    ...slots
      .filter(s => !s.isBooked)
      .map(slot => {
        const isPast = new Date(slot.startTime) < now
        const style  = resolveEventStyle('owner', undefined, isPast)
        return {
          id:              `slot-${slot.id}`,
          title:           `${style.icon} ${style.label}`,
          start:           new Date(slot.startTime),
          end:             new Date(slot.endTime),
          backgroundColor: style.bgColor,
          borderColor:     style.borderColor,
          textColor:       style.textColor,
          editable:        !isPast, // future slots are drag-movable
          extendedProps: {
            eType: 'available', role: 'owner' as EventRole, isPast,
            slotId: slot.id,
          },
        }
      }),

    // ── 2. Sessions where this user is MENTOR → Purple/Blue ─────────────────
    ...mentoringBookings.map(b => {
      const isPast = new Date(b.startTime) < now
      const style  = resolveEventStyle('mentor', b.status, isPast)
      const name   = b.mentee.name ?? b.mentee.email ?? 'Mentee'
      return {
        id:              `mentor-${b.id}`,
        title:           `${style.icon} ${name} · ${style.label}`,
        start:           new Date(b.startTime),
        end:             new Date(b.endTime),
        backgroundColor: style.bgColor,
        borderColor:     style.borderColor,
        textColor:       style.textColor,
        editable:        false,
        extendedProps: {
          eType: 'booking', role: 'mentor' as EventRole, isPast,
          bookingId:     b.id,
          bookingStatus: b.status,
          meetingUrl:    b.meetingUrl,
          note:          b.note,
          otherName:     name,
          otherEmail:    b.mentee.email,
          startTime:     b.startTime,
          endTime:       b.endTime,
        },
      }
    }),

    // ── 3. Sessions where this user is MENTEE → Orange/Amber ────────────────
    ...learningBookings.map(b => {
      const isPast = new Date(b.startTime) < now
      const style  = resolveEventStyle('mentee', b.status, isPast)
      const name   = b.mentor.name ?? b.mentor.email ?? 'Mentor'
      return {
        id:              `mentee-${b.id}`,
        title:           `${style.icon} ${name} · ${style.label}`,
        start:           new Date(b.startTime),
        end:             new Date(b.endTime),
        backgroundColor: style.bgColor,
        borderColor:     style.borderColor,
        textColor:       style.textColor,
        editable:        false,
        extendedProps: {
          eType: 'booking', role: 'mentee' as EventRole, isPast,
          bookingId:     b.id,
          bookingStatus: b.status,
          meetingUrl:    b.meetingUrl,
          note:          b.note,
          otherName:     name,
          otherEmail:    b.mentor.email,
          startTime:     b.startTime,
          endTime:       b.endTime,
        },
      }
    }),
  ]

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleSelect = async (info: DateSelectArg) => {
    if (info.start < now) {
      info.view.calendar.unselect()
      showToast('Không thể tạo khung giờ trong quá khứ', 'error')
      return
    }
    setIsSaving(true)
    const result = await addMentorSlots(currentUserId, [
      { startTime: info.start, endTime: info.end },
    ])
    setIsSaving(false)
    if (result.success) {
      showToast(`Đã tạo khung giờ — ${formatTimeRange(info.start, info.end)}`)
      await loadData(); onDataChange?.()
    } else {
      showToast(result.message, 'error')
    }
    info.view.calendar.unselect()
  }

  const handleEventDrop = async (info: EventDropArg) => {
    const { event, revert } = info
    if (event.extendedProps.eType !== 'available') {
      revert(); showToast('Không thể di chuyển buổi học đã được đặt', 'error'); return
    }
    if (!event.start || !event.end) { revert(); return }
    if (event.start < now) {
      revert(); showToast('Không thể di chuyển khung giờ về quá khứ', 'error'); return
    }
    setIsSaving(true)
    const r = await updateMentorSlot(
      event.extendedProps.slotId as string, currentUserId, event.start, event.end,
    )
    setIsSaving(false)
    if (r.success) {
      showToast(`Đã di chuyển khung giờ đến ${formatTimeRange(event.start, event.end)}`)
      await loadData(); onDataChange?.()
    } else {
      revert(); showToast(r.message, 'error')
    }
  }

  const handleEventResize = async (info: EventResizeDoneArg) => {
    const { event, revert } = info
    if (!event.start || !event.end) { revert(); return }
    setIsSaving(true)
    const r = await updateMentorSlot(
      event.extendedProps.slotId as string, currentUserId, event.start, event.end,
    )
    setIsSaving(false)
    if (r.success) {
      showToast('Đã thay đổi kích thước khung giờ'); await loadData(); onDataChange?.()
    } else {
      revert(); showToast(r.message, 'error')
    }
  }

  const handleEventClick = (info: EventClickArg) => {
    const p = info.event.extendedProps

    if (p.eType === 'available') {
      setClickedEvent({
        type: 'available', role: 'owner', isPast: p.isPast as boolean,
        slotId: p.slotId as string,
        otherPartyName: '', otherPartyEmail: '',
        startTime: info.event.start!, endTime: info.event.end!,
        sessionLabel: formatTimeRange(info.event.start!, info.event.end!),
      })
    } else {
      setClickedEvent({
        type:          'booking',
        role:          p.role as EventRole,
        isPast:        p.isPast as boolean,
        bookingId:     p.bookingId as string,
        bookingStatus: p.bookingStatus as string,
        meetingUrl:    p.meetingUrl as string | null,
        note:          p.note as string | null,
        otherPartyName:  p.otherName as string,
        otherPartyEmail: p.otherEmail as string,
        startTime: new Date(p.startTime as Date),
        endTime:   new Date(p.endTime as Date),
        sessionLabel: formatTimeRange(new Date(p.startTime as Date), new Date(p.endTime as Date)),
      })
    }
  }

  // ── Action helpers ────────────────────────────────────────────────────────

  const closePanel = () => setClickedEvent(null)

  const withAction = async (fn: () => Promise<{ success: boolean; message: string }>) => {
    setIsActionLoading(true)
    try {
      const r = await fn()
      if (r.success) {
        showToast(r.message)
        closePanel(); await loadData(); onDataChange?.()
      } else {
        showToast(r.message, 'error')
      }
    } catch {
      showToast('Đã xảy ra lỗi không mong muốn.', 'error')
    } finally {
      setIsActionLoading(false)
    }
  }

  const handleDeleteSlot = () => {
    if (!clickedEvent?.slotId) return
    if (!window.confirm(`Xóa khung giờ trống này?\n${clickedEvent.sessionLabel}`)) return
    withAction(() => deleteMentorSlot(clickedEvent.slotId!, currentUserId))
  }

  const handleAccept   = () => clickedEvent?.bookingId && withAction(() => acceptBooking(clickedEvent.bookingId!, currentUserId))
  const handleDecline  = () => {
    if (!clickedEvent?.bookingId) return
    if (!window.confirm('Từ chối lịch đặt này? Mentee sẽ được hoàn điểm.')) return
    withAction(() => declineBooking(clickedEvent.bookingId!, currentUserId))
  }
  const handleCancel   = () => {
    if (!clickedEvent?.bookingId) return
    if (!window.confirm('Hủy lịch đặt này? Bạn có thể bị trừ Điểm tin cậy.')) return
    withAction(() => cancelBooking(clickedEvent.bookingId!, currentUserId))
  }
  const handleReportNoShow = () => {
    if (!clickedEvent?.bookingId) return
    if (!window.confirm('Báo cáo vắng mặt? Việc tham gia sẽ được xác minh qua Google Meet API.')) return
    withAction(() => reportNoShow(clickedEvent.bookingId!, currentUserId))
  }

  // Derived timing flags for the currently clicked event
  const ce = clickedEvent
  const isNearSession = ce
    ? Date.now() >= new Date(ce.startTime).getTime() - 15 * 60 * 1000 &&
      Date.now() <= new Date(ce.endTime).getTime()
    : false
  const isWithin48hGrace = ce?.isPast
    ? Date.now() <= new Date(ce.endTime).getTime() + 48 * 60 * 60 * 1000
    : false

  // ── Toast style maps ──────────────────────────────────────────────────────
  const toastStyle: Record<Toast['type'], string> = {
    success: 'bg-emerald-600',
    error:   'bg-red-600',
    info:    'bg-blue-600',
  }
  const toastIcon: Record<Toast['type'], string> = {
    success: '✓', error: '✕', info: 'ℹ',
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2.5 rounded-xl shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Lịch buổi học tổng hợp</h2>
            <p className="text-xs text-gray-400 mt-0.5">Toàn bộ buổi dạy và buổi học của bạn trong một lịch</p>
          </div>
        </div>
        <button
          onClick={() => loadData()}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-semibold transition disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isLoading ? 'Đang tải…' : 'Làm mới'}
        </button>
      </div>

      {/* ── Legend — split Future / Past ────────────────────────────────── */}
      <div className="px-6 pt-4 pb-2 space-y-2">
        {/* Future */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-full">Sắp tới</span>
          <LegendDot color="#10b981" label="Khung giờ trống" />
          <LegendDot color="#7c3aed" label="Đang chờ (dạy)" />
          <LegendDot color="#3b82f6" label="Đã xác nhận (dạy)" />
          <LegendDot color="#0d9488" label="Hoàn thành (dạy)" />
          <LegendDot color="#f59e0b" label="Đang chờ (học)" />
          <LegendDot color="#f97316" label="Đã xác nhận (học)" />
          <LegendDot color="#22c55e" label="Hoàn thành (học)" />
        </div>
        {/* Past */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest w-full">Đã qua (luôn màu xám)</span>
          <LegendDot color="#e2e8f0" border="#94a3b8" textColor="#475569" label="Khung giờ đã qua" />
          <LegendDot color="#e2e8f0" border="#94a3b8" textColor="#475569" label="Hết hạn (đang chờ)" />
          <LegendDot color="#e2e8f0" border="#94a3b8" textColor="#475569" label="Lỡ hẹn (đã xác nhận)" />
          <LegendDot color="#e2e8f0" border="#94a3b8" textColor="#475569" label="Đã hoàn thành" />
          <LegendDot color="#e2e8f0" border="#94a3b8" textColor="#475569" label="Tranh chấp" />
        </div>
      </div>

      {/* ── Calendar ──────────────────────────────────────────────────────── */}
      <div className={`relative mx-6 mb-6 mt-3 transition-opacity ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}>
        {isSaving && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 rounded-xl">
            <div className="flex items-center gap-2 bg-white shadow-lg border border-purple-100 px-4 py-2.5 rounded-full">
              <svg className="animate-spin h-4 w-4 text-purple-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span className="text-sm font-semibold text-purple-700">Đang lưu…</span>
            </div>
          </div>
        )}

        {mounted && (
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay,dayGridMonth' }}
            buttonText={{ today: 'Hôm nay', week: 'Tuần', day: 'Ngày', month: 'Tháng' }}
            height="auto"
            contentHeight={640}
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            allDaySlot={false}
            nowIndicator={true}
            selectable={true}
            selectMirror={true}
            editable={true}
            droppable={false}
            eventDurationEditable={true}
            eventResizableFromStart={false}
            selectOverlap={false}
            eventOverlap={false}
            selectAllow={(info) => info.start >= new Date()}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
            dayHeaderFormat={{ weekday: 'short', month: 'short', day: 'numeric', omitCommas: true }}
            events={calendarEvents}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventDidMount={(info) => {
              const p      = info.event.extendedProps
              const isPast = p.isPast as boolean

              if (p.eType === 'available') {
                if (isPast) {
                  info.el.style.pointerEvents = 'none'
                  info.el.setAttribute('title', 'Khung giờ đã qua — không có hành động khả dụng')
                } else {
                  info.el.setAttribute('title', 'Nhấn để xóa · Kéo để di chuyển · Kéo góc để đổi kích thước')
                }
              } else {
                const role   = p.role as string
                const status = p.bookingStatus as string
                const who    = p.otherName as string
                const roleLabel = role === 'mentor' ? 'Đang dạy' : 'Đang học'

                let action = ''
                if (isPast) {
                  if (status === 'CONFIRMED') action = 'Nhấn để xem · Báo cáo vắng mặt (mentee) hoặc xem lịch sử'
                  else if (status === 'PENDING') action = 'Yêu cầu đã hết hạn'
                  else action = 'Xem lịch sử'
                } else {
                  if (status === 'PENDING' && role === 'mentor')   action = 'Nhấn để Chấp nhận / Từ chối'
                  if (status === 'PENDING' && role === 'mentee')   action = 'Nhấn để Hủy'
                  if (status === 'CONFIRMED' && role === 'mentor')  action = 'Nhấn để Hủy / Trò chuyện'
                  if (status === 'CONFIRMED' && role === 'mentee')  action = 'Nhấn để Đánh giá / Hủy'
                }
                info.el.setAttribute('title', `${who} · ${roleLabel} · ${action}`)
              }
            }}
          />
        )}
      </div>

      {/* ── Toast Notifications ──────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white pointer-events-auto ${toastStyle[t.type]}`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {toastIcon[t.type]}
            </span>
            {t.message}
          </div>
        ))}
      </div>

      {/* ── Event Detail Panel ───────────────────────────────────────────── */}
      {clickedEvent && (
        <EventDetailPanel
          event={clickedEvent}
          currentUserId={currentUserId}
          isActionLoading={isActionLoading}
          isNearSession={isNearSession}
          isWithin48hGrace={isWithin48hGrace}
          // Actions
          onClose={closePanel}
          onDeleteSlot={handleDeleteSlot}
          onAccept={handleAccept}
          onDecline={handleDecline}
          onCancel={handleCancel}
          onReportNoShow={handleReportNoShow}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LegendDot({
  color,
  border,
  textColor,
  label,
}: {
  color: string
  border?: string
  textColor?: string
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-gray-600">
      <div
        className="w-3 h-3 rounded shrink-0"
        style={{
          backgroundColor: color,
          border: border ? `1px solid ${border}` : undefined,
          color: textColor,
        }}
      />
      {label}
    </div>
  )
}

// ── Event Detail Panel ────────────────────────────────────────────────────────

interface EventDetailPanelProps {
  event: ClickedEvent
  currentUserId: string
  isActionLoading: boolean
  isNearSession: boolean
  isWithin48hGrace: boolean
  onClose: () => void
  onDeleteSlot: () => void
  onAccept: () => void
  onDecline: () => void
  onCancel: () => void
  onReportNoShow: () => void
}

function EventDetailPanel({
  event: ev,
  currentUserId,
  isActionLoading,
  isNearSession,
  isWithin48hGrace,
  onClose,
  onDeleteSlot,
  onAccept,
  onDecline,
  onCancel,
  onReportNoShow,
}: EventDetailPanelProps) {

  const roleLabel = ev.role === 'mentor' ? 'Đang dạy' : ev.role === 'mentee' ? 'Đang học' : 'Khung giờ của bạn'
  const rolePalette =
    ev.role === 'mentor' ? 'from-purple-600 to-blue-600' :
    ev.role === 'mentee' ? 'from-orange-500 to-amber-500' :
                           'from-emerald-500 to-teal-500'

  const statusBadge = ev.type === 'available'
    ? { label: ev.isPast ? 'Khung giờ đã qua' : 'Còn trống', color: ev.isPast ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700' }
    : ev.isPast
      ? { label: ev.bookingStatus === 'PENDING' ? 'Đã hết hạn' : ev.bookingStatus ?? '', color: 'bg-slate-200 text-slate-600' }
      : {
          label: ev.bookingStatus ?? '',
          color:
            ev.bookingStatus === 'PENDING'    ? 'bg-amber-100 text-amber-700' :
            ev.bookingStatus === 'CONFIRMED'  ? 'bg-blue-100 text-blue-700'  :
            ev.bookingStatus === 'COMPLETED'  ? 'bg-green-100 text-green-700':
            ev.bookingStatus === 'CANCELLED'  ? 'bg-red-100 text-red-700'    :
                                                'bg-gray-100 text-gray-600',
        }

  const timeBadge = ev.isPast
    ? { label: 'Đã qua', color: 'bg-slate-100 text-slate-500' }
    : { label: 'Sắp tới', color: 'bg-indigo-50 text-indigo-600' }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header gradient */}
        <div className={`bg-gradient-to-r ${rolePalette} px-5 py-4 text-white`}>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider opacity-80">{roleLabel}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${timeBadge.color}`}>
                  {timeBadge.label}
                </span>
              </div>
              <h3 className="text-base font-bold leading-tight">
                {ev.type === 'available'
                  ? ev.isPast ? 'Khung giờ trống đã qua' : 'Khung giờ trống'
                  : ev.otherPartyName || 'Buổi học'}
              </h3>
              {ev.type === 'booking' && (
                <p className="text-xs opacity-75 mt-0.5">{ev.otherPartyEmail}</p>
              )}
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Time + status */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Thời gian</span>
              <span className="font-semibold text-gray-800 text-right max-w-[200px]">
                {ev.sessionLabel}
              </span>
            </div>
            {ev.type === 'booking' && (
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Trạng thái</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusBadge.color}`}>
                  {statusBadge.label}
                </span>
              </div>
            )}
            {ev.note && (
              <div className="pt-1 border-t border-gray-200">
                <p className="text-xs text-gray-500 italic">"{ev.note}"</p>
              </div>
            )}
          </div>

          {/* ── Actions — Available slot ──────────────────────────────── */}
          {ev.type === 'available' && (
            ev.isPast ? (
              <p className="text-sm text-slate-500 text-center py-2">Khung giờ này đã qua — không có hành động khả dụng.</p>
            ) : (
              <button
                onClick={onDeleteSlot}
                disabled={isActionLoading}
                className="w-full py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50"
              >
                {isActionLoading ? 'Đang xóa…' : 'Xóa khung giờ'}
              </button>
            )
          )}

          {/* ── Actions — Booking: MENTOR role ───────────────────────── */}
          {ev.type === 'booking' && ev.role === 'mentor' && (
            <div className="space-y-2">
              {/* Future PENDING → Accept / Decline */}
              {!ev.isPast && ev.bookingStatus === 'PENDING' && (
                <div className="flex gap-2">
                  <button onClick={onAccept} disabled={isActionLoading}
                    className="flex-1 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50">
                    {isActionLoading ? '…' : 'Chấp nhận'}
                  </button>
                  <button onClick={onDecline} disabled={isActionLoading}
                    className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50">
                    Từ chối
                  </button>
                </div>
              )}

              {/* Future CONFIRMED → Join / Cancel / Chat */}
              {!ev.isPast && ev.bookingStatus === 'CONFIRMED' && (
                <>
                  {isNearSession && ev.meetingUrl && (
                    <a href={ev.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Tham gia buổi học
                    </a>
                  )}
                  <div className="flex gap-2">
                    {ev.bookingId && (
                      <Link href={`/chat?bookingId=${ev.bookingId}`}
                        className="flex-1 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 transition text-center">
                        Trò chuyện
                      </Link>
                    )}
                    <button onClick={onCancel} disabled={isActionLoading}
                      className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50">
                      Hủy
                    </button>
                  </div>
                </>
              )}

              {/* Past PENDING → expired info */}
              {ev.isPast && ev.bookingStatus === 'PENDING' && (
                <p className="text-sm text-slate-500 text-center py-2">
                  ⚠️ Yêu cầu này đã hết hạn — thời gian buổi học đã qua.
                </p>
              )}

              {/* Past CONFIRMED → view history */}
              {ev.isPast && ev.bookingStatus === 'CONFIRMED' && (
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                    ⏰ Buổi học đã xác nhận này đã diễn ra trong quá khứ. Kiểm tra xem mentee đã gửi đánh giá chưa, hoặc liên hệ qua trò chuyện.
                  </div>
                  {ev.bookingId && (
                    <Link href={`/chat?bookingId=${ev.bookingId}`}
                      className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition text-center">
                      Xem lịch sử trò chuyện
                    </Link>
                  )}
                </div>
              )}

              {/* COMPLETED / MISSED → view history */}
              {(ev.bookingStatus === 'COMPLETED' || ev.bookingStatus === 'MISSED') && ev.bookingId && (
                <Link href={`/chat?bookingId=${ev.bookingId}`}
                  className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition text-center">
                  🎓 Xem lịch sử trò chuyện
                </Link>
              )}

              {/* DISPUTED */}
              {ev.bookingStatus === 'DISPUTED' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
                  ⚖️ Buổi học này đang được quản trị viên xem xét. Điểm sẽ bị tạm giữ cho đến khi có kết quả.
                </div>
              )}
            </div>
          )}

          {/* ── Actions — Booking: MENTEE role ───────────────────────── */}
          {ev.type === 'booking' && ev.role === 'mentee' && (
            <div className="space-y-2">
              {/* Future PENDING → Cancel */}
              {!ev.isPast && ev.bookingStatus === 'PENDING' && (
                <button onClick={onCancel} disabled={isActionLoading}
                  className="w-full py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50">
                  {isActionLoading ? '…' : 'Hủy lịch đặt'}
                </button>
              )}

              {/* Future CONFIRMED → Join / Review / Cancel */}
              {!ev.isPast && ev.bookingStatus === 'CONFIRMED' && (
                <>
                  {isNearSession && ev.meetingUrl && (
                    <a href={ev.meetingUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Tham gia buổi học
                    </a>
                  )}
                  {ev.bookingId && (
                    <BlindReviewSection
                      booking={{ id: ev.bookingId }}
                      currentUserId={currentUserId}
                    />
                  )}
                  <div className="flex gap-2">
                    {ev.bookingId && (
                      <Link href={`/chat?bookingId=${ev.bookingId}`}
                        className="flex-1 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-xl text-sm font-semibold hover:bg-blue-100 transition text-center">
                        Trò chuyện
                      </Link>
                    )}
                    <button onClick={onCancel} disabled={isActionLoading}
                      className="flex-1 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-semibold hover:bg-red-100 transition disabled:opacity-50">
                      Hủy
                    </button>
                  </div>
                </>
              )}

              {/* Past CONFIRMED — Report No-Show (within 48 h) OR History */}
              {ev.isPast && ev.bookingStatus === 'CONFIRMED' && (
                <div className="space-y-2">
                  {isWithin48hGrace ? (
                    <>
                      <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                        ⚠️ Mentor của bạn không xuất hiện? Bạn có thể báo cáo trong vòng 48 giờ.
                      </div>
                      <button onClick={onReportNoShow} disabled={isActionLoading}
                        className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition disabled:opacity-50">
                        {isActionLoading ? 'Đang xác minh…' : '🚨 Báo cáo vắng mặt'}
                      </button>
                    </>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600">
                      Thời hạn báo cáo 48 giờ cho buổi học này đã kết thúc.
                    </div>
                  )}
                  {ev.bookingId && (
                    <Link href={`/chat?bookingId=${ev.bookingId}`}
                      className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition text-center">
                      Xem lịch sử trò chuyện
                    </Link>
                  )}
                </div>
              )}

              {/* COMPLETED — blind review may still be pending/revealed even
                  though the booking is no longer CONFIRMED (submitting the
                  mentee's own review is what flips this status). */}
              {ev.bookingStatus === 'COMPLETED' && ev.bookingId && (
                <div className="space-y-2">
                  <BlindReviewSection
                    booking={{ id: ev.bookingId }}
                    currentUserId={currentUserId}
                  />
                  <Link href={`/chat?bookingId=${ev.bookingId}`}
                    className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition text-center">
                    🎓 Xem lịch sử trò chuyện
                  </Link>
                </div>
              )}

              {/* MISSED → history */}
              {ev.bookingStatus === 'MISSED' && ev.bookingId && (
                <Link href={`/chat?bookingId=${ev.bookingId}`}
                  className="block w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-200 transition text-center">
                  🎓 Xem lịch sử trò chuyện
                </Link>
              )}

              {/* DISPUTED */}
              {ev.bookingStatus === 'DISPUTED' && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-xs text-indigo-800">
                  ⚖️ Khiếu nại của bạn đang được quản trị viên xem xét. Điểm sẽ bị tạm giữ cho đến khi có kết quả.
                </div>
              )}

              {/* Past PENDING */}
              {ev.isPast && ev.bookingStatus === 'PENDING' && (
                <p className="text-sm text-slate-500 text-center py-2">
                  ⚠️ Yêu cầu đặt lịch này đã hết hạn — mentor không phản hồi.
                </p>
              )}
            </div>
          )}

          {/* Close button */}
          <button onClick={onClose}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition font-medium">
            Đóng
          </button>
        </div>
      </div>
    </div>
  )
}
