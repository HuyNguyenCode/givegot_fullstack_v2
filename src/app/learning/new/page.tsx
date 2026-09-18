import { redirect } from 'next/navigation'

import { BringYourPair } from '@/components/learning/BringYourPair'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export default async function NewLearningInvitePage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=%2Flearning%2Fnew')
  const skills = await prisma.skill.findMany({
    where: { status: 'APPROVED' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  })
  return <BringYourPair skills={skills} />
}
