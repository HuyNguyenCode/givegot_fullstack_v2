import { NextRequest, NextResponse } from 'next/server'

import { isAuthorizationError } from '@/lib/server-authorization'
import { isLearningStorageError, LearningStorageError, type createLearningStorageService } from '@/lib/learning-storage-service'

type Service = ReturnType<typeof createLearningStorageService>
type CollectionContext = { params: Promise<{ spaceId: string }> }
type Context = { params: Promise<{ spaceId: string; resourceId: string }> }

function failure(error: unknown) {
  const status = isAuthorizationError(error) || isLearningStorageError(error) ? error.status : 500
  const message = status === 500 ? 'Storage request failed' : error instanceof Error ? error.message : 'Storage request failed'
  return NextResponse.json({ error: message }, { status })
}

async function jsonObject(request: NextRequest) {
  const value: unknown = await request.json()
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LearningStorageError(400, 'Invalid request body')
  return value as { fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown }
}

export function createLearningFileCollectionHandlers(service: Service) {
  return {
    POST: async (request: NextRequest, context: CollectionContext) => {
      try { return NextResponse.json(await service.initiate((await context.params).spaceId, await jsonObject(request)), { status: 201, headers: { 'Cache-Control': 'no-store' } }) }
      catch (error) { return failure(error) }
    },
  }
}

export function createLearningFileFinalizeHandlers(service: Service) {
  return {
    POST: async (_request: NextRequest, context: Context) => {
      try { const { spaceId, resourceId } = await context.params; return NextResponse.json(await service.finalize(spaceId, resourceId), { headers: { 'Cache-Control': 'no-store' } }) }
      catch (error) { return failure(error) }
    },
  }
}

export function createLearningFileDownloadHandlers(service: Service) {
  return {
    POST: async (_request: NextRequest, context: Context) => {
      try { const { spaceId, resourceId } = await context.params; return NextResponse.json(await service.download(spaceId, resourceId), { headers: { 'Cache-Control': 'no-store' } }) }
      catch (error) { return failure(error) }
    },
  }
}

export function createLearningFileHandlers(service: Service) {
  return {
    DELETE: async (_request: NextRequest, context: Context) => {
      try { const { spaceId, resourceId } = await context.params; return NextResponse.json(await service.softDelete(spaceId, resourceId)) }
      catch (error) { return failure(error) }
    },
  }
}
