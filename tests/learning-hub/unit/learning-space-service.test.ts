import assert from 'node:assert/strict'
import test from 'node:test'
import type { Booking, LearningSpace, LearningSpaceMember, LearningTopic, Prisma } from '@prisma/client'
import { createLearningSpaceService, LearningSpaceConflictError, type LearningSpaceTransaction } from '../../../src/lib/learning-space-service'
import { AuthorizationError } from '../../../src/lib/server-authorization'
import { NextRequest } from 'next/server'
import { createLearningSpaceHandlers, createLearningTopicCollectionHandlers, createLearningTopicHandlers } from '../../../src/lib/learning-space-route-handlers'

const now = new Date('2026-09-16T00:00:00.000Z')
type SpaceRecord = Pick<LearningSpace, 'id' | 'state' | 'version' | 'primarySkillId'>
type MemberRecord = Pick<LearningSpaceMember, 'learningSpaceId' | 'userId' | 'status'>
type TopicRecord = Pick<LearningTopic, 'id' | 'learningSpaceId' | 'state' | 'label' | 'updatedAt'>
type BookingRecord = Pick<Booking, 'id' | 'mentorId' | 'menteeId' | 'status' | 'learningSpaceId'>
function repo() {
  const spaces = new Map<string, SpaceRecord>(); const members = new Map<string, MemberRecord>(); const topics = new Map<string, TopicRecord>(); const activities: Prisma.LearningActivityUncheckedCreateInput[] = []; const bookings = new Map<string, BookingRecord>([['legacy', { id: 'legacy', mentorId: 'a', menteeId: 'b', status: 'COMPLETED', learningSpaceId: null }], ['confirmed', { id: 'confirmed', mentorId: 'a', menteeId: 'b', status: 'CONFIRMED', learningSpaceId: null }]]); let next = 1
  const key = (s: string, u: string) => `${s}:${u}`
  const tx: LearningSpaceTransaction = { lock: async () => {}, space: async (id: string) => spaces.get(id) ?? null, member: async (s: string, u: string) => members.get(key(s,u)) ?? null, activeMemberCount: async (s: string) => [...members.values()].filter(m => m.learningSpaceId === s && m.status === 'ACTIVE').length, userExists: async (id: string) => ['a','b','c','d'].includes(id), skillExists: async (id: string) => ['skill-1','skill-2'].includes(id), createSpace: async (data: Prisma.LearningSpaceUncheckedCreateInput) => { const x={ id:`s${next++}`,state:'ACTIVE' as const,version:1,updatedById:null,archivedAt:null,createdAt:now,updatedAt:now,...data }; spaces.set(x.id,x); return x }, createMember: async (s:string,u:string) => { const x={learningSpaceId:s,userId:u,status:'ACTIVE' as const,joinedAt:now,leftAt:null}; members.set(key(s,u),x); return x }, reactivateMember: async (s:string,u:string) => { const x=members.get(key(s,u))!; x.status='ACTIVE'; return x }, booking: async (id:string) => bookings.get(id) ?? null, attachBooking: async (id:string,s:string) => { const b=bookings.get(id)!; if (b.learningSpaceId) throw new LearningSpaceConflictError('Booking is already associated with a learning space'); b.learningSpaceId=s }, updateSpace: async (id:string,v:number,data:Prisma.LearningSpaceUncheckedUpdateManyInput) => { const x=spaces.get(id); if (!x || x.version!==v) return null; Object.assign(x,data,{version:v+1}); return x }, topic: async (s:string,id:string) => { const x=topics.get(id); return x?.learningSpaceId===s ? x : null }, topics: async (s:string) => [...topics.values()].filter(t=>t.learningSpaceId===s), createTopic: async (data:Prisma.LearningTopicUncheckedCreateInput) => { const x={id:`t${next++}`,...data,state:'ACTIVE' as const,archivedAt:null,createdAt:now,updatedAt:now}; topics.set(x.id,x); return x }, updateTopic: async (id:string,data:Prisma.LearningTopicUncheckedUpdateInput) => Object.assign(topics.get(id)!,data), activity: async (x:Prisma.LearningActivityUncheckedCreateInput) => { activities.push(x) }, reusable: async ({memberIds,primarySkillId}:{memberIds:[string,string];primarySkillId:string}) => [...spaces.values()].filter(s=>s.state==='ACTIVE'&&s.primarySkillId===primarySkillId&&memberIds.every((u:string)=>members.get(key(s.id,u))?.status==='ACTIVE')) }
  return { findSpaceMembership: async ({spaceId,userId}:{spaceId:string;userId:string}) => ({spaceExists:spaces.has(spaceId),membership:members.get(key(spaceId,userId))??null}), transaction: async <T>(f:(tx:LearningSpaceTransaction)=>Promise<T>):Promise<T> => f(tx), spaces,members,topics,activities,bookings }
}
function service(actor='a') { const r=repo(); const access: { account: { isSuspended: boolean; trustScore: number } | null; authenticated: boolean } = { account: { isSuspended: false, trustScore: 30 }, authenticated: true }; const s=createLearningSpaceService({ repository:r, requireAuthenticatedUser:async()=>{ if (!access.authenticated) throw new AuthorizationError(401, 'Authentication required'); return {id:actor,email:null,name:null} }, findAccount:async id=>{ assert.equal(id,actor); return access.account }, requireLearningSpaceMember:async id=>{ if (!access.authenticated) throw new AuthorizationError(401, 'Authentication required'); const m=await r.findSpaceMembership({spaceId:id,userId:actor}); if(!m.spaceExists)throw new AuthorizationError(404,'Learning space not found'); if(!m.membership || m.membership.status !== 'ACTIVE')throw new AuthorizationError(403,'Learning space membership required'); return {user:{id:actor,email:null,name:null},membership:m.membership}}, now:()=>now }); return {r,s,access} }
test('B2 allows exactly two active members, permits repeated pair spaces, and suggests without forcing reuse', async () => { const {r,s}=service(); const one=await s.createDirect({memberId:'b',title:'One',primarySkillId:'skill-1'}); const two=await s.createDirect({memberId:'b',title:'Two',primarySkillId:'skill-1'}); assert.notEqual(one.id,two.id); assert.equal((await s.suggestReuse({memberId:'b',primarySkillId:'skill-1'})).length,2); await assert.rejects(s.addMember(one.id,{memberId:'c'}),(e:unknown)=>e instanceof LearningSpaceConflictError); assert.equal(await r.bookings.get('legacy')!.learningSpaceId,null) })
test('B2 rejects nonmembers and optimistic conflicts, while retaining archived topic references and primary-skill audit', async () => { const {r,s}=service(); const space=await s.createDirect({memberId:'b',title:'One',primarySkillId:'skill-1'}); const topic=await s.addTopic(space.id,{label:'History'}); const booking={topicId:topic.id}; await s.archiveTopic(space.id,topic.id); assert.equal(booking.topicId,topic.id); const changed=await s.changePrimarySkill(space.id,{expectedVersion:1,primarySkillId:'skill-2'}); assert.equal(r.activities.at(-1)!.eventType,'LEARNING_SPACE_PRIMARY_SKILL_CHANGED'); await assert.rejects(s.updateDetails(space.id,{expectedVersion:1,objective:'lost'}),(e:unknown)=>e instanceof LearningSpaceConflictError); const other=service('c'); other.r.spaces.set(space.id,changed); other.r.members.set(`${space.id}:a`,{learningSpaceId:space.id,userId:'a',status:'ACTIVE'}); await assert.rejects(other.s.read(space.id),(e:unknown)=>e instanceof AuthorizationError&&e.status===403); await assert.rejects(other.s.addTopic(space.id,{label:'no'}),(e:unknown)=>e instanceof AuthorizationError&&e.status===403) })

test('topic create, rename, archive events are content-free and retries do not duplicate them', async () => {
  const { r, s } = service()
  const space = await s.createDirect({ memberId: 'b', title: 'One', primarySkillId: 'skill-1' })
  const topic = await s.addTopic(space.id, { label: 'Private project' })
  await s.renameTopic(space.id, topic.id, { label: 'Next phase' })
  await s.renameTopic(space.id, topic.id, { label: 'Next phase' })
  await s.archiveTopic(space.id, topic.id)
  await s.archiveTopic(space.id, topic.id)
  const events = r.activities.filter(row => row.entityType === 'LearningTopic')
  assert.equal(events.length, 3)
  assert.deepEqual(events.map(row => row.metadata), [{ status: 'CREATED' }, { status: 'RENAMED' }, { status: 'ARCHIVED' }])
})

test('title updates validate, increment once and emit the existing details activity', async () => {
  const { r, s } = service()
  const space = await s.createDirect({ memberId: 'b', title: 'Old', primarySkillId: 'skill-1' })
  const updated = await s.updateDetails(space.id, { title: '  Ôn thi Toán  ', objective: 'Goal', expectedVersion: 1 })
  assert.equal(updated.version, 2)
  assert.equal((await s.read(space.id)).space && r.spaces.get(space.id)?.version, 2)
  assert.equal((r.spaces.get(space.id) as unknown as { title: string }).title, 'Ôn thi Toán')
  assert.equal(r.activities.at(-1)?.eventType, 'LEARNING_SPACE_DETAILS_UPDATED')
  const count = r.activities.length
  for (const title of ['', '   ', null, 'x'.repeat(201)]) await assert.rejects(s.updateDetails(space.id, { title, expectedVersion: 2 }))
  await assert.rejects(s.updateDetails(space.id, { title: 'Stale', expectedVersion: 1 }))
  assert.equal(r.activities.length, count)
  await s.updateDetails(space.id, { title: 'x'.repeat(200), expectedVersion: 2 })
})

test('mutation routes enforce current account eligibility while GET and addMember retain membership rules', async () => {
  const { r, s, access } = service()
  const space = await s.createDirect({ memberId: 'b', title: 'Space', primarySkillId: 'skill-1' })
  const spaceHandlers = createLearningSpaceHandlers(s)
  const topics = createLearningTopicCollectionHandlers(s)
  const topicHandlers = createLearningTopicHandlers(s)
  const ctx = { params: Promise.resolve({ spaceId: space.id }) }
  const topicCtx = { params: Promise.resolve({ spaceId: space.id, topicId: 'missing' }) }
  const request = (method: string, body?: object) => new NextRequest('http://localhost/api/learning/spaces/test', { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) })
  const patch = (body: object) => spaceHandlers.PATCH(request('PATCH', body), ctx)
  const postTopic = () => topics.POST(request('POST', { label: 'Topic', userId: 'spoof' }), ctx)
  const patchTopic = () => topicHandlers.PATCH(request('PATCH', { label: 'Renamed', userId: 'spoof' }), topicCtx)
  assert.equal((await patch({ expectedVersion: 1, objective: 'Goal' })).status, 200)
  access.account = { isSuspended: false, trustScore: 31 }
  const created = await postTopic(); assert.equal(created.status, 201)
  const topic = (await created.json()).topic
  const validTopicCtx = { params: Promise.resolve({ spaceId: space.id, topicId: topic.id }) }
  assert.equal((await topicHandlers.PATCH(request('PATCH', { label: 'Renamed' }), validTopicCtx)).status, 200)
  for (const account of [{ isSuspended: true, trustScore: 50 }, { isSuspended: false, trustScore: 29 }, null]) {
    access.account = account
    const before = JSON.stringify({ space: r.spaces.get(space.id), topics: [...r.topics.values()], activities: r.activities })
    for (const response of [await patch({ expectedVersion: 2, objective: 'Forbidden' }), await patch({ action: 'primarySkill', expectedVersion: 2, primarySkillId: 'skill-2' }), await patch({ action: 'archive', expectedVersion: 2 }), await patch({ action: 'restore', expectedVersion: 2 }), await postTopic(), await patchTopic()]) assert.equal(response.status, 403)
    assert.equal(JSON.stringify({ space: r.spaces.get(space.id), topics: [...r.topics.values()], activities: r.activities }), before)
    assert.equal((await spaceHandlers.GET(request('GET'), ctx)).status, 200)
  }
  // addMember deliberately retains the old membership-only authorization path.
  r.members.get(`${space.id}:b`)!.status = 'LEFT'
  await s.addMember(space.id, { memberId: 'b' })
  assert.equal(r.members.get(`${space.id}:b`)!.status, 'ACTIVE')
  access.account = { isSuspended: false, trustScore: 30 }
  assert.equal((await patch({ expectedVersion: 0, objective: 'bad' })).status, 400)
  assert.equal((await patch({ expectedVersion: 1, objective: 'stale' })).status, 409)
  assert.equal((await patch({ action: 'archive', expectedVersion: 2 })).status, 200)
  assert.equal((await spaceHandlers.GET(request('GET'), ctx)).status, 200)
  assert.equal((await postTopic()).status, 409)
  access.account = { isSuspended: true, trustScore: 50 }
  assert.equal((await spaceHandlers.GET(request('GET'), ctx)).status, 200)
  assert.equal((await patch({ action: 'restore', expectedVersion: 3 })).status, 403)
  access.account = { isSuspended: false, trustScore: 29 }
  assert.equal((await spaceHandlers.GET(request('GET'), ctx)).status, 200)
  access.account = { isSuspended: false, trustScore: 30 }
  assert.equal((await patch({ action: 'restore', expectedVersion: 3 })).status, 200)
  r.members.get(`${space.id}:a`)!.status = 'LEFT'
  assert.equal((await patch({ expectedVersion: 4, objective: 'no' })).status, 403)
  assert.equal((await spaceHandlers.GET(request('GET'), ctx)).status, 403)
  access.authenticated = false
  assert.equal((await patch({ expectedVersion: 4, objective: 'no' })).status, 401)
  assert.equal((await spaceHandlers.GET(request('GET'), ctx)).status, 401)
})
