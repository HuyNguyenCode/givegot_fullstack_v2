/**
 * Badge system for GiveGot Trust Score.
 *
 * Each badge is a pure data object — no DB writes happen here.
 * Badges are computed on-the-fly from the user's live metrics.
 */

export interface Badge {
  id: string
  name: string
  /** Lucide React icon name — consumed by the UI layer */
  icon: 'ShieldCheck' | 'Zap' | 'Star'
  description: string
  /** Tailwind colour classes for the chip background / text / ring */
  color: {
    bg: string
    text: string
    ring: string
    iconColor: string
  }
}

export interface BadgeInput {
  trustScore: number
  completedSessions: number
  avgRating: number
  /** Average response time in minutes, or null when unmeasurable */
  avgResponseTimeMinutes: number | null
}

/** All badge definitions (ordered by prestige) */
const BADGE_DEFINITIONS: Array<Badge & { check: (input: BadgeInput) => boolean }> = [
  {
    id: 'trusted_expert',
    name: 'Trusted Expert',
    icon: 'ShieldCheck',
    description: 'Trust Score ≥ 85 with 10+ completed sessions',
    color: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      ring: 'ring-emerald-400',
      iconColor: 'text-emerald-600',
    },
    check: ({ trustScore, completedSessions }) =>
      trustScore >= 85 && completedSessions >= 10,
  },
  {
    id: 'quick_responder',
    name: 'Quick Responder',
    icon: 'Zap',
    description: 'Average response time under 1 hour',
    color: {
      bg: 'bg-amber-50',
      text: 'text-amber-800',
      ring: 'ring-amber-400',
      iconColor: 'text-amber-500',
    },
    check: ({ avgResponseTimeMinutes }) =>
      avgResponseTimeMinutes !== null && avgResponseTimeMinutes <= 60,
  },
  {
    id: 'rising_star',
    name: 'Rising Star',
    icon: 'Star',
    description: '3+ sessions with a perfect 5-star rating',
    color: {
      bg: 'bg-purple-50',
      text: 'text-purple-800',
      ring: 'ring-purple-400',
      iconColor: 'text-purple-600',
    },
    check: ({ completedSessions, avgRating }) =>
      completedSessions >= 3 && avgRating === 5,
  },
]

/**
 * Returns the list of badges earned by a user based on their current metrics.
 * Pure function — safe to call anywhere (client or server).
 */
export function getUserBadges(input: BadgeInput): Badge[] {
  return BADGE_DEFINITIONS.filter((def) => def.check(input)).map(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ({ check, ...badge }) => badge,
  )
}
