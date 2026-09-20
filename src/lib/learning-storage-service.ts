import { randomUUID } from 'node:crypto'

import type { LearningResourceStatus, LearningSpaceStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedUser } from '@/lib/server-authorization'
import type { LearningStorageProvider } from '@/lib/learning-storage-provider'

export const LEARNING_FILE_MAX_BYTES = 20 * 1024 * 1024
export const LEARNING_SPACE_QUOTA_BYTES = 500 * 1024 * 1024
export const LEARNING_UPLOAD_TTL_MS = 5 * 60_000
export const LEARNING_DOWNLOAD_TTL_MS = 10 * 60_000
export const LEARNING_ORPHAN_GRACE_MS = 15 * 60_000

const fileTypes: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  txt: 'text/plain',
  md: 'text/markdown',
}

export class LearningStorageError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409 | 413 | 429 | 502, message: string) {
    super(message)
    this.name = 'LearningStorageError'
  }
}

export const isLearningStorageError = (error: unknown): error is LearningStorageError => error instanceof LearningStorageError

export type FileResource = {
  id: string
  learningSpaceId: string
  uploaderId: string
  kind: 'FILE'
  title: string
  storageKey: string | null
  mimeType: string | null
  sizeBytes: bigint | null
  status: LearningResourceStatus
  createdAt: Date
  deletedAt: Date | null
}

export interface LearningStorageRepository {
  access(spaceId: string, userId: string): Promise<{ state: LearningSpaceStatus } | null>
  reserve(input: { spaceId: string; userId: string; id: string; title: string; key: string; mimeType: string; sizeBytes: number; quotaBytes: number }): Promise<FileResource>
  resource(spaceId: string, resourceId: string): Promise<FileResource | null>
  transition(resourceId: string, from: LearningResourceStatus, to: LearningResourceStatus, changes?: { storageKey?: string | null; deletedAt?: Date }): Promise<boolean>
  expiredPending(before: Date, limit: number): Promise<FileResource[]>
  deletedFiles(limit: number): Promise<FileResource[]>
}

function validateFile(input: { fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown }) {
  const name = input.fileName
  if (typeof name !== 'string' || name.length < 1 || name.length > 255 || name.trim() !== name || name.startsWith('.') || name.endsWith('.') || name.includes('..') || /[\\/\x00-\x1f\x7f]/u.test(name)) {
    throw new LearningStorageError(400, 'Invalid file name')
  }
  const extension = name.split('.').at(-1)?.toLowerCase() ?? ''
  const expectedMime = fileTypes[extension]
  if (!expectedMime || input.mimeType !== expectedMime) throw new LearningStorageError(400, 'File type is not allowed')
  if (typeof input.sizeBytes !== 'number' || !Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1) throw new LearningStorageError(400, 'Invalid file size')
  if (input.sizeBytes > LEARNING_FILE_MAX_BYTES) throw new LearningStorageError(413, 'File exceeds the 20 MB limit')
  return { title: name, extension, mimeType: expectedMime, sizeBytes: input.sizeBytes }
}

function finalKey(stagingKey: string) {
  if (!stagingKey.startsWith('pending/spaces/')) throw new LearningStorageError(409, 'Invalid pending storage key')
  return stagingKey.slice('pending/'.length)
}

function stagingKey(readyKey: string) {
  return `pending/${readyKey}`
}

function matchesFileContent(mimeType: string, bytes: Uint8Array) {
  if (mimeType === 'application/pdf') return bytes.length >= 5 && Buffer.from(bytes.subarray(0, 5)).toString('ascii') === '%PDF-'
  if (mimeType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (mimeType === 'image/png') return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  if (mimeType === 'text/plain' || mimeType === 'text/markdown') {
    if (bytes.includes(0)) return false
    try { new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: true }); return true }
    catch { return false }
  }
  return false
}

export function createLearningStorageService(deps: {
  repository: LearningStorageRepository
  provider: LearningStorageProvider
  authenticatedUser: typeof requireAuthenticatedUser
  now?: () => Date
  uuid?: () => string
}) {
  const { repository, provider, authenticatedUser } = deps
  const now = deps.now ?? (() => new Date())
  const uuid = deps.uuid ?? randomUUID

  async function authorize(spaceId: string, write: boolean) {
    const actor = await authenticatedUser()
    const space = await repository.access(spaceId, actor.id)
    if (!space) throw new LearningStorageError(403, 'Learning space membership required')
    if (write && space.state !== 'ACTIVE') throw new LearningStorageError(403, 'Archived learning spaces are read-only')
    return actor.id
  }

  async function initiate(spaceId: string, input: { fileName?: unknown; mimeType?: unknown; sizeBytes?: unknown }) {
    const actorId = await authorize(spaceId, true)
    const file = validateFile(input)
    await provider.assertPrivateBucket()
    const id = uuid()
    const key = `pending/spaces/${spaceId}/resources/${id}/${uuid()}.${file.extension}`
    await repository.reserve({ spaceId, userId: actorId, id, title: file.title, key, mimeType: file.mimeType, sizeBytes: file.sizeBytes, quotaBytes: LEARNING_SPACE_QUOTA_BYTES })
    const expiresAt = new Date(now().getTime() + LEARNING_UPLOAD_TTL_MS)
    try {
      const upload = await provider.signUpload(key, file.mimeType, file.sizeBytes, expiresAt)
      return { resourceId: id, upload, maxBytes: file.sizeBytes }
    } catch {
      await repository.transition(id, 'PENDING', 'DELETED', { deletedAt: now() })
      throw new LearningStorageError(502, 'Storage provider could not issue upload credentials')
    }
  }

  async function finalize(spaceId: string, resourceId: string) {
    const actorId = await authorize(spaceId, true)
    const resource = await repository.resource(spaceId, resourceId)
    if (!resource || resource.kind !== 'FILE' || resource.uploaderId !== actorId || !resource.storageKey) throw new LearningStorageError(404, 'File resource not found')
    if (resource.status === 'READY') return { resourceId, status: 'READY' as const }
    if (resource.status !== 'PENDING') throw new LearningStorageError(409, 'File is not pending')
    if (now().getTime() > resource.createdAt.getTime() + LEARNING_ORPHAN_GRACE_MS) throw new LearningStorageError(409, 'Upload reservation expired')
    const expected = Number(resource.sizeBytes)
    const mime = resource.mimeType
    if (!Number.isSafeInteger(expected) || !mime) throw new LearningStorageError(409, 'Invalid file reservation')
    let actual
    try { actual = await provider.stat(resource.storageKey) } catch { throw new LearningStorageError(502, 'Storage provider metadata unavailable') }
    if (!actual) throw new LearningStorageError(409, 'Upload has not been received')
    if (actual.sizeBytes !== expected || actual.mimeType !== mime) {
      await repository.transition(resourceId, 'PENDING', 'QUARANTINED')
      throw new LearningStorageError(409, 'Uploaded file metadata does not match the reservation')
    }
    const sourceKey = resource.storageKey
    const key = finalKey(sourceKey)
    let promoted
    let prefix
    try {
      await provider.promote(sourceKey, key, mime)
      promoted = await provider.stat(key)
      prefix = await provider.readPrefix(key, Math.min(expected, 4096))
    } catch {
      throw new LearningStorageError(502, 'Storage provider could not finalize upload')
    }
    if (!promoted || promoted.sizeBytes !== expected || promoted.mimeType !== mime || !matchesFileContent(mime, prefix)) {
      await repository.transition(resourceId, 'PENDING', 'QUARANTINED')
      throw new LearningStorageError(409, 'Uploaded file content does not match its type')
    }
    const updated = await repository.transition(resourceId, 'PENDING', 'READY', { storageKey: key })
    if (!updated) {
      const current = await repository.resource(spaceId, resourceId)
      if (current?.status === 'READY') return { resourceId, status: 'READY' as const }
      try { await provider.remove(key) } catch { /* cron retries pending or deleted reservations */ }
      throw new LearningStorageError(409, 'Upload reservation changed')
    }
    try { await provider.remove(sourceKey) } catch { /* pending/ lifecycle also expires staging copies */ }
    return { resourceId, status: 'READY' as const }
  }

  async function download(spaceId: string, resourceId: string) {
    await authorize(spaceId, false)
    const resource = await repository.resource(spaceId, resourceId)
    if (!resource || resource.kind !== 'FILE' || resource.status !== 'READY' || !resource.storageKey) throw new LearningStorageError(404, 'File resource not found')
    await provider.assertPrivateBucket()
    const expiresAt = new Date(now().getTime() + LEARNING_DOWNLOAD_TTL_MS)
    try {
      const url = await provider.signDownload(resource.storageKey, expiresAt)
      return { url, expiresAt: expiresAt.toISOString() }
    } catch { throw new LearningStorageError(502, 'Storage provider could not issue download credentials') }
  }

  async function softDelete(spaceId: string, resourceId: string) {
    const actorId = await authorize(spaceId, true)
    const resource = await repository.resource(spaceId, resourceId)
    if (!resource || resource.kind !== 'FILE' || resource.uploaderId !== actorId) throw new LearningStorageError(404, 'File resource not found')
    if (resource.status === 'DELETED') return { resourceId, status: 'DELETED' as const }
    const updated = await repository.transition(resourceId, resource.status, 'DELETED', { deletedAt: now() })
    if (!updated) throw new LearningStorageError(409, 'File state changed')
    if (resource.storageKey) try {
      await provider.remove(resource.storageKey)
      await provider.remove(resource.storageKey.startsWith('pending/') ? finalKey(resource.storageKey) : stagingKey(resource.storageKey))
      await repository.transition(resourceId, 'DELETED', 'DELETED', { storageKey: null })
    } catch { /* retry via cleanup */ }
    return { resourceId, status: 'DELETED' as const }
  }

  async function cleanupOrphans(limit = 100) {
    await provider.assertPrivateBucket()
    const stale = await repository.expiredPending(new Date(now().getTime() - LEARNING_ORPHAN_GRACE_MS), limit)
    let removed = 0
    for (const resource of stale) {
      if (!resource.storageKey) continue
      const claimed = await repository.transition(resource.id, resource.status, 'DELETED', { deletedAt: now() })
      if (!claimed) continue
      try {
        await provider.remove(resource.storageKey)
        await provider.remove(finalKey(resource.storageKey))
        await repository.transition(resource.id, 'DELETED', 'DELETED', { storageKey: null })
        removed += 1
      } catch { /* DELETED remains eligible for retry */ }
    }
    for (const resource of await repository.deletedFiles(limit)) {
      if (!resource.storageKey) continue
      try {
        await provider.remove(resource.storageKey)
        if (resource.storageKey.startsWith('pending/')) await provider.remove(finalKey(resource.storageKey))
        else await provider.remove(stagingKey(resource.storageKey))
        await repository.transition(resource.id, 'DELETED', 'DELETED', { storageKey: null })
      } catch { /* idempotent next run */ }
    }
    return { claimed: stale.length, removed }
  }

  return { initiate, finalize, download, softDelete, cleanupOrphans }
}

export const learningStorageRepository: LearningStorageRepository = {
  async access(spaceId, userId) {
    const member = await prisma.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: spaceId, userId } }, select: { status: true, learningSpace: { select: { state: true } } } })
    return member?.status === 'ACTIVE' ? { state: member.learningSpace.state } : null
  },
  reserve: input => prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.spaceId}))`
    const member = await tx.learningSpaceMember.findUnique({ where: { learningSpaceId_userId: { learningSpaceId: input.spaceId, userId: input.userId } }, select: { status: true, learningSpace: { select: { state: true } } } })
    if (member?.status !== 'ACTIVE' || member.learningSpace.state !== 'ACTIVE') throw new LearningStorageError(403, 'Active learning space membership required')
    const totals = await tx.learningResource.aggregate({ where: { learningSpaceId: input.spaceId, kind: 'FILE', status: { in: ['PENDING', 'READY', 'QUARANTINED'] } }, _sum: { sizeBytes: true } })
    if ((totals._sum.sizeBytes ?? BigInt(0)) + BigInt(input.sizeBytes) > BigInt(input.quotaBytes)) throw new LearningStorageError(413, 'Learning space storage quota exceeded')
    return tx.learningResource.create({ data: { id: input.id, learningSpaceId: input.spaceId, uploaderId: input.userId, kind: 'FILE', title: input.title, storageKey: input.key, mimeType: input.mimeType, sizeBytes: BigInt(input.sizeBytes), status: 'PENDING' } }) as Promise<FileResource>
  }),
  resource: (spaceId, resourceId) => prisma.learningResource.findFirst({ where: { id: resourceId, learningSpaceId: spaceId, kind: 'FILE' } }) as Promise<FileResource | null>,
  transition: async (resourceId, from, to, changes) => (await prisma.learningResource.updateMany({ where: { id: resourceId, status: from }, data: { status: to, ...changes } })).count === 1,
  expiredPending: (before, limit) => prisma.learningResource.findMany({ where: { kind: 'FILE', status: { in: ['PENDING', 'QUARANTINED'] }, createdAt: { lt: before } }, take: limit, orderBy: { createdAt: 'asc' } }) as Promise<FileResource[]>,
  deletedFiles: limit => prisma.learningResource.findMany({ where: { kind: 'FILE', status: 'DELETED', storageKey: { not: null } }, take: limit, orderBy: { updatedAt: 'desc' } }) as Promise<FileResource[]>,
}
