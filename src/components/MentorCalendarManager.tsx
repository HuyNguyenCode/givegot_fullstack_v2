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
  CalendarApi,
} from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import {
  addMentorSlots,
  getAllMentorSlots,
  deleteMentorSlot,
  updateMentorSlot,
} from '@/actions/slots'
import SessionDetailDialog, { SessionInfo } from '@/components/SessionDetailDialog'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MentorCalendarManagerProps {
  mentorId: string
}

interface ExistingSlot {
  id: string
  startTime: Date
  endTime: Date
  isBooked: boolean
  booking?: {
    id: string
    status: string
    meetingUrl: string | null
    note: string | null
    mentee: {
      id: string
      name: string | null
      avatarUrl: string | null
      email: string
    }
  } | null
}

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

let toastCounter = 0

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTimeRange(start: Date, end: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  return `${day}, ${fmt(start)} – ${fmt(end)}`
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MentorCalendarManager({ mentorId }: MentorCalendarManagerProps) {
  const [existingSlots, setExistingSlots] = useState<ExistingSlot[]>([])
  const [isLoading, setIsLoading]         = useState(false)
  const [isSaving, setIsSaving]           = useState(false)
  const [mounted, setMounted]             = useState(false)
  const [toasts, setToasts]               = useState<Toast[]>([])

  // SessionDetailDialog state
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null)
  const [dialogOpen, setDialogOpen]           = useState(false)

  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => setMounted(true), [])

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = ++toastCounter
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4500)
  }, [])

  const loadSlots = useCallback(async () => {
    setIsLoading(true)
    const slots = await getAllMentorSlots(mentorId)
    setExistingSlots(slots as ExistingSlot[])
    setIsLoading(false)
  }, [mentorId])

  useEffect(() => { loadSlots() }, [loadSlots])

  // ── Calendar event mapping ────────────────────────────────────────────────

  const calendarEvents: EventInput[] = existingSlots.map(slot => {
    const isPast = new Date(slot.startTime) < new Date()

    if (slot.isBooked && slot.booking) {
      const { status } = slot.booking
      const menteeName = slot.booking.mentee.name ?? slot.booking.mentee.email ?? 'Booked'

      let bgColor: string, borderColor: string, textColor = '#fff'
      let statusIcon: string, statusLabel: string

      if (status === 'CONFIRMED') {
        if (isPast) {
          bgColor = '#fecaca'; borderColor = '#f87171'; textColor = '#991b1b'
          statusIcon = '⏰'; statusLabel = 'Missed'
        } else {
          bgColor = '#3b82f6'; borderColor = '#2563eb'
          statusIcon = '📘'; statusLabel = 'Teaching'
        }
      } else if (status === 'COMPLETED') {
        bgColor = '#0d9488'; borderColor = '#0f766e'
        statusIcon = '🎓'; statusLabel = 'Done'
      } else {
        // PENDING
        if (isPast) {
          bgColor = '#fef3c7'; borderColor = '#fbbf24'; textColor = '#78350f'
          statusIcon = '⚠️'; statusLabel = 'Expired'
        } else {
          bgColor = '#7c3aed'; borderColor = '#6d28d9'
          statusIcon = '⏳'; statusLabel = 'Pending'
        }
      }

      return {
        id:              `slot-${slot.id}`,
        title:           `${statusIcon} ${menteeName} · ${statusLabel}`,
        start:           new Date(slot.startTime),
        end:             new Date(slot.endTime),
        backgroundColor: bgColor,
        borderColor,
        textColor,
        editable:        false,
        extendedProps: {
          type:          'booking',
          slotId:        slot.id,
          bookingId:     slot.booking.id,
          bookingStatus: status,
          meetingUrl:    slot.booking.meetingUrl,
          note:          slot.booking.note,
          mentee:        slot.booking.mentee,
          startTime:     slot.startTime,
          endTime:       slot.endTime,
          isPast,
        },
      }
    }

    // Available slot
    if (isPast) {
      return {
        id:              `slot-${slot.id}`,
        title:           '✗ Past slot',
        start:           new Date(slot.startTime),
        end:             new Date(slot.endTime),
        backgroundColor: '#e2e8f0',
        borderColor:     '#94a3b8',
        textColor:       '#475569',
        editable:        false,
        extendedProps:   { type: 'available', slotId: slot.id, isPast: true },
      }
    }

    return {
      id:              `slot-${slot.id}`,
      title:           '✓ Available',
      start:           new Date(slot.startTime),
      end:             new Date(slot.endTime),
      backgroundColor: '#10b981',
      borderColor:     '#059669',
      textColor:       '#fff',
      editable:        true,
      extendedProps:   { type: 'available', slotId: slot.id, isPast: false },
    }
  })

  // ── Drag-to-create ────────────────────────────────────────────────────────

  const handleSelect = async (selectInfo: DateSelectArg) => {
    if (selectInfo.start < new Date()) {
      selectInfo.view.calendar.unselect()
      showToast('Không thể tạo khung giờ trong quá khứ', 'error')
      return
    }
    setIsSaving(true)
    const result = await addMentorSlots(mentorId, [
      { startTime: selectInfo.start, endTime: selectInfo.end },
    ])
    setIsSaving(false)
    if (result.success) {
      showToast(`Đã tạo khung giờ — ${formatTimeRange(selectInfo.start, selectInfo.end)}`)
      await loadSlots()
    } else {
      showToast(result.message, 'error')
    }
    selectInfo.view.calendar.unselect()
  }

  // ── Drag-to-move ──────────────────────────────────────────────────────────

  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event, revert } = dropInfo
    if (event.extendedProps.type !== 'available') {
      revert(); showToast('Buổi đã đặt không thể di chuyển', 'error'); return
    }
    if (!event.start || !event.end) { revert(); return }
    if (event.start < new Date()) {
      revert(); showToast('Không thể di chuyển khung giờ về quá khứ', 'error'); return
    }
    setIsSaving(true)
    const result = await updateMentorSlot(
      event.extendedProps.slotId as string, mentorId, event.start, event.end,
    )
    setIsSaving(false)
    if (result.success) {
      showToast(`Đã di chuyển khung giờ tới ${formatTimeRange(event.start, event.end)}`)
      await loadSlots()
    } else {
      revert(); showToast(result.message, 'error')
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    const { event, revert } = resizeInfo
    if (!event.start || !event.end) { revert(); return }
    setIsSaving(true)
    const result = await updateMentorSlot(
      event.extendedProps.slotId as string, mentorId, event.start, event.end,
    )
    setIsSaving(false)
    if (result.success) {
      showToast('Đã cập nhật độ dài khung giờ')
      await loadSlots()
    } else {
      revert(); showToast(result.message, 'error')
    }
  }

  // ── Click → open SessionDetailDialog ─────────────────────────────────────

  const handleEventClick = (clickInfo: EventClickArg) => {
    const { event } = clickInfo
    const p = event.extendedProps
    const isPast = p.isPast as boolean

    if (p.type === 'available') {
      // Past available slots are inert
      if (isPast) return

      setSelectedSession({
        type:    'slot',
        role:    'owner',
        slotId:  p.slotId as string,
        isPast:  false,
        partner: { name: null, email: '', avatarUrl: null },
        startTime:    event.start!,
        endTime:      event.end!,
        sessionLabel: formatTimeRange(event.start!, event.end!),
      })
      setDialogOpen(true)
      return
    }

    // Booking event
    const mentee = p.mentee as ExistingSlot['booking'] & { name?: string | null; email: string; avatarUrl?: string | null }
    setSelectedSession({
      type:          'booking',
      role:          'mentor',
      bookingId:     p.bookingId as string,
      bookingStatus: p.bookingStatus as string,
      meetingUrl:    p.meetingUrl as string | null,
      note:          p.note as string | null,
      isPast,
      partner: {
        name:      mentee?.name ?? null,
        email:     mentee?.email ?? '',
        avatarUrl: mentee?.avatarUrl ?? null,
      },
      startTime:    new Date(p.startTime as Date),
      endTime:      new Date(p.endTime as Date),
      sessionLabel: formatTimeRange(new Date(p.startTime as Date), new Date(p.endTime as Date)),
    })
    setDialogOpen(true)
  }

  // ── Calendar nav helpers ──────────────────────────────────────────────────

  const getCalendarApi = (): CalendarApi | null => calendarRef.current?.getApi() ?? null
  const handleTodayClick = () => getCalendarApi()?.today()
  const handlePrevClick  = () => getCalendarApi()?.prev()
  const handleNextClick  = () => getCalendarApi()?.next()

  const toastStyles: Record<Toast['type'], string> = {
    success: 'bg-emerald-600', error: 'bg-red-600', info: 'bg-blue-600',
  }
  const toastIcons: Record<Toast['type'], string> = {
    success: '✓', error: '✕', info: 'ℹ',
  }

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
            <h2 className="text-lg font-bold text-gray-900">Quản lý lịch dạy</h2>
            <p className="text-xs text-gray-400 mt-0.5">Kéo để tạo · Kéo để di chuyển · Kéo cạnh để thay đổi thời lượng</p>
          </div>
        </div>
        <button
          onClick={() => loadSlots()}
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

      {/* ── Instruction Banner ──────────────────────────────────────────── */}
      <div className="mx-6 mt-4 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-purple-500 text-lg leading-none mt-0.5">💡</span>
        <div className="text-sm text-purple-800 space-y-0.5">
          <p><strong>Kéo &amp; thả</strong> vùng trống để tạo khung giờ mới.</p>
          <p><strong>Kéo</strong> khung giờ xanh để dời lịch. <strong>Kéo cạnh dưới</strong> để thay đổi thời lượng.</p>
          <p><strong>Nhấn</strong> vào bất kỳ sự kiện nào để xem chi tiết và thực hiện hành động.</p>
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-600">
        {[
          { color: '#10b981', label: 'Khung giờ trống' },
          { color: '#7c3aed', label: 'Chờ xác nhận' },
          { color: '#3b82f6', label: 'Đang dạy' },
          { color: '#0d9488', label: 'Hoàn thành' },
          { color: '#e2e8f0', border: '#94a3b8', label: 'Đã qua' },
          { color: '#fef3c7', border: '#fbbf24', label: 'Yêu cầu hết hạn' },
          { color: '#fecaca', border: '#f87171', label: 'Buổi bị bỏ lỡ' },
        ].map(({ color, border, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div
              className="w-3 h-3 rounded shrink-0"
              style={{ backgroundColor: color, border: border ? `1px solid ${border}` : undefined }}
            />
            {label}
          </div>
        ))}
      </div>

      {/* ── Saving Overlay ──────────────────────────────────────────────── */}
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
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'timeGridWeek,timeGridDay' }}
            buttonText={{ today: 'Hôm nay', week: 'Tuần', day: 'Ngày' }}
            height="auto"
            contentHeight={620}
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
            businessHours={{ daysOfWeek: [0, 1, 2, 3, 4, 5, 6], startTime: '07:00', endTime: '22:00' }}
            selectAllow={info => info.start >= new Date()}
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: true }}
            dayHeaderFormat={{ weekday: 'short', month: 'short', day: 'numeric', omitCommas: true }}
            events={calendarEvents}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventDidMount={info => {
              const props  = info.event.extendedProps
              const isPast = props.isPast as boolean

              if (props.type === 'booking' && props.mentee) {
                const action =
                  props.bookingStatus === 'CONFIRMED' ? (isPast ? 'Buổi bị bỏ lỡ · nhấn để xem' : 'Nhấn để hủy / chat') :
                  props.bookingStatus === 'COMPLETED' ? 'Hoàn thành' :
                  isPast ? 'Yêu cầu hết hạn' : 'Nhấn để chấp nhận / từ chối'
                info.el.setAttribute('title', `${(props.mentee as { name?: string | null }).name ?? 'Học viên'} · ${action}`)
              } else if (isPast) {
                info.el.style.pointerEvents = 'none'
                info.el.style.cursor = 'default'
                info.el.setAttribute('title', 'Khung giờ đã qua — không có hành động')
              } else {
                info.el.setAttribute('title', 'Nhấn để xóa · Kéo để di chuyển · Kéo cạnh để thay đổi thời lượng')
              }
            }}
          />
        )}
      </div>

      {/* ── Toast Notifications ─────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold text-white pointer-events-auto ${toastStyles[toast.type]}`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {toastIcons[toast.type]}
            </span>
            {toast.message}
          </div>
        ))}
      </div>

      {/* ── Session Detail Dialog ────────────────────────────────────────── */}
      <SessionDetailDialog
        open={dialogOpen}
        session={selectedSession}
        currentUserId={mentorId}
        onClose={() => setDialogOpen(false)}
        onMutate={async () => {
          showToast('Cập nhật thành công!')
          await loadSlots()
        }}
      />
    </div>
  )
}
