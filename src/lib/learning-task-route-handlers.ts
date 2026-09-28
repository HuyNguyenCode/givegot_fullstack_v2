import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import { isLearningTaskError, learningTaskService } from '@/lib/learning-task-service'

function failure(error: unknown) {
  const status = isAuthorizationError(error) || isLearningTaskError(error) ? error.status : 500
  return NextResponse.json({ error: status === 500 ? 'Task request failed' : error instanceof Error ? error.message : 'Task request failed' }, { status, headers: { 'Cache-Control': 'no-store' } })
}
async function body(request: NextRequest) {
  let value: unknown
  try { value = await request.json() } catch { throw new LearningTaskRequestError() }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new LearningTaskRequestError()
  return value as Record<string, unknown>
}
class LearningTaskRequestError extends Error { readonly status = 400; constructor() { super('Invalid request body') } }
function routeFailure(error: unknown) { return error instanceof LearningTaskRequestError ? NextResponse.json({ error: error.message }, { status: 400 }) : failure(error) }

export function createLearningTaskHandlers() { return {
  GET: async (_request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => { try { return NextResponse.json({ tasks: await learningTaskService.list((await context.params).spaceId) }, { headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return routeFailure(error) } },
  POST: async (request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => { try { return NextResponse.json(await learningTaskService.create((await context.params).spaceId, await body(request)), { status: 201, headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return routeFailure(error) } },
} }
export function createLearningTaskItemHandlers() { return {
  PATCH: async (request: NextRequest, context: { params: Promise<{ spaceId: string; taskId: string }> }) => { try { const { spaceId, taskId } = await context.params; return NextResponse.json(await learningTaskService.update(spaceId, taskId, await body(request)), { headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return routeFailure(error) } },
} }
