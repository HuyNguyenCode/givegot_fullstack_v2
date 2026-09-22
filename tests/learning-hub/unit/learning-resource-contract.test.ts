import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { LearningResources } from '../../../src/components/learning/LearningResources'
import { normalizeExternalUrl } from '../../../src/lib/learning-resource-service'

test('external resources accept normalized HTTPS only and reject dangerous schemes', () => {
  assert.equal(normalizeExternalUrl(' HTTPS://Example.COM/path#fragment '), 'https://example.com/path')
  for (const value of ['http://example.test', 'javascript:alert(1)', 'data:text/html,boom', 'file:///private']) {
    assert.throws(() => normalizeExternalUrl(value), { status: 400 })
  }
})

test('resource UI exposes quota, empty/error-safe states, and mobile-safe long Vietnamese filenames', () => {
  const longName = `Tài liệu luyện phát âm tiếng Việt ${'rất dài '.repeat(70)}.pdf`
  const html = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '1024', maxBytes: String(500 * 1024 * 1024) }, topics: [], archived: false, resources: [{ id: 'file', bookingId: null, topicId: null, kind: 'FILE', title: longName, description: null, externalUrl: null, mimeType: 'application/pdf', sizeBytes: '1024', status: 'READY', createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: null, canDelete: true }] }))
  assert.match(html, /Đã dùng 0.0 MB \/ 500.0 MB/)
  assert.match(html, /Tải tệp riêng tư/)
  assert.match(html, /break-words/)
  assert.match(html, /min-h-10/)
  const empty = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) }, topics: [], archived: false, resources: [] }))
  assert.match(empty, /Chưa có tài nguyên/)
})

test('ready LINK resource titles preserve the safe external-navigation contract', () => {
  const title = `Tài liệu luyện phát âm tiếng Việt ${'rất dài '.repeat(70)}`
  const html = renderToStaticMarkup(createElement(LearningResources, { spaceId: 'space', quota: { usedBytes: '0', maxBytes: String(500 * 1024 * 1024) }, topics: [], archived: false, resources: [
    { id: 'link', bookingId: null, topicId: null, kind: 'LINK', title, description: null, externalUrl: 'https://example.com/tai-lieu', mimeType: null, sizeBytes: null, status: 'READY', createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: null, canDelete: true },
    { id: 'file', bookingId: null, topicId: null, kind: 'FILE', title: 'Tệp riêng tư.pdf', description: null, externalUrl: null, mimeType: 'application/pdf', sizeBytes: '1024', status: 'READY', createdAt: new Date('2030-01-01T00:00:00.000Z'), uploaderName: 'An', topicLabel: null, canDelete: true },
  ] }))
  assert.match(html, new RegExp(`<a href="https://example\\.com/tai-lieu" target="_blank" rel="noopener noreferrer"[^>]*>${title}</a>`))
  assert.match(html, /Mở<svg/)
  assert.match(html, /<p[^>]*>Liên kết · An/)
  assert.match(html, /aria-label="Xóa Tài liệu luyện phát âm tiếng Việt/)
  assert.match(html, /Tệp riêng tư\.pdf<\/p>/)
  assert.match(html, /Tải<svg/)
  assert.doesNotMatch(html, /storageKey|signedUrl|spaces\//)
  assert.match(html, /break-words/)
})

test('resource contracts retain private boundaries and deduplicated activity semantics', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile('src/lib/learning-resource-service.ts', 'utf8'))
  assert.match(source, /requireAuthenticatedUser/)
  assert.match(source, /learningSpaceId_userId/)
  assert.match(source, /eventKey: `learning-resource:\$\{resource.id\}:created`/)
  assert.match(source, /metadata: \{ kind: 'LINK', status: 'READY' \}/)
  assert.doesNotMatch(source, /signDownload|storageKey.*return/)
})
