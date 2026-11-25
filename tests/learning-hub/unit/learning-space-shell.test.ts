import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LearningSpaceShell } from '../../../src/components/learning/LearningSpaceShell'
import { findShell, loadLearningSpaceShell, type LearningSpaceShellData } from '../../../src/lib/learning-space-shell'
import { prisma } from '../../../src/lib/prisma'

const base: LearningSpaceShellData = {
  id: 'space-1', title: 'Luyện phát âm tiếng Việt', version: 1, state: 'ACTIVE', primarySkillName: 'Giao tiếp',
  objective: 'Tự tin trình bày trong cuộc họp.', definitionOfDone: 'Nói rõ ràng trong phần trình bày năm phút.',
  members: [{ id: 'member-1', name: 'An', email: 'an@example.test' }, { id: 'member-2', name: 'Bình', email: 'binh@example.test' }],
  topics: [{ id: 'topic-1', label: 'Ngữ điệu', state: 'ACTIVE' }],
  bookings: [{ id: 'booking-1', startTime: new Date('2030-01-02T03:00:00.000Z'), endTime: new Date('2030-01-02T04:00:00.000Z'), status: 'CONFIRMED', mentorId: 'member-1', menteeId: 'member-2' }],
}

const memberShell = { ...base, viewerId: 'member-1' }

test('member render contains the authorized LearningSpace shell', () => {
  const html = renderToStaticMarkup(createElement(LearningSpaceShell, { space: memberShell }))
  assert.match(html, /Luyện phát âm tiếng Việt/)
  assert.match(html, /Giao tiếp/)
  assert.match(html, /Đặt buổi học tiếp theo/)
  assert.match(html, /learningSpaceId=space-1/)
  assert.match(html, /Tài nguyên/)
})

test('nonmember rejection stops before private metadata is queried', async () => {
  let queried = false
  await assert.rejects(() => loadLearningSpaceShell('private-space', {
    requireMember: async () => { throw new Error('Learning space membership required') },
    findShell: async () => { queried = true; return base },
  }))
  assert.equal(queried, false)
})

test('archived spaces remain readable and clearly read-only', () => {
  const html = renderToStaticMarkup(createElement(LearningSpaceShell, { space: { ...memberShell, state: 'ARCHIVED' } }))
  assert.match(html, /LearningSpace đã lưu trữ/)
  assert.match(html, /Các thay đổi đang được khóa/)
  assert.doesNotMatch(html, /Thêm tài nguyên|Tạo công việc|Thêm ghi chú/)
})

test('empty and long Vietnamese content is preserved without requiring a mutation UI', () => {
  const longText = 'Học thật kỹ để có thể áp dụng ngay trong công việc. '.repeat(400)
  const html = renderToStaticMarkup(createElement(LearningSpaceShell, { space: { ...memberShell, objective: longText, definitionOfDone: longText, topics: [], bookings: [] } }))
  assert.match(html, /Chưa có chủ đề phụ/)
  assert.match(html, /Chưa có buổi học nào/)
  assert.match(html, /whitespace-pre-wrap/)
  assert.match(html, /break-words/)
})

test('mobile layout, keyboard focus, and navigation stay local to the route', () => {
  const html = renderToStaticMarkup(createElement(LearningSpaceShell, { space: memberShell }))
  assert.match(html, /grid-cols-2 gap-2 sm:grid-cols-4/)
  assert.match(html, /focus-visible:ring-2/)
  assert.equal((html.match(/<nav/g) ?? []).length, 2)
  assert.doesNotMatch(html, /ProductionHeader|Tin nhắn|Ví của Mình/)
})

test('the detail projection renders both an unset skill and an existing skill for an authorized member', async t => {
  let primarySkill: { name: string } | null = null
  const original = prisma.learningSpace.findUnique
  Reflect.set(prisma.learningSpace, 'findUnique', async () => ({
    ...base,
    primarySkill,
    members: base.members.map(user => ({ user })),
  }))
  t.after(() => { Reflect.set(prisma.learningSpace, 'findUnique', original) })
  const load = () => loadLearningSpaceShell(base.id, { requireMember: async () => ({ user: { id: 'member-1' } }), findShell })
  const unset = await load()
  assert.ok(unset)
  assert.equal(unset.primarySkillName, 'Chưa thiết lập')
  assert.equal(unset.viewerId, 'member-1')
  assert.match(renderToStaticMarkup(createElement(LearningSpaceShell, { space: unset })), /Chưa thiết lập/)
  primarySkill = { name: 'Giao tiếp' }
  const existing = await load()
  assert.equal(existing?.primarySkillName, 'Giao tiếp')
})
