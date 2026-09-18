import { LearningInviteJoin } from '@/components/learning/LearningInviteJoin'

export const dynamic = 'force-dynamic'

export default async function LearningInvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <LearningInviteJoin token={token} />
}
