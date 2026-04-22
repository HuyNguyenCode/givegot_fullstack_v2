'use client'

import { Download } from 'lucide-react'
import type { WithdrawRequestWithMentor } from '@/actions/admin-finance'

interface ExportPayoutButtonProps {
  pendingRequests: WithdrawRequestWithMentor[]
}

function escapeCSV(value: string | number): string {
  const str = String(value)
  // Wrap in quotes and escape any existing quotes if the value contains
  // commas, quotes, or newlines — standard RFC 4180 CSV escaping.
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function ExportPayoutButton({ pendingRequests }: ExportPayoutButtonProps) {
  const handleExport = () => {
    if (pendingRequests.length === 0) return

    const headers = ['Bank_Details', 'Amount_VND', 'Mentor_Name', 'Mentor_Email', 'Points', 'Note']

    const rows = pendingRequests.map((req) => [
      escapeCSV(req.bankDetails),
      escapeCSV(req.fiatAmount),
      escapeCSV(req.mentor.name ?? req.mentor.email),
      escapeCSV(req.mentor.email),
      escapeCSV(req.pointsRequested),
      escapeCSV('GiveGot Payout'),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\r\n')

    // Prepend UTF-8 BOM so Vietnamese characters render correctly in Excel
    const bom = '\uFEFF'
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)

    const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const link  = document.createElement('a')
    link.href     = url
    link.download = `givegot_payouts_${today}.csv`
    link.click()

    URL.revokeObjectURL(url)
  }

  const disabled = pendingRequests.length === 0

  return (
    <button
      onClick={handleExport}
      disabled={disabled}
      title={disabled ? 'No pending requests to export' : `Export ${pendingRequests.length} pending payout(s)`}
      className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
    >
      <Download className="w-4 h-4" />
      Export CSV
      {!disabled && (
        <span className="bg-white/20 text-white text-xs font-bold px-1.5 py-0.5 rounded-full tabular-nums">
          {pendingRequests.length}
        </span>
      )}
    </button>
  )
}
