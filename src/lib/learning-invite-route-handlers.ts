import { NextRequest, NextResponse } from 'next/server'

import { clearLearningInviteContinuation, readLearningInviteContinuation, setLearningInviteContinuation } from '@/lib/learning-invite-continuation'
import { isLearningInviteError, LearningInviteValidationError, type createLearningInviteService } from '@/lib/learning-invite-service'
import { isAuthorizationError } from '@/lib/server-authorization'

type Service = ReturnType<typeof createLearningInviteService>
const fail = (error: unknown) => NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid LearningInvite request' }, { status: isAuthorizationError(error) || isLearningInviteError(error) ? error.status : 400 })
const body = async (request: NextRequest) => { const value: unknown = await request.json(); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid body'); return value as Record<string, unknown> }

export function createLearningInviteCollectionHandlers(service: Service) { return { POST: async (request: NextRequest) => { try { const created = await service.create(await body(request)); return NextResponse.json(created, { status: 201 }) } catch (error) { return fail(error) } } } }
export function createLearningInvitePreviewHandlers(service: { preview(token: unknown): Promise<unknown> }, continuation = setLearningInviteContinuation) { return { POST: async (request: NextRequest) => { try { const input = await body(request); const preview = await service.preview(input.token); const response = NextResponse.json({ preview, authenticationRequired: true }); continuation(response, input.token as string); return response } catch (error) { return fail(error) } } } }
export function createLearningInviteAcceptHandlers(service: { accept(token: unknown, input: Record<string, unknown>): Promise<unknown> }, readContinuation = readLearningInviteContinuation) { return { POST: async (request: NextRequest) => { try { const input = await body(request); const token = input.token ?? readContinuation(request); if (!token) throw new LearningInviteValidationError('An invite token or valid login continuation is required'); const accepted = await service.accept(token, input); const response = NextResponse.json(accepted); clearLearningInviteContinuation(response); return response } catch (error) { return fail(error) } } } }
export function createLearningInviteHandlers(service: Service) { return { PATCH: async (request: NextRequest, context: { params: Promise<{ inviteId: string }> }) => { try { return NextResponse.json({ invite: await service.revoke((await context.params).inviteId) }) } catch (error) { return fail(error) } } } }
