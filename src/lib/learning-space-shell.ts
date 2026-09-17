/**
 * D1's small read boundary.  Keeping the authorization call ahead of the
 * query makes it difficult for a route to accidentally render private space
 * metadata before active membership has been established from the session.
 */
export type LearningSpaceShellData = {
  id: string
  title: string
  state: 'ACTIVE' | 'ARCHIVED'
  primarySkillName: string
  objective: string | null
  definitionOfDone: string | null
  members: Array<{ id: string; name: string | null; email: string | null }>
  topics: Array<{ id: string; label: string; state: 'ACTIVE' | 'ARCHIVED' }>
  bookings: Array<{ id: string; startTime: Date; endTime: Date; status: string }>
}

export type AuthorizedLearningSpaceShellData = LearningSpaceShellData & { viewerId: string }

type Dependencies = {
  requireMember(spaceId: string): Promise<{ user: { id: string } }>
  findShell(spaceId: string): Promise<LearningSpaceShellData | null>
}

export async function loadLearningSpaceShell(
  spaceId: string,
  dependencies: Dependencies,
): Promise<AuthorizedLearningSpaceShellData | null> {
  // `requireMember` obtains identity from auth(); no client identity reaches
  // this boundary. It intentionally runs before any private read.
  const { user } = await dependencies.requireMember(spaceId)
  const shell = await dependencies.findShell(spaceId)
  return shell && { ...shell, viewerId: user.id }
}
