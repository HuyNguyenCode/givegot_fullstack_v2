/**
 * Deprecated route — kept for backwards-compatibility with bookmarks / external links.
 * All traffic is permanently redirected to /profile/[id].
 */
import { redirect } from 'next/navigation'

export default async function DeprecatedMentorPage({
  params,
}: {
  params: Promise<{ mentorId: string }>
}) {
  const { mentorId } = await params
  redirect(`/profile/${mentorId}`)
}
