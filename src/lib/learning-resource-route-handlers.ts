import { NextRequest, NextResponse } from 'next/server'
import { isAuthorizationError } from '@/lib/server-authorization'
import { createLearningLink, deleteLearningLink, isLearningResourceError, listLearningResources } from '@/lib/learning-resource-service'

function failure(error: unknown) { const status = isAuthorizationError(error) || isLearningResourceError(error) ? error.status : 500; return NextResponse.json({ error: status === 500 ? 'Resource request failed' : error instanceof Error ? error.message : 'Resource request failed' }, { status }) }
async function body(request: NextRequest) { const value: unknown = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid request body'); return value as Record<string, unknown> }
export function createLearningResourceHandlers() { return {
  GET: async (_request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => { try { return NextResponse.json(await listLearningResources((await context.params).spaceId), { headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return failure(error) } },
  POST: async (request: NextRequest, context: { params: Promise<{ spaceId: string }> }) => { try { return NextResponse.json(await createLearningLink((await context.params).spaceId, await body(request)), { status: 201, headers: { 'Cache-Control': 'no-store' } }) } catch (error) { return failure(error) } },
} }
export function createLearningResourceItemHandlers() { return { DELETE: async (_request: NextRequest, context: { params: Promise<{ spaceId: string; resourceId: string }> }) => { try { const { spaceId, resourceId } = await context.params; return NextResponse.json(await deleteLearningLink(spaceId, resourceId)) } catch (error) { return failure(error) } } } }
