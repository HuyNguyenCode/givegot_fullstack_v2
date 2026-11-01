import { NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import type { SpaceListingItem } from '@/lib/learning-space-listing'

export function createSpaceListingHandler(list: () => Promise<SpaceListingItem[]>) {
  return async () => {
    try {
      return NextResponse.json({ spaces: await list() }, { headers: { 'Cache-Control': 'private, no-store' } })
    } catch (error) {
      return NextResponse.json({ error: isAuthorizationError(error) ? error.message : 'Không thể tải không gian' }, { status: isAuthorizationError(error) ? error.status : 500, headers: { 'Cache-Control': 'private, no-store' } })
    }
  }
}
