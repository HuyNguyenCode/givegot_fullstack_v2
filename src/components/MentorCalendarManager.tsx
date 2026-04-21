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

interface MentorCalendarManagerProps {
  mentorId: string
}

interface ExistingSlot {
  id: string
  startTime: Date
  endTime: Date
  isBooked: boolean
  booking?: {
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

export default function MentorCalendarManager({ mentorId }: MentorCalendarManagerProps) {
  const [existingSlots, setExistingSlots] = useState<ExistingSlot[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const calendarRef = useRef<FullCalendar>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const showToast = useCallback(
    (message: string, type: Toast['type'] = 'success') => {
      const id = ++toastCounter
      setToasts((prev) => [...prev, { id, message, type }])
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
    },
    []
  )

  const loadSlots = useCallback(async () => {
    setIsLoading(true)
    const slots = await getAllMentorSlots(mentorId)
    setExistingSlots(slots)
    setIsLoading(false)
  }, [mentorId])

  useEffect(() => {
    loadSlots()
  }, [loadSlots])

  // ── Convert DB slots → FullCalendar EventInput ────────────────────────
  const calendarEvents: EventInput[] = existingSlots.map((slot) => {
    if (slot.isBooked && slot.booking) {
      return {
        id: `slot-${slot.id}`,
        title: `📌 ${slot.booking.mentee.name ?? 'Booked'}`,
        start: new Date(slot.startTime),
        end: new Date(slot.endTime),
        backgroundColor: '#f97316',
        borderColor: '#ea580c',
        textColor: '#fff',
        editable: false,
        extendedProps: {
          type: 'booking',
          slotId: slot.id,
          mentee: slot.booking.mentee,
        },
      }
    }
    return {
      id: `slot-${slot.id}`,
      title: '✓ Available',
      start: new Date(slot.startTime),
      end: new Date(slot.endTime),
      backgroundColor: '#10b981',
      borderColor: '#059669',
      textColor: '#fff',
      editable: true,
      extendedProps: {
        type: 'available',
        slotId: slot.id,
      },
    }
  })

  // ── Drag-to-create: select a time range ───────────────────────────────
  const handleSelect = async (selectInfo: DateSelectArg) => {
    // Block past-time creation
    if (selectInfo.start < new Date()) {
      selectInfo.view.calendar.unselect()
      showToast('Cannot create slots in the past', 'error')
      return
    }

    setIsSaving(true)
    const result = await addMentorSlots(mentorId, [
      { startTime: selectInfo.start, endTime: selectInfo.end },
    ])
    setIsSaving(false)

    if (result.success) {
      showToast(`Slot created — ${formatTimeRange(selectInfo.start, selectInfo.end)}`, 'success')
      await loadSlots()
    } else {
      showToast(result.message, 'error')
    }

    selectInfo.view.calendar.unselect()
  }

  // ── Drag-to-move: drop an event on a new time ─────────────────────────
  const handleEventDrop = async (dropInfo: EventDropArg) => {
    const { event, revert } = dropInfo

    if (event.extendedProps.type !== 'available') {
      revert()
      showToast('Booked sessions cannot be moved', 'error')
      return
    }

    if (!event.start || !event.end) {
      revert()
      return
    }

    if (event.start < new Date()) {
      revert()
      showToast('Cannot move a slot to the past', 'error')
      return
    }

    setIsSaving(true)
    const slotId = event.extendedProps.slotId as string
    const result = await updateMentorSlot(slotId, mentorId, event.start, event.end)
    setIsSaving(false)

    if (result.success) {
      showToast(`Slot moved to ${formatTimeRange(event.start, event.end)}`, 'success')
      await loadSlots()
    } else {
      revert()
      showToast(result.message, 'error')
    }
  }

  // ── Resize: stretch/shrink an event's duration ────────────────────────
  const handleEventResize = async (resizeInfo: EventResizeDoneArg) => {
    const { event, revert } = resizeInfo

    if (!event.start || !event.end) {
      revert()
      return
    }

    setIsSaving(true)
    const slotId = event.extendedProps.slotId as string
    const result = await updateMentorSlot(slotId, mentorId, event.start, event.end)
    setIsSaving(false)

    if (result.success) {
      showToast('Slot resized', 'success')
      await loadSlots()
    } else {
      revert()
      showToast(result.message, 'error')
    }
  }

  // ── Click: show info or delete ────────────────────────────────────────
  const handleEventClick = async (clickInfo: EventClickArg) => {
    const { event } = clickInfo

    if (event.extendedProps.type === 'booking') {
      const mentee = event.extendedProps.mentee as ExistingSlot['booking'] extends undefined | null ? never : NonNullable<ExistingSlot['booking']>['mentee']
      showToast(
        `Booked by ${mentee?.name ?? 'a mentee'} — confirmed session`,
        'info'
      )
      return
    }

    if (event.extendedProps.type === 'available') {
      const slotId = event.extendedProps.slotId as string
      const start = event.start!
      const end = event.end!
      if (
        window.confirm(
          `Delete available slot?\n${formatTimeRange(start, end)}`
        )
      ) {
        setIsSaving(true)
        const result = await deleteMentorSlot(slotId, mentorId)
        setIsSaving(false)
        if (result.success) {
          showToast('Slot deleted', 'success')
          await loadSlots()
        } else {
          showToast(result.message, 'error')
        }
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  const formatTimeRange = (start: Date, end: Date) => {
    const fmt = (d: Date) =>
      d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
    const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    return `${day}, ${fmt(start)} – ${fmt(end)}`
  }

  const getCalendarApi = (): CalendarApi | null => {
    return calendarRef.current?.getApi() ?? null
  }

  const handleTodayClick = () => getCalendarApi()?.today()
  const handlePrevClick = () => getCalendarApi()?.prev()
  const handleNextClick = () => getCalendarApi()?.next()

  const toastStyles: Record<Toast['type'], string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-blue-600 text-white',
  }

  const toastIcons: Record<Toast['type'], string> = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-2.5 rounded-xl shadow-sm">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Manage Available Slots</h2>
            <p className="text-xs text-gray-400 mt-0.5">Drag to create · Drag to move · Resize to adjust duration</p>
          </div>
        </div>

        <button
          onClick={() => { loadSlots() }}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-sm text-purple-600 hover:text-purple-700 font-semibold transition disabled:opacity-50"
        >
          <svg
            className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {isLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* ── Instruction Banner ──────────────────────────────────────────── */}
      <div className="mx-6 mt-4 bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 flex items-start gap-3">
        <span className="text-purple-500 text-lg leading-none mt-0.5">💡</span>
        <div className="text-sm text-purple-800 space-y-0.5">
          <p><strong>Click &amp; drag</strong> an empty area to create a new available slot.</p>
          <p><strong>Drag</strong> a green slot to reschedule it. <strong>Resize</strong> its bottom edge to adjust duration.</p>
          <p><strong>Click</strong> a green slot to delete it. Orange (booked) slots are locked.</p>
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div className="px-6 pt-3 pb-1 flex flex-wrap items-center gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          Available (saved)
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500" />
          Booked by mentee
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-200 border-2 border-dashed border-purple-400" />
          New (being created)
        </div>
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
              <span className="text-sm font-semibold text-purple-700">Saving…</span>
            </div>
          </div>
        )}

        {/* ── FullCalendar ─────────────────────────────────────────────── */}
        {mounted && (
          <FullCalendar
            ref={calendarRef}
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: 'Today',
              week: 'Week',
              day: 'Day',
            }}
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
            businessHours={{
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
              startTime: '07:00',
              endTime: '22:00',
            }}
            selectAllow={(selectInfo) => selectInfo.start >= new Date()}
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            }}
            dayHeaderFormat={{
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              omitCommas: true,
            }}
            events={calendarEvents}
            select={handleSelect}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            eventClick={handleEventClick}
            eventDidMount={(info) => {
              // Add tooltip title
              const props = info.event.extendedProps
              if (props.type === 'booking' && props.mentee) {
                info.el.setAttribute('title', `Booked by ${props.mentee.name ?? 'mentee'} · ${props.mentee.email}`)
              } else {
                info.el.setAttribute('title', 'Click to delete · Drag to move · Resize to adjust')
              }
            }}
          />
        )}
      </div>

      {/* ── Toast Notifications ─────────────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold animate-slide-in pointer-events-auto ${toastStyles[toast.type]}`}
          >
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {toastIcons[toast.type]}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  )
}
