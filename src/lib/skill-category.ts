import { SkillCategory } from '@prisma/client'

/** Display order for grouped skill lists (dropdowns, admin table filters, etc). */
export const SKILL_CATEGORY_ORDER: SkillCategory[] = [
  SkillCategory.ACADEMIC,
  SkillCategory.DEVELOPMENT,
  SkillCategory.DESIGN,
  SkillCategory.BUSINESS,
  SkillCategory.LANGUAGE,
  SkillCategory.HEALTH,
  SkillCategory.OTHER,
]

/** Human-friendly label for each category. */
export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  [SkillCategory.ACADEMIC]: 'Học thuật',
  [SkillCategory.DEVELOPMENT]: 'Phát triển',
  [SkillCategory.DESIGN]: 'Thiết kế',
  [SkillCategory.BUSINESS]: 'Kinh doanh',
  [SkillCategory.LANGUAGE]: 'Ngoại ngữ',
  [SkillCategory.HEALTH]: 'Sức khỏe',
  [SkillCategory.OTHER]: 'Khác',
}

/** Tailwind badge classes per category, reused across admin + profile UIs. */
export const SKILL_CATEGORY_BADGE_CLASSES: Record<SkillCategory, string> = {
  [SkillCategory.ACADEMIC]: 'bg-amber-100 text-amber-700',
  [SkillCategory.DEVELOPMENT]: 'bg-blue-100 text-blue-700',
  [SkillCategory.DESIGN]: 'bg-pink-100 text-pink-700',
  [SkillCategory.BUSINESS]: 'bg-emerald-100 text-emerald-700',
  [SkillCategory.LANGUAGE]: 'bg-purple-100 text-purple-700',
  [SkillCategory.HEALTH]: 'bg-red-100 text-red-700',
  [SkillCategory.OTHER]: 'bg-gray-100 text-gray-700',
}

export interface CategorizedSkill {
  category: SkillCategory
}

/**
 * Groups an already-fetched, flat skill list by `category`, in the fixed
 * `SKILL_CATEGORY_ORDER`. Categories with no matching skills are omitted.
 * Purely a client-side convenience over the sorted list returned by
 * `getAllAvailableSkills` — no extra fetch/query involved.
 */
export function groupSkillsByCategory<T extends CategorizedSkill>(
  skills: T[]
): { category: SkillCategory; label: string; skills: T[] }[] {
  const groups = new Map<SkillCategory, T[]>()
  for (const skill of skills) {
    const bucket = groups.get(skill.category)
    if (bucket) {
      bucket.push(skill)
    } else {
      groups.set(skill.category, [skill])
    }
  }

  return SKILL_CATEGORY_ORDER.filter((category) => groups.has(category)).map((category) => ({
    category,
    label: SKILL_CATEGORY_LABELS[category],
    skills: groups.get(category)!,
  }))
}
