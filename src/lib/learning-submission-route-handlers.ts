import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import { isLearningSubmissionError, learningSubmissionService } from '@/lib/learning-submission-service'

type Context = { params: Promise<{ spaceId: string; taskId: string }> }
function failure(error: unknown) {
  const status = isAuthorizationError(error) || isLearningSubmissionError(error) ? error.status : 500
  const code = isLearningSubmissionError(error) ? error.code : undefined
  return NextResponse.json({ error: status === 500 ? 'Submission request failed' : error instanceof Error ? error.message : 'Submission request failed', ...(code ? { code } : {}) }, { status, headers: { 'Cache-Control': 'no-store' } })
}
export function createLearningSubmissionHandlers(service = learningSubmissionService) {
  async function GET(request: NextRequest, context: Context) {
    try {
      const { spaceId, taskId } = await context.params
      const data = request.nextUrl.searchParams.get('view') === 'requirements'
        ? await service.currentWithTask(spaceId, taskId)
        : { submission: await service.current(spaceId, taskId) }
      return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return failure(error) }
  }
  async function POST(request: NextRequest, context: Context) {
    try {
      const { spaceId, taskId } = await context.params
      let body: unknown
      try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }) }
      if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
      return NextResponse.json({ submission: await service.submit(spaceId, taskId, body as Record<string, unknown>) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
    } catch (error) { return failure(error) }
  }
  return { GET, POST }
}
