import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LearningSpaceDetails } from '../../../src/components/learning/LearningSpaceDetails'

test('space details display and archived editing controls', () => {
  const props = { spaceId: 's', version: 1, objective: 'Mục tiêu', definitionOfDone: 'Hoàn thành', archived: false }
  const html = renderToStaticMarkup(createElement(LearningSpaceDetails, props))
  assert.match(html, /Mục tiêu/); assert.match(html, /Hoàn thành/); assert.match(html, /Chỉnh sửa/)
  assert.doesNotMatch(renderToStaticMarkup(createElement(LearningSpaceDetails, { ...props, archived: true })), /Chỉnh sửa/)
})
