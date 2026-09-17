import { notFound } from 'next/navigation'

import { LearningSpaceShell } from '@/components/learning/LearningSpaceShell'
import { loadLearningSpaceShell, type AuthorizedLearningSpaceShellData, type LearningSpaceShellData } from '@/lib/learning-space-shell'
import { learningSpaceRepository } from '@/lib/learning-space-service'
import { isAuthorizationError, requireLearningSpaceMember } from '@/lib/server-authorization'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

async function findShell(spaceId: string): Promise<LearningSpaceShellData | null> {
  const space = await prisma.learningSpace.findUnique({
    where: { id: spaceId },
    select: {
      id: true, title: true, state: true, objective: true, definitionOfDone: true,
      primarySkill: { select: { name: true } },
      members: { where: { status: 'ACTIVE' }, orderBy: { joinedAt: 'asc' }, select: { user: { select: { id: true, name: true, email: true } } } },
      topics: { orderBy: { createdAt: 'asc' }, select: { id: true, label: true, state: true } },
      bookings: { orderBy: { startTime: 'asc' }, select: { id: true, startTime: true, endTime: true, status: true } },
    },
  })
  if (!space) return null
  return { ...space, primarySkillName: space.primarySkill.name, members: space.members.map(member => member.user) }
}

export default async function LearningSpacePage({ params }: { params: Promise<{ spaceId: string }> }) {
  const { spaceId } = await params
  let space: AuthorizedLearningSpaceShellData | null
  try {
    space = await loadLearningSpaceShell(spaceId, {
      requireMember: id => requireLearningSpaceMember(id, learningSpaceRepository),
      findShell,
    })
  } catch (error) {
    // An authorization failure and a missing record intentionally share the
    // same route result. Unexpected failures reach error.tsx so the member
    // receives a retry affordance instead of a misleading privacy response.
    if (isAuthorizationError(error)) notFound()
    throw error
  }
  // Treat an inaccessible ID exactly like an absent record. This prevents a
  // route response from disclosing whether a private space exists.
  if (!space) notFound()
  return <LearningSpaceShell space={space} />
}
