import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createSpaceListing, findListingSpaces } from '../../../src/lib/learning-space-listing'
import { prisma } from '../../../src/lib/prisma'
import { MySpacesView } from '../../../src/components/learning/MySpaces'

const records = [
  { id: 'a', title: 'Tiếng Việt', state: 'ACTIVE' as const, primarySkillName: 'Nói', partnerName: 'Bình' },
  { id: 'b', title: 'Không gian đã lưu trữ', state: 'ARCHIVED' as const, primarySkillName: 'Viết', partnerName: null },
]
test('listing derives identity from authentication and stops on authentication failure', async () => {
  let seen = ''
  const list = createSpaceListing({ authenticate: async () => ({ id: 'user-a' }), findAccount: async () => ({ isSuspended: false, trustScore: 30 }), findSpaces: async id => { seen = id; return records } })
  assert.deepEqual(await list(), records)
  assert.equal(seen, 'user-a')
  let queried = false
  await assert.rejects(createSpaceListing({ authenticate: async () => { throw new Error('unauthenticated') }, findAccount: async () => { throw new Error('unexpected account query') }, findSpaces: async () => { queried = true; return [] } }))
  assert.equal(queried, false)
})
test('Prisma query limits listing and partner to active membership with minimal fields', async () => {
  const original = prisma.learningSpace.findMany
  let query: unknown
  try {
    prisma.learningSpace.findMany = (async (args: unknown) => { query = args; return [] }) as typeof original
    await findListingSpaces('user-a')
  } finally { prisma.learningSpace.findMany = original }
  assert.deepEqual((query as { where: unknown }).where, { members: { some: { userId: 'user-a', status: 'ACTIVE' } } })
  const source = readFileSync('src/lib/learning-space-listing.ts', 'utf8')
  assert.match(source, /some: \{ userId, status: 'ACTIVE' \}/)
  assert.match(source, /status: 'ACTIVE', userId: \{ not: userId \}/)
  assert.doesNotMatch(source, /storageKey|token|notes|submissions/)
})
test('listing states, navigation, responsive wrapping and focus are rendered', () => {
  const render = (status: 'ready' | 'loading' | 'error', spaces = records) => renderToStaticMarkup(createElement(MySpacesView, { status, spaces, retry: () => {} }))
  const html = render('ready', [{ ...records[0], title: 'Học tiếng Việt '.repeat(100) }, records[1]])
  for (const pattern of [/href="\/learning\/a"/, /href="\/learning\/b"/, /Đang hoạt động/, /Đã lưu trữ · Chỉ xem/, /Bạn học: Bình/, /break-words/, /sm:grid-cols-2/, /focus-visible:ring-2/]) assert.match(html, pattern)
  assert.match(render('ready', []), /href="\/learning\/new"/)
  assert.match(render('loading'), /Đang tải không gian/)
  assert.match(render('error'), /Thử lại/)
  const dashboard = readFileSync('src/app/dashboard/page.tsx', 'utf8')
  assert.match(dashboard, /href="\/learning\/new"/)
  assert.match(dashboard, /href="\/learning"/)
  assert.match(readFileSync('src/components/learning/LearningSpaceShell.tsx', 'utf8'), /href="\/learning"/)
})

