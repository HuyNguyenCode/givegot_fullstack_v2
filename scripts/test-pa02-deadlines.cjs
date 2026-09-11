// Offline regression tests for PA-02 review/no-show deadlines and auto-complete UX.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, mocks, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: id => {
      if (!(id in mocks)) throw Error('Unexpected dependency: ' + id)
      return mocks[id]
    },
    console: { log() {}, error() {}, warn() {} },
    process: { env: { NODE_ENV: 'test' } },
    ...globals,
  }, { filename: file })
  return module.exports
}

async function main() {
  const HOUR = 60 * 60 * 1000
  const fixedNow = new Date('2026-09-09T12:00:00.000Z')
  class FixedDate extends Date {
    constructor(value) {
      super(value === undefined ? fixedNow.getTime() : value)
    }
    static now() { return fixedNow.getTime() }
  }

  const createdNotifications = []
  let deadlineBooking = {
    id: 'booking-deadline',
    endTime: new Date(fixedNow.getTime() - 24.5 * HOUR),
    mentorId: 'mentor',
    menteeId: 'mentee',
    mentor: { name: 'Mentor', email: 'mentor@example.test' },
    mentee: { name: 'Mentee', email: 'mentee@example.test' },
  }
  const deadlineDb = {
    booking: { findMany: async () => [deadlineBooking] },
    notification: {
      findFirst: async ({ where }) => createdNotifications.find(item =>
        item.userId === where.userId && item.title === where.title && item.link === where.link
      ) || null,
      create: async ({ data }) => {
        createdNotifications.push({ id: String(createdNotifications.length + 1), ...data })
        return data
      },
    },
  }
  const response = {
    json: (body, init = {}) => ({ body, status: init.status || 200 }),
  }
  const deadlineRoute = load('src/app/api/cron/review-deadlines/route.ts', {
    'next/server': { NextResponse: response },
    '@/lib/prisma': { prisma: deadlineDb },
  }, { Date: FixedDate })

  assert.equal(deadlineRoute.getReviewDeadlineMilestone(new Date(fixedNow - 23.9 * HOUR), fixedNow), null)
  assert.equal(deadlineRoute.getReviewDeadlineMilestone(new Date(fixedNow - 24 * HOUR), fixedNow), '24H_LEFT')
  assert.equal(deadlineRoute.getReviewDeadlineMilestone(new Date(fixedNow - 46 * HOUR), fixedNow), '2H_LEFT')
  assert.equal(deadlineRoute.getReviewDeadlineMilestone(new Date(fixedNow - 48 * HOUR), fixedNow), 'OVERDUE')
  assert.equal(deadlineRoute.getReviewDeadlineMilestone(new Date(fixedNow - 72 * HOUR), fixedNow), null)

  const req = { headers: { get: () => null } }
  let result = await deadlineRoute.GET(req)
  assert.equal(result.body.sent, 2)
  assert.equal(createdNotifications.length, 2)
  result = await deadlineRoute.GET(req)
  assert.equal(result.body.sent, 0)
  assert.equal(createdNotifications.length, 2, 'deadline notifications must be idempotent')

  deadlineBooking = { ...deadlineBooking, endTime: new Date(fixedNow.getTime() - 46.5 * HOUR) }
  await deadlineRoute.GET(req)
  assert.equal(createdNotifications.length, 4)
  deadlineBooking = { ...deadlineBooking, endTime: new Date(fixedNow.getTime() - 48.5 * HOUR) }
  await deadlineRoute.GET(req)
  assert.equal(createdNotifications.length, 6)

  const autoNotifications = []
  const transactionCalls = []
  const autoBooking = {
    id: 'booking-auto',
    mentorId: 'mentor',
    menteeId: 'mentee',
    mentor: { name: 'Mentor', email: 'mentor@example.test' },
    mentee: { name: 'Mentee', email: 'mentee@example.test' },
  }
  const autoDb = {
    booking: { findMany: async () => [autoBooking] },
    $transaction: async callback => callback({
      booking: {
        updateMany: async input => {
          transactionCalls.push(['booking', input])
          return { count: 1 }
        },
      },
      user: { update: async input => transactionCalls.push(['user', input]) },
      transactionLog: { create: async input => transactionCalls.push(['log', input]) },
    }),
  }
  const autoRoute = load('src/app/api/cron/auto-complete/route.ts', {
    'next/server': { NextResponse: response },
    '@/lib/prisma': { prisma: autoDb },
    '@/actions/notifications': {
      createNotification: async (...args) => autoNotifications.push(args),
    },
  }, { Date: FixedDate })
  result = await autoRoute.GET({})
  assert.equal(result.body.processed, 1)
  assert.equal(transactionCalls.filter(call => call[0] === 'booking').length, 1)
  assert.equal(transactionCalls.filter(call => call[0] === 'user').length, 1)
  assert.equal(transactionCalls.filter(call => call[0] === 'log').length, 1)
  assert.equal(autoNotifications.length, 2)

  autoDb.$transaction = async callback => callback({
    booking: {
      updateMany: async input => {
        transactionCalls.push(['booking-skipped', input])
        return { count: 0 }
      },
    },
    user: { update: async input => transactionCalls.push(['user-skipped', input]) },
    transactionLog: { create: async input => transactionCalls.push(['log-skipped', input]) },
  })
  result = await autoRoute.GET({})
  assert.equal(result.body.processed, 0)
  assert.equal(transactionCalls.filter(call => call[0] === 'booking-skipped').length, 1)
  assert.equal(transactionCalls.filter(call => call[0] === 'user-skipped').length, 0)
  assert.equal(transactionCalls.filter(call => call[0] === 'log-skipped').length, 0)
  assert.equal(autoNotifications.length, 2, 'a booking claimed elsewhere must not notify again')

  const actionSource = fs.readFileSync('src/actions/booking.ts', 'utf8')
  assert.match(actionSource, /mentorMinutes < ATTENDANCE_MIN_MINUTES/)
  assert.match(actionSource, /latestMentor\.trustScore - 20/)
  assert.match(actionSource, /latestMentee\.trustScore - 30/)
  assert.match(actionSource, /status: 'DISPUTED'/)

  const modalSource = fs.readFileSync('src/components/NoShowImpactDialog.tsx', 'utf8')
  assert.match(modalSource, /MENTOR_NO_SHOW/)
  assert.match(modalSource, /FRAUD_DETECTED/)
  assert.match(modalSource, /DISPUTED/)
  assert.match(modalSource, /reportNoShow/)

  const timelineSource = fs.readFileSync('src/components/SessionPolicyTimeline.tsx', 'utf8')
  assert.match(timelineSource, /REVIEW_DEADLINE_HOURS = 48/)
  assert.match(timelineSource, /AUTO_COMPLETE_HOURS = 72/)
  assert.match(timelineSource, /GivePoint/)

  const autoSource = fs.readFileSync('src/app/api/cron/auto-complete/route.ts', 'utf8')
  assert.match(autoSource, /status: 'CONFIRMED'/)
  assert.match(autoSource, /claim\.count !== 1/)

  const sessionSource = fs.readFileSync('src/components/SessionDetailDialog.tsx', 'utf8')
  const unifiedSource = fs.readFileSync('src/components/UnifiedDashboardCalendar.tsx', 'utf8')
  assert.match(sessionSource, /NoShowImpactDialog/)
  assert.match(sessionSource, /SessionPolicyTimeline/)
  assert.match(unifiedSource, /NoShowImpactDialog/)
  assert.match(unifiedSource, /SessionPolicyTimeline/)
  assert.doesNotMatch(sessionSource, /Báo cáo vắng mặt\? Hệ thống sẽ xác minh/)
  assert.doesNotMatch(unifiedSource, /Báo cáo vắng mặt\? Việc tham gia sẽ được xác minh/)

  const cronConfig = JSON.parse(fs.readFileSync('vercel.json', 'utf8'))
  assert.ok(cronConfig.crons.some(cron =>
    cron.path === '/api/cron/review-deadlines' && cron.schedule === '0 * * * *'
  ))

  console.log('PASS: PA-02 timeline, no-show disclosure, 24h/2h/overdue dedupe, and auto-complete notifications.')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
