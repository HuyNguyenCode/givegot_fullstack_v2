import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getWithdrawRequests } from '@/actions/admin-finance'
import ExportPayoutButton from '@/components/admin/ExportPayoutButton'
import WithdrawActionButtons from '@/components/admin/WithdrawActionButtons'
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Banknote,
  Users,
  TrendingDown,
} from 'lucide-react'

// ── Auth guard ────────────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin')

  const user = await prisma.user.findUnique({
    where:  { id: session.user.id },
    select: { role: true },
  })
  if (user?.role !== 'ADMIN') redirect('/')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatVND(amount: number) {
  return amount.toLocaleString('vi-VN') + ' ₫'
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('vi-VN', {
    day:   '2-digit',
    month: '2-digit',
    year:  'numeric',
  })
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString('vi-VN', {
    hour:   '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    PENDING:  'bg-amber-100  text-amber-700  border-amber-200',
    APPROVED: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    REJECTED: 'bg-red-100    text-red-600    border-red-200',
  }
  const icons: Record<string, React.ReactNode> = {
    PENDING:  <Clock       className="w-3 h-3" />,
    APPROVED: <CheckCircle2 className="w-3 h-3" />,
    REJECTED: <XCircle     className="w-3 h-3" />,
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] ?? styles.REJECTED}`}>
      {icons[status]}
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminFinancePage() {
  await requireAdmin()

  const requests = await getWithdrawRequests()

  const pending  = requests.filter((r) => r.status === 'PENDING')
  const approved = requests.filter((r) => r.status === 'APPROVED')
  const rejected = requests.filter((r) => r.status === 'REJECTED')

  const totalPendingVND  = pending.reduce((s, r) => s + r.fiatAmount, 0)
  const totalApprovedVND = approved.reduce((s, r) => s + r.fiatAmount, 0)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header bar ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-purple-100 p-2 rounded-xl">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Finance Dashboard</h1>
              <p className="text-xs text-gray-500">GiveGot Admin · Withdrawal requests</p>
            </div>
          </div>
          <ExportPayoutButton pendingRequests={pending} />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={<Clock className="w-5 h-5 text-amber-600" />}
            bg="bg-amber-50"
            label="Pending Requests"
            value={pending.length}
            sub={formatVND(totalPendingVND) + ' to disburse'}
          />
          <StatCard
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            bg="bg-emerald-50"
            label="Approved"
            value={approved.length}
            sub={formatVND(totalApprovedVND) + ' paid out'}
          />
          <StatCard
            icon={<XCircle className="w-5 h-5 text-red-500" />}
            bg="bg-red-50"
            label="Rejected"
            value={rejected.length}
            sub="Denied requests"
          />
          <StatCard
            icon={<Users className="w-5 h-5 text-purple-600" />}
            bg="bg-purple-50"
            label="Total Requests"
            value={requests.length}
            sub="All time"
          />
        </div>

        {/* ── Requests table ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Banknote className="w-4 h-4 text-gray-500" />
              <h2 className="text-sm font-bold text-gray-800">Withdrawal Requests</h2>
            </div>
            <div className="flex items-center gap-2">
              {pending.length > 0 && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full border border-amber-200">
                  {pending.length} pending
                </span>
              )}
              <span className="text-xs text-gray-400">{requests.length} total</span>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-2 text-gray-400">
              <TrendingDown className="w-10 h-10 text-gray-200" />
              <p className="text-sm font-medium">No withdrawal requests yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Date', 'Mentor', 'Points', 'Amount (VND)', 'Bank Details', 'Status', 'Actions'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-5 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {requests.map((req) => {
                    const isPending = req.status === 'PENDING'
                    return (
                      <tr
                        key={req.id}
                        className={`transition-colors ${
                          isPending
                            ? 'bg-amber-50/50 hover:bg-amber-50'
                            : 'hover:bg-gray-50/60'
                        }`}
                      >
                        {/* Date */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="font-semibold text-gray-700">{formatDate(req.createdAt)}</div>
                          <div className="text-xs text-gray-400">{formatTime(req.createdAt)}</div>
                        </td>

                        {/* Mentor */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            {req.mentor.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={req.mentor.avatarUrl}
                                alt={req.mentor.name ?? ''}
                                className="w-7 h-7 rounded-full ring-1 ring-gray-200 object-cover"
                              />
                            ) : (
                              <span className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 text-xs font-bold flex-shrink-0">
                                {(req.mentor.name ?? req.mentor.email)[0].toUpperCase()}
                              </span>
                            )}
                            <div className="min-w-0">
                              <div className="font-semibold text-gray-800 truncate max-w-[120px]">
                                {req.mentor.name ?? '—'}
                              </div>
                              <div className="text-xs text-gray-400 truncate max-w-[120px]">
                                {req.mentor.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Points */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-bold text-gray-800">
                            {req.pointsRequested.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400 ml-1">pts</span>
                        </td>

                        {/* Amount */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="font-bold text-gray-800">{formatVND(req.fiatAmount)}</span>
                        </td>

                        {/* Bank Details */}
                        <td className="px-5 py-4 max-w-[200px]">
                          <p
                            className="text-gray-700 text-xs leading-relaxed break-words"
                            title={req.bankDetails}
                          >
                            {req.bankDetails}
                          </p>
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          <StatusBadge status={req.status} />
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 whitespace-nowrap">
                          {isPending ? (
                            <WithdrawActionButtons requestId={req.id} />
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              {req.status === 'APPROVED' ? 'Transferred' : 'Denied'}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ── StatCard sub-component ────────────────────────────────────────────────────

function StatCard({
  icon,
  bg,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode
  bg: string
  label: string
  value: number
  sub: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm flex items-start gap-4">
      <div className={`${bg} p-2.5 rounded-xl flex-shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide truncate">{label}</p>
        <p className="text-2xl font-extrabold text-gray-800 leading-tight">{value}</p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{sub}</p>
      </div>
    </div>
  )
}
