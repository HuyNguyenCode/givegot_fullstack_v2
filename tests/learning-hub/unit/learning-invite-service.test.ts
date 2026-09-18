import assert from 'node:assert/strict'
import test from 'node:test'

import { createLearningInviteService, LearningInviteConflictError } from '../../../src/lib/learning-invite-service'
import { AuthorizationError } from '../../../src/lib/server-authorization'

const CREATED_AT = new Date('2026-09-16T00:00:00.000Z')
const TOKEN = '4f_DdsMNjrFKri7cogT10OCcYDI3aaOdBvyNkYmNQjg'

function repository() {
  const invites = new Map<string, any>(); const invitesByHash = new Map<string, any>(); const spaces = new Map<string, any>(); const members = new Map<string, any>(); let next = 1; let tail = Promise.resolve()
  const memberKey = (spaceId: string, userId: string) => `${spaceId}:${userId}`
  const transaction = async <T>(fn: (tx: any) => Promise<T>) => {
    let release!: () => void; const previous = tail; tail = new Promise<void>(resolve => { release = resolve }); await previous
    try { return await fn(tx) } finally { release() }
  }
  const tx: any = {
    lock: async () => {},
    skillExists: async (id: string) => id === 'skill-1',
    skill: async (id: string) => id === 'skill-1' ? { id, name: 'TypeScript' } : null,
    createInvite: async (data: any) => { const invite = { id: `invite-${next++}`, learningSpaceId: null, acceptedById: null, status: 'ACTIVE', useCount: 0, acceptedAt: null, revokedAt: null, createdAt: CREATED_AT, updatedAt: CREATED_AT, ...data }; invites.set(invite.id, invite); invitesByHash.set(invite.tokenHash, invite); return invite },
    inviteById: async (id: string) => invites.get(id) ?? null,
    inviteByHash: async (hash: string) => invitesByHash.get(hash) ?? null,
    expireInvite: async (id: string) => Object.assign(invites.get(id), { status: 'EXPIRED' }),
    revokeInvite: async (id: string, revokedAt: Date) => Object.assign(invites.get(id), { status: 'REVOKED', revokedAt }),
    space: async (id: string | null) => id ? spaces.get(id) ?? null : null,
    activeMembers: async (spaceId: string) => [...members.values()].filter(member => member.learningSpaceId === spaceId && member.status === 'ACTIVE'),
    createSpace: async (data: any) => { const space = { id: `space-${next++}`, state: 'ACTIVE', ...data }; spaces.set(space.id, space); return space },
    createMember: async (learningSpaceId: string, userId: string) => { const member = { learningSpaceId, userId, status: 'ACTIVE' }; members.set(memberKey(learningSpaceId, userId), member); return member },
    acceptInvite: async (id: string, acceptedById: string, learningSpaceId: string, acceptedAt: Date) => { const invite = invites.get(id); if (!invite || invite.status !== 'ACTIVE' || invite.useCount >= 1) return null; Object.assign(invite, { status: 'ACCEPTED', acceptedById, learningSpaceId, acceptedAt, useCount: invite.useCount + 1 }); return invite },
  }
  return { transaction, findInviteByHash: async (hash: string) => invitesByHash.get(hash) ?? null, invites, spaces, members, tx }
}

function service(repo: ReturnType<typeof repository>, actor: string, now = CREATED_AT) {
  return createLearningInviteService({ repository: repo, requireAuthenticatedUser: async () => ({ id: actor, email: `${actor}@example.test`, name: actor }), now: () => new Date(now), generateToken: () => TOKEN })
}
async function create(repo: ReturnType<typeof repository>, expiresAt = new Date('2026-09-17T00:00:00.000Z')) {
  return service(repo, 'a').create({ primarySkillId: 'skill-1', objective: 'Ship a safe invite', expiresAt: expiresAt.toISOString(), maxUses: 1 })
}

test('C1 creates a high-entropy hashed invite and accepts it exactly once for its pair', async () => {
  const repo = repository(); const created = await create(repo); const accepted = await service(repo, 'b').accept(created.token)
  assert.equal(created.token, TOKEN); assert.equal(created.invite.tokenHash, undefined); assert.notEqual([...repo.invites.values()][0].tokenHash, TOKEN)
  assert.equal(accepted.space.objective, 'Ship a safe invite'); assert.equal([...repo.members.values()].filter(member => member.learningSpaceId === accepted.space.id).length, 2)
  assert.equal(accepted.invite.acceptedAt instanceof Date, true); assert.equal(accepted.invite.useCount, 1)
})

test('C1 rejects expired, revoked, and self invites', async () => {
  const expiredRepo = repository(); const expired = await create(expiredRepo, new Date('2026-09-16T00:01:00.000Z'))
  await assert.rejects(service(expiredRepo, 'b', new Date('2026-09-16T00:02:00.000Z')).accept(expired.token), (error: any) => error instanceof LearningInviteConflictError && /expired/.test(error.message))
  const revokedRepo = repository(); const revoked = await create(revokedRepo); await service(revokedRepo, 'a').revoke(revoked.invite.id)
  await assert.rejects(service(revokedRepo, 'b').accept(revoked.token), (error: any) => error instanceof LearningInviteConflictError && /revoked/.test(error.message))
  const selfRepo = repository(); const self = await create(selfRepo)
  await assert.rejects(service(selfRepo, 'a').accept(self.token), (error: any) => error instanceof LearningInviteConflictError && /own/.test(error.message))
})

test('C1 replays idempotently for the accepting user and rejects reuse by another user', async () => {
  const repo = repository(); const created = await create(repo); const first = await service(repo, 'b').accept(created.token); const replay = await service(repo, 'b').accept(created.token)
  assert.equal(replay.idempotent, true); assert.equal(replay.space.id, first.space.id)
  await assert.rejects(service(repo, 'c').accept(created.token), (error: any) => error instanceof AuthorizationError && error.status === 403)
})

test('C1 serializes concurrent acceptance without a duplicate space or third member', async () => {
  const repo = repository(); const created = await create(repo); const recipient = service(repo, 'b')
  const [one, two] = await Promise.all([recipient.accept(created.token), recipient.accept(created.token)])
  assert.equal([one, two].filter(result => !result.idempotent).length, 1); assert.equal(repo.spaces.size, 1); assert.equal(repo.members.size, 2)
})

test('C1 rejects reuse that would create a third active member', async () => {
  const repo = repository(); const existing = await repo.tx.createSpace({ title: 'Existing', primarySkillId: 'skill-1' }); await repo.tx.createMember(existing.id, 'a'); await repo.tx.createMember(existing.id, 'c'); const created = await create(repo)
  await assert.rejects(service(repo, 'b').accept(created.token, { reuseSpaceId: existing.id }), (error: any) => error instanceof LearningInviteConflictError && /third/.test(error.message))
})

test('C1 lets an existing pair explicitly reuse or create a separate active space', async () => {
  const repo = repository(); const existing = await repo.tx.createSpace({ title: 'Existing', primarySkillId: 'skill-1' }); await repo.tx.createMember(existing.id, 'a'); await repo.tx.createMember(existing.id, 'b')
  const reuse = await create(repo); const reuseAccepted = await service(repo, 'b').accept(reuse.token, { reuseSpaceId: existing.id }); assert.equal(reuseAccepted.space.id, existing.id)
  const separate = await create(repo); const separateAccepted = await service(repo, 'b').accept(separate.token); assert.notEqual(separateAccepted.space.id, existing.id); assert.equal(repo.spaces.size, 2)
})

test('C2 preview shows only the active invite promise and hides stale pair metadata', async () => {
  const repo = repository(); const created = await create(repo)
  const active = await service(repo, 'b').preview(created.token)
  assert.equal(active.canAccept, true); assert.equal(active.invite?.objective, 'Ship a safe invite')
  await service(repo, 'a').revoke(created.invite.id)
  const revoked = await service(repo, 'b').preview(created.token)
  assert.equal(revoked.status, 'REVOKED'); assert.equal(revoked.canAccept, false); assert.equal(revoked.invite, null)
})
