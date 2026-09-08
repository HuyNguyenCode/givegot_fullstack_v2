import { refreshApprovedSkillEmbedding } from '../src/lib/skill-embedding'
import { prisma } from '../src/lib/prisma'

// Explicit maintenance command only; never runs from a user request or migration.
// Uses the exact same claims, attempt limit, validation and stale-write guards.
async function main() {
  const skills = await prisma.skill.findMany({
    where: { status: 'APPROVED', embeddingStatus: { not: 'READY' } },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })
  let ready = 0
  for (const skill of skills) {
    const result = await refreshApprovedSkillEmbedding(skill.id)
    if (result.ready) ready++
    console.log(skill.name, result.ready ? 'READY' : 'Not ready: retry limit, active lease or AI failure')
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  console.log({ checked: skills.length, ready })
}
main().catch(error => { console.error(error); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
