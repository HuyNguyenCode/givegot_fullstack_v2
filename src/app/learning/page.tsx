import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { MySpaces } from '@/components/learning/MySpaces'

export const dynamic = 'force-dynamic'
export default async function MySpacesPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/auth/signin?callbackUrl=%2Flearning')
  return <MySpaces />
}
