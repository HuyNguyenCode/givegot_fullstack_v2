'use client'

import { ShieldCheck, Zap, Star, TrendingUp, AlertTriangle } from 'lucide-react'
import { TrustDashboardData } from '@/actions/analytics'
import { Badge } from '@/lib/badges'

interface Props {
  data: TrustDashboardData
  isOwner: boolean
}

// ── Circular progress ring ────────────────────────────────────────────────────
const RADIUS = 52
const CIRCUMFERENCE = 2 * Math.PI * RADIUS // ≈ 326.73

function TrustRing({ score }: { score: number }) {
  const offset = CIRCUMFERENCE * (1 - score / 100)

  const ringColor =
    score >= 80
      ? '#10b981' // emerald-500
      : score >= 50
      ? '#f59e0b' // amber-500
      : '#ef4444' // red-500

  const bgRingColor =
    score >= 80 ? '#d1fae5' : score >= 50 ? '#fef3c7' : '#fee2e2'

  const label =
    score >= 80 ? 'Excellent' : score >= 50 ? 'Good Standing' : 'Needs Attention'

  const labelColor =
    score >= 80
      ? 'text-emerald-700'
      : score >= 50
      ? 'text-amber-700'
      : 'text-red-700'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
          {/* Background track */}
          <circle
            cx="64"
            cy="64"
            r={RADIUS}
            fill="none"
            stroke={bgRingColor}
            strokeWidth="10"
          />
          {/* Progress arc */}
          <circle
            cx="64"
            cy="64"
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        {/* Score in the centre */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-gray-900">{score}</span>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            / 100
          </span>
        </div>
      </div>
      <span className={`text-sm font-semibold ${labelColor}`}>{label}</span>
    </div>
  )
}

// ── Badge icon resolver ───────────────────────────────────────────────────────

const ICON_MAP = {
  ShieldCheck,
  Zap,
  Star,
} as const

function BadgeChip({ badge }: { badge: Badge }) {
  const Icon = ICON_MAP[badge.icon]
  return (
    <div
      title={badge.description}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ring-1 ${badge.color.bg} ${badge.color.text} ${badge.color.ring} cursor-default select-none`}
    >
      <Icon className={`w-3.5 h-3.5 ${badge.color.iconColor}`} />
      {badge.name}
    </div>
  )
}

// ── Breakdown progress bar ────────────────────────────────────────────────────

function PillarBar({
  label,
  weight,
  score,
  detail,
}: {
  label: string
  weight: string
  score: number
  detail: string
}) {
  const barColor =
    score >= 80
      ? 'bg-emerald-500'
      : score >= 50
      ? 'bg-amber-400'
      : 'bg-red-400'

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">
          {label}{' '}
          <span className="text-xs text-gray-400 font-normal">({weight})</span>
        </span>
        <span className="text-sm font-semibold text-gray-800">{score}/100</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="mt-0.5 text-xs text-gray-500">{detail}</p>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

export default function TrustReputationCard({ data, isOwner }: Props) {
  const { trustScore, breakdown, badges } = data

  const completionPct = Math.round(breakdown.completionRate * 100)
  const cancellationPct = Math.round(breakdown.cancellationRate * 100)

  const responseDetail =
    breakdown.avgResponseHours !== null
      ? `Avg. response: ${breakdown.avgResponseHours < 1 ? '< 1 hr' : `${breakdown.avgResponseHours.toFixed(1)} hrs`}`
      : 'Not enough data to measure'

  const ratingDetail =
    breakdown.avgRating > 0
      ? `${breakdown.avgRating.toFixed(1)} ★ across ${breakdown.completedSessions} session${breakdown.completedSessions !== 1 ? 's' : ''}`
      : 'No reviews yet'

  return (
    <div className="px-8 pt-6 pb-2">
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50 border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-4 border-b border-gray-100">
          <ShieldCheck className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-gray-900">Trust &amp; Reputation</h2>
          {trustScore >= 85 && (
            <span className="ml-auto inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full ring-1 ring-emerald-300">
              <ShieldCheck className="w-3.5 h-3.5" />
              High Trust
            </span>
          )}
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[auto_1fr] gap-8">
          {/* Left: gauge + badges */}
          <div className="flex flex-col items-center gap-4 min-w-[160px]">
            <TrustRing score={trustScore} />

            {/* Session count pill */}
            <div className="text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                Sessions Completed
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {breakdown.completedSessions}
                <span className="text-sm text-gray-400 font-normal">
                  /{breakdown.totalSessions}
                </span>
              </p>
            </div>

            {/* Earned badges */}
            {badges.length > 0 ? (
              <div className="flex flex-wrap gap-2 justify-center">
                {badges.map((b) => (
                  <BadgeChip key={b.id} badge={b} />
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic text-center">
                Complete sessions to earn badges
              </p>
            )}
          </div>

          {/* Right: breakdown (owner-only) */}
          {isOwner && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <p className="text-sm font-semibold text-gray-700">
                  Score Breakdown
                </p>
              </div>

              <PillarBar
                label="Completion Rate"
                weight="40%"
                score={breakdown.completionScore}
                detail={`${completionPct}% of confirmed sessions completed`}
              />
              <PillarBar
                label="Average Rating"
                weight="30%"
                score={breakdown.ratingScore}
                detail={ratingDetail}
              />
              <PillarBar
                label="Response Time"
                weight="20%"
                score={breakdown.responseTimeScore}
                detail={responseDetail}
              />
              <PillarBar
                label="Reliability"
                weight="10%"
                score={breakdown.cancellationScore}
                detail={`${cancellationPct}% cancellation rate`}
              />

              {/* Action banner when score < 60 */}
              {trustScore < 60 && (
                <div className="mt-1 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Action Needed
                    </p>
                    <p className="text-sm text-amber-700 mt-0.5">
                      Complete your next 3 sessions without cancellations to
                      improve your Trust Score and unlock more bookings.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
