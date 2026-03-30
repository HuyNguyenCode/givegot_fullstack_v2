'use client'

import { useEffect, useState } from 'react'
import { getAllReports, resolveReport } from '@/actions/admin'
import { ReportStatus } from '@prisma/client'
import Image from 'next/image'
import { AlertTriangle, CheckCircle, Clock } from 'lucide-react'

interface ReportData {
  id: string
  reason: string
  status: ReportStatus
  createdAt: Date
  resolvedAt: Date | null
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

  const handleResolve = async (reportId: string) => {
    if (!confirm('Mark this report as resolved?')) return

    const result = await resolveReport(reportId)
    if (result.success) {
      alert(result.message)
      loadReports()
    } else {
      alert(result.message)
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
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Report Management</h2>
        <p className="text-gray-600">Review and resolve user reports</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Total Reports</div>
          <div className="text-2xl font-bold text-gray-900">{reports.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Pending</div>
          <div className="text-2xl font-bold text-orange-600">
            {reports.filter(r => r.status === 'PENDING').length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-4">
          <div className="text-sm text-gray-600">Resolved</div>
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
            All Reports
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'pending'
                ? 'bg-orange-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('resolved')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              filter === 'resolved'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Resolved
          </button>
        </div>
      </div>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Reports Found</h3>
          <p className="text-gray-600">
            {filter === 'pending' && 'No pending reports to review'}
            {filter === 'resolved' && 'No resolved reports yet'}
            {filter === 'all' && 'No reports have been filed'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => (
            <div
              key={report.id}
              className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                report.status === 'PENDING' ? 'border-orange-500' : 'border-green-500'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
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
                  <span className="text-sm text-gray-500">
                    {new Date(report.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-4">
                {/* Reporter */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">REPORTED BY</div>
                  <div className="flex items-center gap-3">
                    {report.reporter.avatarUrl && (
                      <Image
                        src={report.reporter.avatarUrl}
                        alt={report.reporter.name || 'Reporter'}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">
                        {report.reporter.name || 'Anonymous'}
                      </div>
                      <div className="text-sm text-gray-500">{report.reporter.email}</div>
                    </div>
                  </div>
                </div>

                {/* Reported User */}
                <div>
                  <div className="text-xs text-gray-500 mb-2">REPORTED USER</div>
                  <div className="flex items-center gap-3">
                    {report.reportedUser.avatarUrl && (
                      <Image
                        src={report.reportedUser.avatarUrl}
                        alt={report.reportedUser.name || 'Reported User'}
                        width={40}
                        height={40}
                        className="rounded-full"
                      />
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">
                        {report.reportedUser.name || 'Anonymous'}
                      </div>
                      <div className="text-sm text-gray-500">{report.reportedUser.email}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="text-xs text-gray-500 mb-2">REASON</div>
                <p className="text-gray-900">{report.reason}</p>
              </div>

              {/* Actions */}
              {report.status === 'PENDING' && (
                <div className="flex justify-end">
                  <button
                    onClick={() => handleResolve(report.id)}
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    Mark as Resolved
                  </button>
                </div>
              )}

              {report.status === 'RESOLVED' && report.resolvedAt && (
                <div className="text-sm text-gray-500">
                  Resolved on {new Date(report.resolvedAt).toLocaleString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
