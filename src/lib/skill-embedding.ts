import { randomUUID } from 'node:crypto'
import { prisma } from './prisma'
import { generateSkillEmbedding } from './gemini'
import { PUBLISHED_SKILL_WHERE } from './skill-publication'

export type EmbeddingResult = { ready: boolean; published: boolean; name?: string }
const unavailable: EmbeddingResult = { ready: false, published: false }

// One AI attempt per call; at most 3 per content/moderation revision.
// PROCESSING leases older than 5 minutes may be reclaimed after a crashed worker.
export async function refreshApprovedSkillEmbedding(skillId: string): Promise<EmbeddingResult> {
  const token = randomUUID()
  let version: number | undefined
  try {
    const skill = await prisma.skill.findUnique({
      where: { id: skillId },
      select: { id: true, name: true, status: true, embeddingStatus: true, embeddingVersion: true },
    })
    if (!skill || skill.status !== 'APPROVED') return unavailable
    if (skill.embeddingStatus === 'READY') return { ready: true, published: false, name: skill.name }
    version = skill.embeddingVersion
    const claimed = await prisma.$executeRaw`
      UPDATE "Skill"
      SET "embeddingStatus" = 'PROCESSING', "embeddingToken" = ${token},
          "embeddingStartedAt" = NOW(), "embeddingAttempts" = "embeddingAttempts" + 1,
          "embeddingError" = NULL
      WHERE id = ${skillId} AND status = 'APPROVED'
        AND "embeddingVersion" = ${version} AND name = ${skill.name}
        AND "embeddingAttempts" < 3
        AND ("embeddingStatus" IN ('NOT_STARTED', 'FAILED')
          OR ("embeddingStatus" = 'PROCESSING'
            AND "embeddingStartedAt" < NOW() - INTERVAL '5 minutes'))
    `
    if (claimed !== 1) return unavailable

    const vector = await generateSkillEmbedding([skill.name])
    if (vector.length !== 768 || !vector.every(Number.isFinite) || !vector.some(v => v !== 0)) {
      throw new Error('Invalid embedding')
    }
    const encoded = `[${vector.join(',')}]`
    const written = await prisma.$executeRaw`
      UPDATE "Skill"
      SET embedding = ${encoded}::vector, "embeddingStatus" = 'READY',
          "embeddingToken" = NULL, "embeddingStartedAt" = NULL, "embeddingError" = NULL
      WHERE id = ${skillId} AND status = 'APPROVED' AND name = ${skill.name}
        AND "embeddingVersion" = ${version} AND "embeddingToken" = ${token}
        AND "embeddingStatus" = 'PROCESSING'
    `
    return written === 1 ? { ready: true, published: true, name: skill.name } : unavailable
  } catch (error) {
    console.error('[BR-11] Embedding attempt failed:', error)
    if (version !== undefined) {
      try {
        await prisma.skill.updateMany({
          where: { id: skillId, status: 'APPROVED', embeddingVersion: version, embeddingToken: token, embeddingStatus: 'PROCESSING' },
          data: { embeddingStatus: 'FAILED', embeddingToken: null, embeddingStartedAt: null,
            embeddingError: 'Không tạo được embedding. Admin có thể thử lại (tối đa 3 lần mỗi phiên bản).' },
        })
      } catch (persistError) {
        console.error('[BR-11] Could not persist failure; processing lease will expire:', persistError)
      }
    }
    return unavailable
  }
}

// Keep private profile links intact, but only embed published skill names.
// "Approved" alone is insufficient: BR-11 requires APPROVED + READY.
export async function getPublishedSkillNames(skillIds: string[]): Promise<string[]> {
  const skills = await prisma.skill.findMany({
    where: { id: { in: skillIds }, ...PUBLISHED_SKILL_WHERE },
    select: { id: true, name: true },
  })
  const names = new Map(skills.map(skill => [skill.id, skill.name]))
  return skillIds.flatMap(id => names.has(id) ? [names.get(id)!] : [])
}

// Backward-compatible alias for any existing internal caller. New code should
// use getPublishedSkillNames so the publication requirement is explicit.
export const getApprovedSkillNames = getPublishedSkillNames
