import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { LearningTopicManagement, requestTopicMutation, upsertTopic } from '../../../src/components/learning/LearningTopicManagement'

const active = { id: 'topic-1', label: 'Ngữ điệu', state: 'ACTIVE' as const }

test('topic create, rename, and archive use existing collection and item contracts', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const request = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    const topic = calls.length === 3 ? { ...active, state: 'ARCHIVED' } : calls.length === 2 ? { ...active, label: 'Phát âm' } : active
    return Response.json({ topic }, { status: calls.length === 1 ? 201 : 200 })
  }) as typeof fetch
  assert.deepEqual(await requestTopicMutation('space/1', null, { label: 'Ngữ điệu' }, request), active)
  assert.equal((await requestTopicMutation('space/1', active.id, { label: 'Phát âm' }, request)).label, 'Phát âm')
  assert.equal((await requestTopicMutation('space/1', active.id, { action: 'archive' }, request)).state, 'ARCHIVED')
  assert.deepEqual(calls.map(call => [call.url, call.init?.method, call.init?.body]), [
    ['/api/learning/spaces/space%2F1/topics', 'POST', JSON.stringify({ label: 'Ngữ điệu' })],
    ['/api/learning/spaces/space%2F1/topics/topic-1', 'PATCH', JSON.stringify({ label: 'Phát âm' })],
    ['/api/learning/spaces/space%2F1/topics/topic-1', 'PATCH', JSON.stringify({ action: 'archive' })],
  ])
})

test('API and network errors are surfaced without treating mutation as successful', async () => {
  await assert.rejects(requestTopicMutation('s', null, { label: 'x' }, (async () => Response.json({ error: 'Chủ đề không hợp lệ' }, { status: 400 })) as typeof fetch), /Chủ đề không hợp lệ/)
  await assert.rejects(requestTopicMutation('s', null, { label: 'x' }, (async () => { throw new TypeError('offline') }) as typeof fetch), /Không thể kết nối/)
  await assert.rejects(requestTopicMutation('s', null, { label: 'x' }, (async () => Response.json({ error: 'bad' }, { status: 400 })) as typeof fetch), /bad/)
})

test('successful create and rename refresh topics without adding duplicate IDs', () => {
  assert.deepEqual(upsertTopic([], active), [active])
  assert.deepEqual(upsertTopic([active], { ...active, label: 'Phát âm' }), [{ ...active, label: 'Phát âm' }])
  assert.deepEqual(upsertTopic([active], { id: 'topic-2', label: 'Từ vựng', state: 'ACTIVE' }), [active, { id: 'topic-2', label: 'Từ vựng', state: 'ACTIVE' }])
})

test('active spaces expose accessible management controls while archived spaces remain read-only', () => {
  const activeHtml = renderToStaticMarkup(createElement(LearningTopicManagement, { spaceId: 's', archived: false, topics: [active, { ...active, id: 'topic-2', label: 'Từ vựng', state: 'ARCHIVED' }], onTopicsChange() {} }))
  assert.match(activeHtml, /Thêm chủ đề/)
  assert.match(activeHtml, /Đổi tên/)
  assert.match(activeHtml, /Lưu trữ/)
  assert.match(activeHtml, /Từ vựng \(đã lưu trữ\)/)
  assert.match(activeHtml, /aria-labelledby="topics-heading"/)
  assert.match(activeHtml, /focus-visible:ring-2/)
  const archivedHtml = renderToStaticMarkup(createElement(LearningTopicManagement, { spaceId: 's', archived: true, topics: [active], onTopicsChange() {} }))
  assert.doesNotMatch(archivedHtml, /Thêm chủ đề|Đổi tên|Lưu trữ/)
  assert.match(archivedHtml, /Ngữ điệu/)
})

test('task form continues to filter archived topics and reject a stale selected topic', async () => {
  const { CreateTask } = await import('../../../src/components/learning/LearningTaskCreate')
  const { readFileSync } = await import('node:fs')
  const form = readFileSync('src/components/learning/LearningTaskCreate.tsx', 'utf8')
  const sections = readFileSync('src/components/learning/LearningSpaceSections.tsx', 'utf8')
  assert.match(form, /topics\.filter\(topic => topic\.state === 'ACTIVE'\)/)
  assert.match(form, /draft\.topicId && !topics\.some\(topic => topic\.id === draft\.topicId && topic\.state === 'ACTIVE'\)/)
  assert.match(sections, /const \[currentTopics, setCurrentTopics\] = useState\(topics\)/)
  assert.match(sections, /topics=\{currentTopics\}/)
  assert.match(sections, /<LearningTopicManagement[^>]+onTopicsChange=\{setCurrentTopics\}/)
  assert.match(sections, /<LearningSubmissions[^>]+topics=\{currentTopics\}/)
  assert.doesNotMatch(sections, /<LearningSubmissions[^>]+key=/)
  assert.ok(CreateTask)
})
