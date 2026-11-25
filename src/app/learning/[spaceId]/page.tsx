import { notFound } from 'next/navigation'

import { LearningSpaceShell } from '@/components/learning/LearningSpaceShell'
import { findShell, loadLearningSpaceShell, type AuthorizedLearningSpaceShellData } from '@/lib/learning-space-shell'
import { learningSpaceRepository } from '@/lib/learning-space-service'
import { isAuthorizationError, requireLearningSpaceMember } from '@/lib/server-authorization'
import { listLearningResources } from '@/lib/learning-resource-service'

export const dynamic = 'force-dynamic'

export default async function LearningSpacePage({ params, searchParams }: { params: Promise<{ spaceId: string }>; searchParams: Promise<{ onboarding?: string }> }) {
  const { spaceId } = await params
  const { onboarding } = await searchParams
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
  const resourceData = await listLearningResources(spaceId, 'materials')
  return <LearningSpaceShell key={space.id} space={space} showFirstValue={onboarding === 'invite'} resources={resourceData.resources} quota={resourceData.quota} />
}
