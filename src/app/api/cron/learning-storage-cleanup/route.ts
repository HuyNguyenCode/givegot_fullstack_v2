import { NextResponse } from 'next/server'

import { authorizeCronRequest } from '@/lib/cron-auth'
import { learningStorageService } from '@/lib/learning-storage-runtime'

export async function GET(request: Request) {
  const denial = authorizeCronRequest(request)
  if (denial) return denial
  try { return NextResponse.json(await learningStorageService().cleanupOrphans()) }
  catch { return NextResponse.json({ error: 'Storage cleanup failed' }, { status: 502 }) }
}
