import assert from 'node:assert/strict'
import test from 'node:test'

import { AuthorizationError } from '../../../src/lib/server-authorization'
import {
  createLearningStorageService,
  LEARNING_DOWNLOAD_TTL_MS,
  LEARNING_FILE_MAX_BYTES,
  LEARNING_ORPHAN_GRACE_MS,
  LEARNING_SPACE_QUOTA_BYTES,
  LEARNING_UPLOAD_TTL_MS,
  LearningStorageError,
  type FileResource,
  type LearningStorageRepository,
} from '../../../src/lib/learning-storage-service'
import { downloadContentDisposition } from '../../../src/lib/learning-download-disposition'
import type { LearningStorageProvider } from '../../../src/lib/learning-storage-provider'

const start = new Date('2030-01-01T00:00:00.000Z')

function fixture() {
  let clock = start.getTime()
  let actor: string | null = 'member'
  let archived = false
  let providerCalls = 0
  let failSign = false
  let failPromote = false
  let failRemove = false
  let deleteDuringPromote = false
  const rows = new Map<string, FileResource>()
  const objects = new Map<string, { sizeBytes: number; mimeType: string }>()
  const content = new Map<string, Uint8Array>()
  const removed: string[] = []
  let nextId = 0
  const repository: LearningStorageRepository = {
    access: async (_spaceId, userId) => userId === 'member' ? { state: archived ? 'ARCHIVED' : 'ACTIVE' } : null,
    reserve: async input => {
      const used = [...rows.values()].filter(row => ['PENDING', 'READY', 'QUARANTINED'].includes(row.status)).reduce((sum, row) => sum + Number(row.sizeBytes), 0)
      if (used + input.sizeBytes > input.quotaBytes) throw new LearningStorageError(413, 'Learning space storage quota exceeded')
      const row: FileResource = { id: input.id, learningSpaceId: input.spaceId, uploaderId: input.userId, kind: 'FILE', title: input.title, storageKey: input.key, mimeType: input.mimeType, sizeBytes: BigInt(input.sizeBytes), status: 'PENDING', createdAt: new Date(clock), deletedAt: null }
      rows.set(row.id, row)
      return row
    },
    resource: async (_spaceId, resourceId) => rows.get(resourceId) ?? null,
    transition: async (resourceId, from, to, changes) => {
      const row = rows.get(resourceId)
      if (!row || row.status !== from) return false
      row.status = to
      if (changes && 'storageKey' in changes) row.storageKey = changes.storageKey ?? null
      if (changes?.deletedAt) row.deletedAt = changes.deletedAt
      return true
    },
    expiredPending: async before => [...rows.values()].filter(row => ['PENDING', 'QUARANTINED'].includes(row.status) && row.createdAt < before),
    deletedFiles: async () => [...rows.values()].filter(row => row.status === 'DELETED' && row.storageKey),
  }
  const provider: LearningStorageProvider = {
    assertPrivateBucket: async () => { providerCalls += 1 },
    signUpload: async (key, mimeType, maxBytes, expiresAt) => {
      providerCalls += 1
      if (failSign) throw new Error('provider down')
      assert.equal(expiresAt.getTime() - clock, LEARNING_UPLOAD_TTL_MS)
      return { url: 'https://example.invalid/upload', fields: { key, 'Content-Type': mimeType, policy: `max=${maxBytes}` }, expiresAt: expiresAt.toISOString() }
    },
    stat: async key => { providerCalls += 1; return objects.get(key) ?? null },
    readPrefix: async (key, length) => {
      providerCalls += 1
      const object = objects.get(key)
      if (!object) throw new Error('missing')
      const defaults: Record<string, number[]> = {
        'application/pdf': [37, 80, 68, 70, 45, 10],
        'image/jpeg': [255, 216, 255, 224],
        'image/png': [137, 80, 78, 71, 13, 10, 26, 10],
        'text/plain': [104, 101, 108, 108, 111],
        'text/markdown': [35, 32, 104, 101, 108, 108, 111],
      }
      return (content.get(key) ?? Uint8Array.from(defaults[object.mimeType] ?? [])).subarray(0, length)
    },
    promote: async (source, destination) => {
      providerCalls += 1
      if (failPromote) throw new Error('provider down')
      const object = objects.get(source)
      if (!object) throw new Error('missing')
      objects.set(destination, { ...object })
      if (content.has(source)) content.set(destination, content.get(source)!)
      if (deleteDuringPromote) [...rows.values()][0].status = 'DELETED'
    },
    signDownload: async (key, fileName, expiresAt) => {
      providerCalls += 1
      assert.equal(key, 'spaces/space/resources/uuid-1/uuid-2.pdf')
      assert.equal(fileName, 'notes.pdf')
      assert.equal(expiresAt.getTime() - clock, LEARNING_DOWNLOAD_TTL_MS)
      return `https://example.invalid/download?expires=${expiresAt.getTime()}`
    },
    remove: async key => { providerCalls += 1; if (failRemove) throw new Error('provider down'); removed.push(key); objects.delete(key); content.delete(key) },
  }
  const service = createLearningStorageService({
    repository, provider,
    authenticatedUser: async () => {
      if (!actor) throw new AuthorizationError(401, 'Authentication required')
      return { id: actor, email: null, name: null }
    },
    now: () => new Date(clock), uuid: () => `uuid-${++nextId}`,
  })
  const valid = { fileName: 'notes.pdf', mimeType: 'application/pdf', sizeBytes: 1024 }
  return { service, valid, rows, objects, removed, setContent: (key: string, bytes: Uint8Array) => { content.set(key, bytes) }, setActor: (value: string | null) => { actor = value }, setArchived: (value: boolean) => { archived = value }, advance: (ms: number) => { clock += ms }, canOpenSignedUrl: (url: string) => clock < Number(new URL(url).searchParams.get('expires')), calls: () => providerCalls, failSign: () => { failSign = true }, failPromote: () => { failPromote = true }, deleteDuringPromote: () => { deleteDuringPromote = true }, setFailRemove: (value: boolean) => { failRemove = value } }
}

test('unauthenticated and nonmember requests stop before storage metadata or credentials', async () => {
  const f = fixture()
  f.setActor(null)
  await assert.rejects(() => f.service.initiate('space', f.valid), { status: 401 })
  await assert.rejects(() => f.service.download('space', 'guessed'), { status: 401 })
  f.setActor('outsider')
  await assert.rejects(() => f.service.initiate('space', f.valid), { status: 403 })
  await assert.rejects(() => f.service.download('space', 'guessed'), { status: 403 })
  assert.equal(f.calls(), 0)
})

test('MIME and extension allowlist rejects mismatches and Office types', async () => {
  const f = fixture()
  for (const input of [
    { fileName: 'notes.pdf', mimeType: 'image/png', sizeBytes: 10 },
    { fileName: 'report.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', sizeBytes: 10 },
    { fileName: 'script.svg', mimeType: 'image/svg+xml', sizeBytes: 10 },
  ]) await assert.rejects(() => f.service.initiate('space', input), { status: 400 })
  assert.equal(f.calls(), 0)
})

test('oversized, quota-exceeded, and filename traversal uploads are rejected', async () => {
  const f = fixture()
  await assert.rejects(() => f.service.initiate('space', { ...f.valid, sizeBytes: LEARNING_FILE_MAX_BYTES + 1 }), { status: 413 })
  for (const fileName of ['../notes.pdf', '..\\notes.pdf', '/tmp/notes.pdf', 'bad\u0000.pdf']) {
    await assert.rejects(() => f.service.initiate('space', { ...f.valid, fileName }), { status: 400 })
  }
  const count = Math.floor(LEARNING_SPACE_QUOTA_BYTES / LEARNING_FILE_MAX_BYTES)
  for (let i = 0; i < count; i++) await f.service.initiate('space', { ...f.valid, sizeBytes: LEARNING_FILE_MAX_BYTES })
  await assert.rejects(() => f.service.initiate('space', f.valid), { status: 413 })
})

test('member upload finalizes only after provider confirmation, then member download expires', async () => {
  const f = fixture()
  const issued = await f.service.initiate('space', f.valid)
  const pending = f.rows.get(issued.resourceId)!
  assert.match(pending.storageKey!, /^pending\/spaces\/space\/resources\/uuid-1\/uuid-2\.pdf$/)
  assert.equal(pending.status, 'PENDING')
  assert.equal(issued.upload.expiresAt, new Date(start.getTime() + LEARNING_UPLOAD_TTL_MS).toISOString())
  await assert.rejects(() => f.service.finalize('space', issued.resourceId), { status: 409 })
  assert.equal(pending.status, 'PENDING')
  f.objects.set(pending.storageKey!, { sizeBytes: 1024, mimeType: 'application/pdf' })
  await f.service.finalize('space', issued.resourceId)
  assert.equal(pending.status, 'READY')
  assert.equal(pending.storageKey, 'spaces/space/resources/uuid-1/uuid-2.pdf')
  assert.equal(f.objects.has(pending.storageKey!), true)
  f.setActor('outsider')
  await assert.rejects(() => f.service.download('space', issued.resourceId), { status: 403 })
  f.setActor('member')
  const download = await f.service.download('space', issued.resourceId)
  assert.equal(download.expiresAt, new Date(start.getTime() + LEARNING_DOWNLOAD_TTL_MS).toISOString())
  assert.equal(f.canOpenSignedUrl(download.url), true)
  f.advance(LEARNING_DOWNLOAD_TTL_MS + 1)
  assert.equal(f.canOpenSignedUrl(download.url), false, 'mock provider rejects an expired bearer URL')
  f.setArchived(true)
  assert.ok((await f.service.download('space', issued.resourceId)).url)
  await assert.rejects(() => f.service.initiate('space', f.valid), { status: 403 })
  f.setArchived(false)
  await f.service.softDelete('space', issued.resourceId)
  assert.equal(pending.status, 'DELETED')
  assert.equal(pending.storageKey, null)
  await assert.rejects(() => f.service.download('space', issued.resourceId), { status: 404 })
})

test('download disposition uses the stored Unicode filename, never the randomized storage key', () => {
  assert.equal(downloadContentDisposition('valid.pdf'), "attachment; filename=\"valid.pdf\"; filename*=UTF-8''valid.pdf")
  assert.equal(downloadContentDisposition('Tài liệu tiếng Việt.pdf'), "attachment; filename=\"T_i li_u ti_ng Vi_t.pdf\"; filename*=UTF-8''T%C3%A0i%20li%E1%BB%87u%20ti%E1%BA%BFng%20Vi%E1%BB%87t.pdf")
  assert.doesNotMatch(downloadContentDisposition('valid.pdf'), /uuid-1|spaces\//)
})

test('wrong provider MIME is quarantined; deleted resources cannot receive URLs', async () => {
  const f = fixture()
  const issued = await f.service.initiate('space', f.valid)
  const row = f.rows.get(issued.resourceId)!
  f.objects.set(row.storageKey!, { sizeBytes: 1024, mimeType: 'text/html' })
  await assert.rejects(() => f.service.finalize('space', issued.resourceId), { status: 409 })
  assert.equal(row.status, 'QUARANTINED')
  await assert.rejects(() => f.service.download('space', issued.resourceId), { status: 404 })
  await f.service.softDelete('space', issued.resourceId)
  await assert.rejects(() => f.service.download('space', issued.resourceId), { status: 404 })
  const larger = await f.service.initiate('space', f.valid)
  const largerRow = f.rows.get(larger.resourceId)!
  f.objects.set(largerRow.storageKey!, { sizeBytes: 1025, mimeType: 'application/pdf' })
  await assert.rejects(() => f.service.finalize('space', larger.resourceId), { status: 409 })
  assert.equal(largerRow.status, 'QUARANTINED')
})

test('safe images and UTF-8 text finalize; disguised PDF content is quarantined', async () => {
  const f = fixture()
  for (const input of [
    { fileName: 'photo.jpg', mimeType: 'image/jpeg', sizeBytes: 100 },
    { fileName: 'diagram.png', mimeType: 'image/png', sizeBytes: 100 },
    { fileName: 'notes.txt', mimeType: 'text/plain', sizeBytes: 100 },
    { fileName: 'readme.md', mimeType: 'text/markdown', sizeBytes: 100 },
  ]) {
    const issued = await f.service.initiate('space', input)
    const row = f.rows.get(issued.resourceId)!
    f.objects.set(row.storageKey!, { sizeBytes: 100, mimeType: input.mimeType })
    await f.service.finalize('space', issued.resourceId)
    assert.equal(row.status, 'READY')
  }
  const disguised = await f.service.initiate('space', f.valid)
  const row = f.rows.get(disguised.resourceId)!
  f.objects.set(row.storageKey!, { sizeBytes: 1024, mimeType: 'application/pdf' })
  f.setContent(row.storageKey!, new TextEncoder().encode('<html>not a pdf</html>'))
  await assert.rejects(() => f.service.finalize('space', disguised.resourceId), { status: 409 })
  assert.equal(row.status, 'QUARANTINED')
  await assert.rejects(() => f.service.download('space', disguised.resourceId), { status: 404 })
})

test('orphan finalize and cleanup remove expired pending uploads and release their key', async () => {
  const f = fixture()
  const issued = await f.service.initiate('space', f.valid)
  const row = f.rows.get(issued.resourceId)!
  f.objects.set(row.storageKey!, { sizeBytes: 1024, mimeType: 'application/pdf' })
  f.advance(LEARNING_ORPHAN_GRACE_MS + 1)
  await assert.rejects(() => f.service.finalize('space', issued.resourceId), { status: 409 })
  await f.service.cleanupOrphans()
  assert.equal(row.status, 'DELETED')
  assert.equal(row.storageKey, null)
  assert.equal(f.objects.size, 0)
  assert.ok(f.removed.some(key => key.startsWith('pending/')))
})

test('provider signing and promotion failure never make a pending file downloadable', async () => {
  const sign = fixture()
  sign.failSign()
  await assert.rejects(() => sign.service.initiate('space', sign.valid), { status: 502 })
  assert.equal([...sign.rows.values()][0].status, 'DELETED')

  const promote = fixture()
  const issued = await promote.service.initiate('space', promote.valid)
  const row = promote.rows.get(issued.resourceId)!
  promote.objects.set(row.storageKey!, { sizeBytes: 1024, mimeType: 'application/pdf' })
  promote.failPromote()
  await assert.rejects(() => promote.service.finalize('space', issued.resourceId), { status: 502 })
  assert.equal(row.status, 'PENDING')
  await assert.rejects(() => promote.service.download('space', issued.resourceId), { status: 404 })
})

test('failed deletion is retried by cleanup without restoring resource access', async () => {
  const f = fixture()
  const issued = await f.service.initiate('space', f.valid)
  const row = f.rows.get(issued.resourceId)!
  f.setFailRemove(true)
  await f.service.softDelete('space', issued.resourceId)
  assert.equal(row.status, 'DELETED')
  await assert.rejects(() => f.service.download('space', issued.resourceId), { status: 404 })
  f.setFailRemove(false)
  await f.service.cleanupOrphans()
  assert.equal(row.storageKey, null)
})

test('a deletion racing with finalize cannot publish or retain a promoted object', async () => {
  const f = fixture()
  const issued = await f.service.initiate('space', f.valid)
  const row = f.rows.get(issued.resourceId)!
  f.objects.set(row.storageKey!, { sizeBytes: 1024, mimeType: 'application/pdf' })
  f.deleteDuringPromote()
  await assert.rejects(() => f.service.finalize('space', issued.resourceId), { status: 409 })
  assert.equal(row.status, 'DELETED')
  assert.equal(f.objects.has(row.storageKey!.replace('pending/', '')), false)
  await assert.rejects(() => f.service.download('space', issued.resourceId), { status: 404 })
})
