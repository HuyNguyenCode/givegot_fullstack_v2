import type { LearningSpace } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { isLearningSpaceError, type createLearningSpaceService } from '@/lib/learning-space-service'
import { isAuthorizationError } from '@/lib/server-authorization'
type Service = ReturnType<typeof createLearningSpaceService>
const fail = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid LearningSpace request' }, { status: isAuthorizationError(error) || isLearningSpaceError(error) ? error.status : 400 })
const body = async (request: NextRequest) => { const value: unknown = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body'); return value as Record<string, unknown> }
export function publicLearningSpace<T extends { id: string; creationOrigin?: LearningSpace['creationOrigin'] }>(space: T) {
  const { creationOrigin, ...fields } = space
  void creationOrigin
  return fields
}

export function createLearningSpaceCollectionHandlers(service: Service) {
  return { POST: async (request: NextRequest) => {
    try {
      const input = await body(request)
      if (input.action === 'suggestReuse') {
        const candidates = await service.suggestReuse(input)
        return NextResponse.json({ candidates: candidates.map(publicLearningSpace) })
      }
      const space = input.source === 'booking' ? await service.createFromConfirmedBooking(input) : await service.createDirect(input)
      return NextResponse.json({ space: publicLearningSpace(space) }, { status: 201 })
    } catch (error) { return fail(error) }
  } }
}

export function createLearningSpaceHandlers(service: Service) {
  return {
    GET: async (_: NextRequest, context: { params: Promise<{ spaceId: string }> }) => {
      try {
        const { space, topics } = await service.read((await context.params).spaceId)
        return NextResponse.json({ space: publicLearningSpace(space), topics })
      } catch (error) { return fail(error) }
    },
    PATCH: async (request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => {
      try {
        const input = await body(request)
        const id = (await context.params).spaceId
        const space = input.action === 'primarySkill' ? await service.changePrimarySkill(id, input) : input.action === 'archive' ? await service.archive(id, input) : input.action === 'restore' ? await service.restore(id, input) : await service.updateDetails(id, input)
        return NextResponse.json({ space: publicLearningSpace(space) })
      } catch (error) { return fail(error) }
    },
  }
}
export function createLearningTopicCollectionHandlers(service: Service) { return { POST: async (request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => { try { return NextResponse.json({ topic: await service.addTopic((await context.params).spaceId, await body(request)) }, { status: 201 }) } catch (error) { return fail(error) } } } }
export function createLearningTopicHandlers(service: Service) { return { PATCH: async (request: NextRequest, context: { params: Promise<{ spaceId: string; topicId: string }> }) => { try { const params = await context.params; const input = await body(request); const topic = input.action === 'archive' ? await service.archiveTopic(params.spaceId, params.topicId) : await service.renameTopic(params.spaceId, params.topicId, input); return NextResponse.json({ topic }) } catch (error) { return fail(error) } } } }
