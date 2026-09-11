'use client'

import { useEffect, useMemo, useState } from 'react'

interface SessionPolicyTimelineProps {
  endTime: Date
  bookingStatus: string
  role: 'mentor' | 'mentee'
}

const HOUR_MS = 60 * 60 * 1000
const REVIEW_DEADLINE_HOURS = 48
const AUTO_COMPLETE_HOURS = 72

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatCountdown(milliseconds: number) {
  if (milliseconds <= 0) return 'Đã đến hạn'
  const totalMinutes = Math.ceil(milliseconds / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return 'Còn ' + days + ' ngày ' + hours + ' giờ'
  if (hours > 0) return 'Còn ' + hours + ' giờ ' + minutes + ' phút'
  return 'Còn ' + minutes + ' phút'
}

function pointState(status: string) {
  if (status === 'COMPLETED') return 'Đã chuyển 1 GivePoint cho Mentor.'
  if (status === 'MISSED') return 'Đã hoàn 1 GivePoint cho Mentee.'
  if (status === 'DISPUTED') return 'GivePoint tiếp tục bị giữ để Admin xem xét.'
  if (status === 'CANCELLED') return 'GivePoint đã được xử lý theo biên nhận hủy.'
  return '1 GivePoint đang được giữ cho đến khi booking được chốt.'
}

export default function SessionPolicyTimeline({
  endTime,
  bookingStatus,
  role,
}: SessionPolicyTimelineProps) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(interval)
  }, [])

  const timeline = useMemo(() => {
    const end = new Date(endTime)
    const reviewDeadline = new Date(end.getTime() + REVIEW_DEADLINE_HOURS * HOUR_MS)
    const autoCompleteAt = new Date(end.getTime() + AUTO_COMPLETE_HOURS * HOUR_MS)
    return { end, reviewDeadline, autoCompleteAt }
  }, [endTime])

  const isSettled = ['COMPLETED', 'MISSED', 'DISPUTED', 'CANCELLED'].includes(bookingStatus)
  const reviewCountdown = now < timeline.end.getTime()
    ? 'Mở sau khi buổi học kết thúc'
    : now <= timeline.reviewDeadline.getTime()
      ? formatCountdown(timeline.reviewDeadline.getTime() - now)
      : 'Đã quá hạn'
  const autoCountdown = isSettled
    ? 'Booking đã được chốt'
    : now < timeline.end.getTime()
      ? 'Chưa bắt đầu'
      : formatCountdown(timeline.autoCompleteAt.getTime() - now)

  const items = [
    {
      title: 'Kết thúc buổi học',
      detail: formatDate(timeline.end),
      done: now >= timeline.end.getTime(),
    },
    {
      title: 'Hạn review / báo vắng: 48 giờ',
      detail: formatDate(timeline.reviewDeadline) + ' · ' + reviewCountdown,
      done: isSettled || now > timeline.reviewDeadline.getTime(),
    },
    {
      title: 'Khóa booking mới nếu chưa review',
      detail: isSettled
        ? 'Không áp dụng — booking đã được chốt.'
        : role === 'mentee'
          ? 'Từ ' + formatDate(timeline.reviewDeadline) + ' đến khi bạn review hoặc hệ thống tự chốt.'
          : 'Mentee bị khóa từ thời điểm này đến khi review hoặc hệ thống tự chốt.',
      done: isSettled,
    },
    {
      title: 'Hệ thống tự chốt sau 72 giờ',
      detail: formatDate(timeline.autoCompleteAt) + ' · ' + autoCountdown,
      done: isSettled || now >= timeline.autoCompleteAt.getTime(),
    },
  ]

  return (
    <section className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <h3 className="text-sm font-bold text-indigo-950">Timeline sau buổi học</h3>
      <div className="mt-3 space-y-3">
        {items.map((item, index) => (
          <div key={item.title} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ' + (item.done ? 'bg-emerald-600 text-white' : 'bg-white text-indigo-700 ring-1 ring-indigo-300')}>
                {item.done ? '✓' : index + 1}
              </span>
              {index < items.length - 1 && <span className="mt-1 h-full min-h-5 w-px bg-indigo-200" />}
            </div>
            <div className="pb-1">
              <p className="text-xs font-semibold text-slate-900">{item.title}</p>
              <p className="mt-0.5 text-xs text-slate-600">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 rounded-lg border border-indigo-100 bg-white/80 p-3 text-xs font-medium text-indigo-950">
        {pointState(bookingStatus)}
      </div>
    </section>
  )
}
