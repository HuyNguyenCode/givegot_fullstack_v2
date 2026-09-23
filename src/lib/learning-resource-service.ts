import { prisma } from '@/lib/prisma'
import { AuthorizationError, requireAuthenticatedUser } from '@/lib/server-authorization'

export const LEARNING_SPACE_QUOTA_BYTES = 500 * 1024 * 1024

export class LearningResourceError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, message: string) { super(message) }
}
export const isLearningResourceError = (error: unknown): error is LearningResourceError => error instanceof LearningResourceError

const cleanText = (value: unknown, field: string, max: number, required = false) => {
  if (value == null && !required) return null
  if (typeof value !== 'string') throw new LearningResourceError(400, `Invalid ${field}`)
  const result = value.trim()
  if ((required && !result) || result.length > max) throw new LearningResourceError(400, `Invalid ${field}`)
  return result || null
}

export function normalizeExternalUrl(value: unknown) {
  const raw = cleanText(value, 'URL', 2_000, true)!
  let url: URL
  try { url = new URL(raw) } catch { throw new LearningResourceError(400, 'A valid HTTPS URL is required') }
  if (url.protocol !== 'https:' || url.username || url.password) throw new LearningResourceError(400, 'A valid HTTPS URL is required')
  url.hash = ''
  return url.toString()
}

async function authorize(spaceId: string, write: boolean) {
  const actor = await requireAuthenticatedUser()
  const member = await prisma.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId: actor.id } }, select: { status: true, learningSpace: { select: { state: true } } } })
  if (!member || member.status !== 'ACTIVE') throw new AuthorizationError(403, 'Learning space membership required')
  if (write && member.learningSpace.state !== 'ACTIVE') throw new AuthorizationError(403, 'Archived learning spaces are read-only')
  return actor.id
}

export async function createLearningLink(spaceId: string, input: Record<string, unknown>) {
  const actorId = await authorize(spaceId, true)
  const title = cleanText(input.title, 'title', 255, true)!
  const description = cleanText(input.description, 'description', 10_000)
  const bookingId = cleanText(input.bookingId, 'bookingId', 191)
  const topicId = cleanText(input.topicId, 'topicId', 191)
  const externalUrl = normalizeExternalUrl(input.url)
  return prisma.$transaction(async tx => {
    if (bookingId && !await tx.booking.findFirst({ where: { id: bookingId, learningSpaceId: spaceId }, select: { id: true } })) throw new LearningResourceError(400, 'Booking does not belong to this learning space')
    if (topicId && !await tx.learningTopic.findFirst({ where: { id: topicId, learningSpaceId: spaceId }, select: { id: true } })) throw new LearningResourceError(400, 'Topic does not belong to this learning space')
    const resource = await tx.learningResource.create({ data: { learningSpaceId: spaceId, uploaderId: actorId, bookingId, topicId, kind: 'LINK', title, description, externalUrl, status: 'READY' } })
    // Deliberately exclude URL, title, description, filename, and storage key.
    await tx.learningActivity.create({ data: { learningSpaceId: spaceId, actorId, eventType: 'LEARNING_RESOURCE_CREATED', entityType: 'LearningResource', entityId: resource.id, eventKey: `learning-resource:${resource.id}:created`, metadata: { kind: 'LINK', status: 'READY' } } })
    return { id: resource.id, status: resource.status }
  })
}

export async function listLearningResources(spaceId: string) {
  const actorId = await authorize(spaceId, false)
  const [resources, total] = await Promise.all([
    prisma.learningResource.findMany({ where: { learningSpaceId: spaceId, status: { in: ['PENDING', 'READY', 'QUARANTINED'] } }, orderBy: { createdAt: 'desc' }, select: { id: true, bookingId: true, topicId: true, uploaderId: true, kind: true, title: true, description: true, externalUrl: true, mimeType: true, sizeBytes: true, status: true, deletedAt: true, createdAt: true, uploader: { select: { name: true, email: true } }, topic: { select: { label: true } } } }),
    prisma.learningResource.aggregate({ where: { learningSpaceId: spaceId, kind: 'FILE', status: { in: ['PENDING', 'READY', 'QUARANTINED'] } }, _sum: { sizeBytes: true } }),
  ])
  return { resources: resources.map(resource => ({ id: resource.id, bookingId: resource.bookingId, topicId: resource.topicId, kind: resource.kind, title: resource.title, description: resource.description, externalUrl: resource.externalUrl, mimeType: resource.mimeType, sizeBytes: resource.sizeBytes?.toString() ?? null, status: resource.status, deletedAt: resource.deletedAt, createdAt: resource.createdAt, uploaderName: resource.uploader.name || resource.uploader.email || 'Thành viên', topicLabel: resource.topic?.label ?? null, canDelete: resource.uploaderId === actorId })), quota: { usedBytes: (total._sum.sizeBytes ?? BigInt(0)).toString(), maxBytes: LEARNING_SPACE_QUOTA_BYTES.toString() } }
}

export async function deleteLearningLink(spaceId: string, resourceId: string) {
  const actorId = await authorize(spaceId, true)
  const result = await prisma.learningResource.updateMany({ where: { id: resourceId, learningSpaceId: spaceId, kind: 'LINK', uploaderId: actorId, status: { not: 'DELETED' } }, data: { status: 'DELETED', deletedAt: new Date() } })
  if (!result.count) throw new LearningResourceError(404, 'Link resource not found')
  return { id: resourceId, status: 'DELETED' as const }
}
