import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import { LearningFulfillmentError, learningFulfillmentService } from '@/lib/learning-fulfillment-service'

type Context = { params: Promise<{ spaceId: string; bookingId: string }> }
const headers = { 'Cache-Control': 'no-store' }

export function createLearningFulfillmentHandlers(service = learningFulfillmentService) {
  function failure(error: unknown) {
    const status = isAuthorizationError(error) || error instanceof LearningFulfillmentError ? error.status : 500
    return NextResponse.json({ error: status === 500 ? 'Fulfillment request failed' : error instanceof Error ? error.message : 'Fulfillment request failed' }, { status, headers })
  }
  return {
    GET: async (_request: NextRequest, context: Context) => {
      try {
        const { spaceId, bookingId } = await context.params
        return NextResponse.json(await service.read(spaceId, bookingId), { headers })
      } catch (error) { return failure(error) }
    },
    POST: async (request: NextRequest, context: Context) => {
      try {
        const { spaceId, bookingId } = await context.params
        let body: unknown
        try { body = await request.json() } catch { throw new LearningFulfillmentError(400, 'Invalid request body') }
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new LearningFulfillmentError(400, 'Invalid request body')
        return NextResponse.json(await service.transition(spaceId, bookingId, body as Record<string, unknown>), { headers })
      } catch (error) { return failure(error) }
    },
  }
}
