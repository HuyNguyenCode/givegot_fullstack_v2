'use client'

import { useEffect, useState, useTransition } from 'react'
import {
  getAllReports,
  getAttendanceEvidence,
  resolveReport,
  resolveAbsenceReport,
  type AbsenceResolutionType,
  type AttendanceEvidenceResult,
} from '@/actions/admin'
import { ReportStatus } from '@prisma/client'
import Image from 'next/image'
import { AlertTriangle, CheckCircle, Clock, ShieldAlert } from 'lucide-react'

interface ReportData {
  id: string
  reason: string
  status: ReportStatus
  createdAt: Date
  resolvedAt: Date | null
  bookingId?: string | null
  booking: {
    id: string
    status: string
    startTime: Date
    endTime: Date
  } | null
  reporter: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
  }
  reportedUser: {
    id: string
    email: string
    name: string | null
    avatarUrl: string | null
  }
}

// Bookings already in a terminal state can't be resolved financially again
// (avoids double-refunding/double-penalizing) — mirrors the guard in
// `resolveAbsenceReport` on the server so the UI can pre-emptively explain why.
const TERMINAL_BOOKING_STATUSES = ['MISSED', 'CANCELLED', 'COMPLETED']

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'resolved'>('all')

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    setIsLoading(true)
    try {
      const data = await getAllReports()
      setReports(data as ReportData[])
    } catch (error) {
      console.error('Failed to load reports:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredReports = reports.filter(report => {
    if (filter === 'pending') return report.status === 'PENDING'
    if (filter === 'resolved') return report.status === 'RESOLVED'
    return true
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Quản lý báo cáo</h2>
        <p className="text-gray-600">Xem xét và xử lý báo cáo từ người dùng</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Tổng số báo cáo</div>
          <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Đang chờ xử lý</div>
          <div className="text-2xl font-bold text-orange-600">
            {reports.filter(r => r.status === 'PENDING').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Đã xử lý</div>
          <div className="text-2xl font-bold text-green-600">
            {reports.filter(r => r.status === 'RESOLVED').length}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'all'
                ? 'bg-red-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Tất cả báo cáo
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'pending'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Đang chờ xử lý
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'resolved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Đã xử lý
          </button>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">Không tìm thấy báo cáo nào</h3>
          <p className="text-gray-600">
            {filter === 'pending' && 'Không có báo cáo nào đang chờ xử lý'}
            {filter === 'resolved' && 'Chưa có báo cáo nào được xử lý'}
            {filter === 'all' && 'Chưa có báo cáo nào được gửi'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <ReportCard key={report.id} report={report} onResolved={loadReports} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Report Card ─────────────────────────────────────────────────────────────

function ReportCard({ report, onResolved }: { report: ReportData; onResolved: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<AbsenceResolutionType | 'GENERIC' | null>(null)
  const [adminNotes, setAdminNotes] = useState('')
  const [attendanceEvidence, setAttendanceEvidence] = useState<AttendanceEvidenceResult | null>(null)
  const [isEvidenceLoading, setIsEvidenceLoading] = useState(false)

  const isBookingLinked = !!report.bookingId
  const isBookingTerminal = !!report.booking && TERMINAL_BOOKING_STATUSES.includes(report.booking.status)
  const canResolveFinancially = isBookingLinked && !isBookingTerminal

  useEffect(() => {
    if (!report.bookingId) return

    let isCancelled = false
    setIsEvidenceLoading(true)
    setAttendanceEvidence(null)

    getAttendanceEvidence(report.bookingId)
      .then((result) => {
        if (!isCancelled) setAttendanceEvidence(result)
      })
      .catch((error) => {
        console.error('Failed to load attendance evidence:', error)
        if (!isCancelled) {
          setAttendanceEvidence({
            success: false,
            message: 'Failed to fetch attendance evidence.',
          })
        }
      })
      .finally(() => {
        if (!isCancelled) setIsEvidenceLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [report.bookingId])

  const runAbsenceResolution = (resolutionType: AbsenceResolutionType, confirmMessage: string) => {
    if (!confirm(confirmMessage)) return
    setPendingAction(resolutionType)
    startTransition(async () => {
      try {
        const result = await resolveAbsenceReport({
          reportId: report.id,
          bookingId: report.bookingId!,
          resolutionType,
          adminNotes: adminNotes.trim() || undefined,
        })
        alert(result.message)
        if (result.success) onResolved()
      } catch {
        alert('Đã có lỗi xảy ra. Vui lòng thử lại.')
      } finally {
        setPendingAction(null)
      }
    })
  }

  const handleGenericResolve = () => {
    if (!confirm('Đánh dấu báo cáo này là đã xử lý?')) return
    setPendingAction('GENERIC')
    startTransition(async () => {
      try {
        const result = await resolveReport(report.id)
        alert(result.message)
        if (result.success) onResolved()
      } catch {
        alert('Đã có lỗi xảy ra. Vui lòng thử lại.')
      } finally {
        setPendingAction(null)
      }
    })
  }

  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
        report.status === 'PENDING' ? 'border-orange-500' : 'border-green-500'
      }`}
    >
      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {report.status === 'PENDING' ? (
            <Clock className="w-5 h-5 text-orange-600" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-600" />
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              report.status === 'PENDING'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-green-100 text-green-800'
            }`}
          >
            {report.status}
          </span>
          {isBookingLinked && (
            <span className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800">
              <ShieldAlert className="w-3.5 h-3.5" />
              Tranh chấp buổi học{report.booking ? ` · ${report.booking.status}` : ''}
            </span>
          )}
          <span className="text-sm text-gray-500">
            {new Date(report.createdAt).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-4">
        {/* Reporter */}
        <div>
          <div className="text-xs text-gray-500 mb-2">NGƯỜI BÁO CÁO</div>
          <div className="flex items-center gap-3">
            {report.reporter.avatarUrl && (
              <Image
                src={report.reporter.avatarUrl}
                alt={report.reporter.name || 'Người báo cáo'}
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <div>
              <div className="font-semibold text-gray-900">
                {report.reporter.name || 'Người dùng ẩn danh'}
              </div>
              <div className="text-sm text-gray-500">{report.reporter.email}</div>
            </div>
          </div>
        </div>

        {/* Reported User */}
        <div>
          <div className="text-xs text-gray-500 mb-2">NGƯỜI BỊ BÁO CÁO</div>
          <div className="flex items-center gap-3">
            {report.reportedUser.avatarUrl && (
              <Image
                src={report.reportedUser.avatarUrl}
                alt={report.reportedUser.name || 'Người bị báo cáo'}
                width={40}
                height={40}
                className="rounded-full"
              />
            )}
            <div>
              <div className="font-semibold text-gray-900">
                {report.reportedUser.name || 'Người dùng ẩn danh'}
              </div>
              <div className="text-sm text-gray-500">{report.reportedUser.email}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Reason */}
      <div className="bg-gray-50 rounded-lg p-4 mb-4">
        <div className="text-xs text-gray-500 mb-2">LÝ DO</div>
        <p className="text-gray-900 whitespace-pre-wrap">{report.reason}</p>
      </div>

      {/* Objective attendance evidence is loaded independently per card. */}
      {isBookingLinked && (
        <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold text-blue-950">Attendance Evidence</h4>
            {attendanceEvidence?.success && (
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                Source: {attendanceEvidence.source === 'api' ? 'Google Meet' : 'Mock data'}
              </span>
            )}
          </div>

          {isEvidenceLoading ? (
            <div className="flex items-center gap-2 text-sm text-blue-700" role="status">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
              Loading attendance evidence...
            </div>
          ) : attendanceEvidence?.success ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <AttendanceMetric label="Mentor" minutes={attendanceEvidence.mentorMinutes} />
              <AttendanceMetric label="Mentee" minutes={attendanceEvidence.menteeMinutes} />
            </div>
          ) : (
            <p className="text-sm font-medium text-red-700" role="alert">
              {attendanceEvidence?.message ?? 'Attendance evidence is unavailable.'}
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      {report.status === 'PENDING' && (
        canResolveFinancially ? (
          <div className="space-y-3 border-t border-gray-100 pt-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">
                Ghi chú admin (tùy chọn)
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                disabled={isPending}
                rows={2}
                placeholder="Ví dụ: đã đối chiếu lịch sử chat, xác nhận qua ảnh chụp màn hình..."
                className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-red-400 disabled:opacity-50"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={() =>
                  runAbsenceResolution(
                    'RESOLVE_MENTEE_ABSENT',
                    'Xác nhận Mentee vắng mặt? 1 GivePoint sẽ chuyển cho Mentor và Mentee sẽ bị trừ Trust Score. Không thể hoàn tác.'
                  )
                }
                disabled={isPending}
                className="bg-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending && pendingAction === 'RESOLVE_MENTEE_ABSENT'
                  ? 'Đang xử lý…'
                  : 'Xác nhận Mentee Vắng'}
              </button>
              <button
                onClick={() =>
                  runAbsenceResolution(
                    'RESOLVE_MENTOR_ABSENT',
                    'Xác nhận Mentor vắng mặt? 1 GivePoint sẽ hoàn cho Mentee và Mentor sẽ bị trừ Trust Score. Không thể hoàn tác.'
                  )
                }
                disabled={isPending}
                className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending && pendingAction === 'RESOLVE_MENTOR_ABSENT'
                  ? 'Đang xử lý…'
                  : 'Xác nhận Mentor Vắng'}
              </button>
              <button
                onClick={() =>
                  runAbsenceResolution(
                    'RESOLVE_SYSTEM_ERROR',
                    'Xác định đây là lỗi hệ thống? 1 GivePoint sẽ được hoàn 100% cho Mentee, không ai bị trừ Trust Score. Không thể hoàn tác.'
                  )
                }
                disabled={isPending}
                className="bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending && pendingAction === 'RESOLVE_SYSTEM_ERROR'
                  ? 'Đang xử lý…'
                  : 'Hủy & Hoàn điểm'}
              </button>
            </div>
          </div>
        ) : isBookingLinked && isBookingTerminal ? (
          <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 border-t border-gray-100">
            Buổi học liên quan đã ở trạng thái cuối ({report.booking?.status}) — GivePoints/Trust Score đã được xử lý trước đó.
            Bạn vẫn có thể đóng ticket này thủ công:
            <div className="flex justify-end mt-2">
              <button
                onClick={handleGenericResolve}
                disabled={isPending}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50"
              >
                {isPending && pendingAction === 'GENERIC' ? 'Đang xử lý…' : 'Đánh dấu đã xử lý'}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={handleGenericResolve}
              disabled={isPending}
              className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending && pendingAction === 'GENERIC' ? 'Đang xử lý…' : 'Đánh dấu đã xử lý'}
            </button>
          </div>
        )
      )}

      {report.status === 'RESOLVED' && report.resolvedAt && (
        <div className="text-sm text-gray-500">
          Đã xử lý vào {new Date(report.resolvedAt).toLocaleString()}
        </div>
      )}
    </div>
  )
}
function AttendanceMetric({ label, minutes }: { label: 'Mentor' | 'Mentee'; minutes: number }) {
  const attended = minutes > 0

  return (
    <div
      className={
        'rounded-md border px-3 py-3 ' +
        (attended
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-red-200 bg-red-50 text-red-800')
      }
    >
      <span className="font-semibold">{label}:</span> {minutes} minutes joined
    </div>
  )
}
