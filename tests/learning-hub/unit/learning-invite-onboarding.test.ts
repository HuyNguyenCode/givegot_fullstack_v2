import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { BringYourPair } from '../../../src/components/learning/BringYourPair'
import { LearningSpaceShell } from '../../../src/components/learning/LearningSpaceShell'

test('C2 creator journey uses clear Vietnamese labels, optional objective, and an accessible mobile form', () => {
  const html = renderToStaticMarkup(createElement(BringYourPair, { skills: [{ id: 'skill-1', name: 'TypeScript' }] }))
  assert.match(html, /Học cùng người bạn đã có/)
  assert.match(html, /Kỹ năng chính/); assert.match(html, /Mục tiêu chung/); assert.match(html, /không bắt buộc/)
  assert.match(html, /Tạo liên kết mời/); assert.match(html, /sm:p-8/); assert.match(html, /focus-visible:ring-2/)
  assert.match(html, /Quay lại bảng điều khiển/)
})

test('C2 presents exactly the available first-value action after invite acceptance', () => {
  const html = renderToStaticMarkup(createElement(LearningSpaceShell, { showFirstValue: true, space: {
    id: 'space-1', viewerId: 'a', title: 'Learning: TypeScript', state: 'ACTIVE', primarySkillName: 'TypeScript', objective: null, definitionOfDone: null,
    members: [{ id: 'a', name: 'An', email: 'a@example.test' }, { id: 'b', name: 'Bình', email: 'b@example.test' }], topics: [], bookings: [],
  } }))
  assert.match(html, /Đặt buổi học đầu tiên/)
  assert.doesNotMatch(html, /Thêm tài nguyên|Tạo công việc/)
})
