import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import { LearningSubmissionReviewError, learningSubmissionReviewService } from '@/lib/learning-submission-review-service'

type Context = { params: Promise<{ spaceId: string; taskId: string }> }
const headers = { 'Cache-Control': 'no-store' }
export function createLearningSubmissionReviewHandlers(service = learningSubmissionReviewService) {
  function failure(error: unknown) {
    const status = isAuthorizationError(error) || error instanceof LearningSubmissionReviewError ? error.status : 500
    return NextResponse.json({ error: status === 500 ? 'Review request failed' : error instanceof Error ? error.message : 'Review request failed' }, { status, headers })
  }
  return {
    GET: async (_request: NextRequest, context: Context) => {
      try { const { spaceId, taskId } = await context.params; return NextResponse.json(await service.current(spaceId, taskId), { headers }) } catch (error) { return failure(error) }
    },
    POST: async (request: NextRequest, context: Context) => {
      try {
        const { spaceId, taskId } = await context.params
        let body: unknown
        try { body = await request.json() } catch { throw new LearningSubmissionReviewError(400, 'Invalid request body') }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LearningSubmissionReviewError(400, 'Invalid request body')
        return NextResponse.json(await service.review(spaceId, taskId, body as Record<string, unknown>), { status: 201, headers })
      } catch (error) { return failure(error) }
    },
  }
}
