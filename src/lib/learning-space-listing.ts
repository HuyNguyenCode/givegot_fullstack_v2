import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'

export type SpaceListingItem = { id: string; title: string; state: 'ACTIVE' | 'ARCHIVED'; primarySkillName: string; partnerName: string | null }

type Dependencies = {
  authenticate(): Promise<{ id: string }>
  findAccount(userId: string): Promise<{ isSuspended: boolean; trustScore: number } | null>
  findSpaces(userId: string): Promise<SpaceListingItem[]>
}

export function assertAccountAccess(account: { isSuspended: boolean; trustScore: number } | null): void {
  if (!account || account.isSuspended || account.trustScore < 30) throw new AuthorizationError(403, 'Account access required')
}

export function createSpaceListing(deps: Dependencies) {
  return async () => {
    const user = await deps.authenticate()
    const account = await deps.findAccount(user.id)
    assertAccountAccess(account)
    return deps.findSpaces(user.id)
  }
}

export async function findListingSpaces(userId: string) {
    const spaces = await prisma.learningSpace.findMany({
      where: { members: { some: { userId, status: 'ACTIVE' } } },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true, title: true, state: true,
        primarySkill: { select: { name: true } },
        members: { where: { status: 'ACTIVE', userId: { not: userId } }, orderBy: { joinedAt: 'asc' }, take: 1, select: { user: { select: { name: true } } } },
      },
    })
    return spaces.map(space => ({ id: space.id, title: space.title, state: space.state, primarySkillName: space.primarySkill?.name ?? 'Chưa thiết lập', partnerName: space.members[0]?.user.name ?? null }))
}

export const listMySpaces = createSpaceListing({
  authenticate: requireAuthenticatedUser,
  findAccount: userId => prisma.user.findUnique({ where: { id: userId }, select: { isSuspended: true, trustScore: true } }),
  findSpaces: findListingSpaces,
})

