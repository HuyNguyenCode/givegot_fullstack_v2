import { NextRequest, NextResponse } from 'next/server'
import { learningActivityService, LearningActivityError } from '@/lib/learning-activity-service'
import { isAuthorizationError } from '@/lib/server-authorization'

export function createLearningActivityGet(service = learningActivityService) {
  return async (request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => {
    try {
      const { spaceId } = await context.params
      return NextResponse.json(await service.list(spaceId, request.nextUrl.searchParams.get('cursor')), { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) {
      const status = isAuthorizationError(error) || error instanceof LearningActivityError ? error.status : 500
      return NextResponse.json({ error: status === 500 ? 'Activity request failed' : error instanceof Error ? error.message : 'Activity request failed' }, { status, headers: { 'Cache-Control': 'no-store' } })
    }
  }
}
export const GET = createLearningActivityGet()
