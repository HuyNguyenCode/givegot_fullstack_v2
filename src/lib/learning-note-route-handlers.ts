import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import { LearningNoteError, learningNoteService } from '@/lib/learning-note-service'

const headers = { 'Cache-Control': 'no-store' }
type Collection = { params: Promise<{ spaceId: string }> }
type Item = { params: Promise<{ spaceId: string; noteId: string }> }
function failure(error: unknown) {
  const status = isAuthorizationError(error) || error instanceof LearningNoteError ? error.status : 500
  return NextResponse.json({ error: status === 500 ? 'Note request failed' : error instanceof Error ? error.message : 'Note request failed' }, { status, headers })
}
async function body(request: NextRequest) {
  let input: unknown
  try { input = await request.json() } catch { throw new LearningNoteError(400, 'Invalid request body') }
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new LearningNoteError(400, 'Invalid request body')
  return input as Record<string, unknown>
}
export function createLearningNoteCollectionHandlers(service = learningNoteService) { return {
  GET: async (_request: NextRequest, context: Collection) => { try { return NextResponse.json({ notes: await service.list((await context.params).spaceId) }, { headers }) } catch (error) { return failure(error) } },
  POST: async (request: NextRequest, context: Collection) => { try { return NextResponse.json(await service.create((await context.params).spaceId, await body(request)), { status: 201, headers }) } catch (error) { return failure(error) } },
} }
export function createLearningNoteItemHandlers(service = learningNoteService) { return {
  GET: async (_request: NextRequest, context: Item) => { try { const { spaceId, noteId } = await context.params; return NextResponse.json(await service.read(spaceId, noteId), { headers }) } catch (error) { return failure(error) } },
  PATCH: async (request: NextRequest, context: Item) => { try { const { spaceId, noteId } = await context.params; return NextResponse.json(await service.update(spaceId, noteId, await body(request)), { headers }) } catch (error) { return failure(error) } },
  DELETE: async (request: NextRequest, context: Item) => { try { const { spaceId, noteId } = await context.params; return NextResponse.json(await service.remove(spaceId, noteId, await body(request)), { headers }) } catch (error) { return failure(error) } },
} }
