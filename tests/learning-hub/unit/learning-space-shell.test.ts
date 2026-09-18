import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LearningSpaceShell } from '../../../src/components/learning/LearningSpaceShell'
import { loadLearningSpaceShell, type LearningSpaceShellData } from '../../../src/lib/learning-space-shell'

const base: LearningSpaceShellData = {
  id: 'space-1', title: 'Luyện phát âm tiếng Việt', state: 'ACTIVE', primarySkillName: 'Giao tiếp',
  objective: 'Tự tin trình bày trong cuộc họp.', definitionOfDone: 'Nói rõ ràng trong phần trình bày năm phút.',
  members: [{ id: 'member-1', name: 'An', email: 'an@example.test' }, { id: 'member-2', name: 'Bình', email: 'binh@example.test' }],
  topics: [{ id: 'topic-1', label: 'Ngữ điệu', state: 'ACTIVE' }],
  bookings: [{ id: 'booking-1', startTime: new Date('2030-01-02T03:00:00.000Z'), endTime: new Date('2030-01-02T04:00:00.000Z'), status: 'CONFIRMED' }],
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
  assert.match(html, /sm:grid-cols-2/)
  assert.match(html, /focus-visible:ring-2/)
  assert.equal((html.match(/<nav/g) ?? []).length, 1)
  assert.doesNotMatch(html, /ProductionHeader|Tin nhắn|Ví của Mình/)
})
