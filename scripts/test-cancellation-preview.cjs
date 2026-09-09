// Offline regression tests for PA-01 cancellation-policy preview.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, mocks) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    Date: mocks.__Date || Date,
    require: id => {
      if (!(id in mocks)) throw Error('Unexpected dependency: ' + id)
      return mocks[id]
    },
    console: { log() {}, error() {}, warn() {} },
  }, { filename: file })
  return module.exports
}

async function main() {
  const enums = require('@prisma/client')
  let booking = null
  let receiptTransactions = []
  let receiptTrustRecord = null
  let actionNow = Date.now()
  let advanceClockDuringTransaction = false
  class ActionDate extends Date {
    static now() { return actionNow }
  }
  const transactionDb = {
    booking: {
      update: async () => {
        if (advanceClockDuringTransaction) actionNow += 25
        return {}
      },
    },
    availableSlot: { update: async () => ({}), delete: async () => ({}) },
    user: {
      findUnique: async ({ where }) => ({
        trustScore: where.id === booking.menteeId ? booking.mentee.trustScore : booking.mentor.trustScore,
      }),
      update: async () => ({}),
    },
    transactionLog: { create: async () => ({}) },
    trustHistory: { create: async () => ({}) },
  }
  const db = {
    booking: {
      findUnique: async ({ where }) => booking?.id === where.id ? booking : null,
    },
    transactionLog: {
      findMany: async () => receiptTransactions,
    },
    trustHistory: {
      findFirst: async () => receiptTrustRecord,
    },
    $transaction: async callback => callback(transactionDb),
  }
  const actions = load('src/actions/booking.ts', {
    __Date: ActionDate,
    '@prisma/client': enums,
    '@/lib/prisma': { prisma: db },
    '@/lib/pusher': { pusherServer: { trigger: async () => {} } },
    'next/cache': { revalidatePath() {} },
    './notifications': { createNotification: async () => {} },
    '@/lib/trust-algorithm': { calculateAndUpdateTrustScore: async () => {} },
    '@/lib/google-meet': { verifyMeetingAttendance: async () => ({}) },
    '@/lib/gcal': { createGoogleMeetForMentor: async () => null },
    '@/lib/email': { sendEmail: async () => {}, getAppUrl: () => 'http://test', formatEmailDateTime: () => '' },
    '@/emails/BookingRequestedEmail': { default: () => null },
    '@/emails/BookingConfirmedEmail': { default: () => null },
    '@/emails/BookingCancelledEmail': { default: () => null },
    '@/emails/NoShowReportEmail': { default: () => null },
    '@/emails/NewBookingEmail': { default: () => null },
  })

  const makeBooking = ({ status = enums.BookingStatus.CONFIRMED, hours = 24, menteeTrust = 36, mentorTrust = 60 } = {}) => ({
    id: 'booking-12345678',
    mentorId: 'mentor', menteeId: 'mentee', status,
    startTime: new Date(Date.now() + hours * 60 * 60 * 1000),
    mentor: { trustScore: mentorTrust }, mentee: { trustScore: menteeTrust },
  })

  booking = makeBooking({ status: enums.BookingStatus.PENDING })
  let result = await actions.getCancellationPreview(booking.id, 'mentee')
  assert.equal(result.success, true)
  assert.equal(result.preview.timing, 'pending')
  assert.equal(result.preview.givePointRecipient, 'mentee')
  assert.equal(result.preview.trust, null)

  // Slightly over 12h avoids a wall-clock millisecond race in an offline test.
  booking = makeBooking({ hours: 12.01, menteeTrust: 36 })
  result = await actions.getCancellationPreview(booking.id, 'mentee')
  assert.equal(result.preview.timing, 'early')
  assert.equal(result.preview.givePointRecipient, 'mentee')
  assert.deepEqual(JSON.parse(JSON.stringify(result.preview.trust)), { previousScore: 36, newScore: 34, delta: -2, willSuspend: false })

  booking = makeBooking({ hours: 8.5, menteeTrust: 36 })
  result = await actions.getCancellationPreview(booking.id, 'mentee')
  assert.equal(result.preview.timing, 'late')
  assert.equal(result.preview.givePointRecipient, 'mentor')
  assert.deepEqual(JSON.parse(JSON.stringify(result.preview.trust)), { previousScore: 36, newScore: 26, delta: -10, willSuspend: true })

  booking = makeBooking({ hours: 24, mentorTrust: 60 })
  result = await actions.getCancellationPreview(booking.id, 'mentor')
  assert.equal(result.preview.timing, 'early')
  assert.equal(result.preview.givePointRecipient, 'mentee')
  assert.equal(result.preview.trust.delta, -5)
  assert.equal(result.preview.trust.newScore, 55)

  booking = makeBooking({ hours: 1, mentorTrust: 45 })
  result = await actions.getCancellationPreview(booking.id, 'mentor')
  assert.equal(result.preview.timing, 'late')
  assert.equal(result.preview.givePointRecipient, 'mentee')
  assert.deepEqual(JSON.parse(JSON.stringify(result.preview.trust)), { previousScore: 45, newScore: 25, delta: -20, willSuspend: true })

  // The post-commit receipt must reflect the actual transaction outcome, not
  // merely the pre-action preview used by the modal.
  booking = {
    ...makeBooking({ hours: 8.5, menteeTrust: 36 }),
    slotId: null,
    mentor: { id: 'mentor', name: 'Mentor', email: 'mentor@example.test', trustScore: 60 },
    mentee: { id: 'mentee', name: 'Mentee', email: 'mentee@example.test', trustScore: 36 },
  }
  const cancellation = await actions.cancelBooking(booking.id, 'mentee')
  assert.equal(cancellation.success, true)
  assert.equal(cancellation.cancellation.timing, 'late')
  assert.equal(cancellation.cancellation.givePointRecipient, 'mentor')
  assert.deepEqual(JSON.parse(JSON.stringify(cancellation.cancellation.trust)), { previousScore: 36, newScore: 26, delta: -10, willSuspend: true })

  // Cross the 12-hour line *during* the transaction. The committed receipt
  // must retain the transaction's EARLY result rather than recalculate LATE
  // from a second wall-clock read after commit.
  actionNow = Date.now()
  advanceClockDuringTransaction = true
  booking = {
    ...makeBooking({ hours: 24, menteeTrust: 36 }),
    startTime: new Date(actionNow + 12 * 60 * 60 * 1000 + 10),
    slotId: null,
    mentor: { id: 'mentor', name: 'Mentor', email: 'mentor@example.test', trustScore: 60 },
    mentee: { id: 'mentee', name: 'Mentee', email: 'mentee@example.test', trustScore: 36 },
  }
  const boundaryCancellation = await actions.cancelBooking(booking.id, 'mentee')
  advanceClockDuringTransaction = false
  assert.equal(boundaryCancellation.success, true)
  assert.equal(boundaryCancellation.cancellation.timing, 'early')
  assert.equal(boundaryCancellation.cancellation.givePointRecipient, 'mentee')
  assert.deepEqual(JSON.parse(JSON.stringify(boundaryCancellation.cancellation.trust)), { previousScore: 36, newScore: 34, delta: -2, willSuspend: false })

  // A cancelled item reopened from either calendar must reconstruct its result
  // from the immutable ledger and Trust history, without another mutation.
  booking = makeBooking({ status: enums.BookingStatus.CANCELLED })
  receiptTransactions = [{
    type: enums.TransactionType.CANCELLATION_COMPENSATION,
    userId: 'mentor',
    amount: 1,
    createdAt: new Date(),
  }]
  receiptTrustRecord = {
    userId: 'mentee',
    previousScore: 36,
    newScore: 26,
    reason: 'Late cancellation by mentee (<12h notice) for booking booking-12345678',
  }
  let receiptResult = await actions.getBookingCancellationReceipt(booking.id, 'mentee')
  assert.equal(receiptResult.success, true)
  assert.equal(receiptResult.receipt.outcome, 'CANCELLED')
  assert.equal(receiptResult.receipt.givePointRecipient, 'mentor')
  assert.deepEqual(JSON.parse(JSON.stringify(receiptResult.receipt.trust)), { previousScore: 36, newScore: 26, delta: -10, willSuspend: true })

  // BOOKING_CANCELLED records for pending bookings do not historically store
  // their actor. The receipt must be explicit about that uncertainty.
  receiptTransactions = [{
    type: enums.TransactionType.BOOKING_CANCELLED,
    userId: 'mentee',
    amount: 1,
    createdAt: new Date(),
  }]
  receiptTrustRecord = null
  receiptResult = await actions.getBookingCancellationReceipt(booking.id, 'mentor')
  assert.equal(receiptResult.success, true)
  assert.equal(receiptResult.receipt.cancelledBy, 'unknown')

  receiptTransactions = [{
    type: enums.TransactionType.BOOKING_DECLINED,
    userId: 'mentee',
    amount: 1,
    createdAt: new Date(),
  }]
  receiptTrustRecord = null
  receiptResult = await actions.getBookingCancellationReceipt(booking.id, 'mentor')
  assert.equal(receiptResult.success, true)
  assert.equal(receiptResult.receipt.outcome, 'DECLINED')
  assert.equal(receiptResult.receipt.timing, 'pending')
  assert.equal(receiptResult.receipt.givePointRecipient, 'mentee')

  result = await actions.getCancellationPreview(booking.id, 'outsider')
  assert.equal(result.success, false)
  booking = makeBooking({ status: enums.BookingStatus.COMPLETED })
  result = await actions.getCancellationPreview(booking.id, 'mentee')
  assert.equal(result.success, false)

  const dialogSource = fs.readFileSync('src/components/CancellationImpactDialog.tsx', 'utf8')
  assert.match(dialogSource, /getCancellationPreview/)
  assert.match(dialogSource, /result\.cancellation \?\? preview/)
  assert.match(dialogSource, /\/history/)
  assert.ok(
    dialogSource.indexOf('setReceipt(result.cancellation ?? preview)') <
      dialogSource.indexOf('void Promise.resolve(onMutate())'),
    'the receipt must render before the caller refreshes'
  )
  const receiptSource = fs.readFileSync('src/components/CancellationReceiptDetails.tsx', 'utf8')
  assert.match(receiptSource, /getBookingCancellationReceipt/)
  assert.match(receiptSource, /cancelledBy === 'unknown'/)
  assert.match(receiptSource, /\/history/)
  const actionSource = fs.readFileSync('src/actions/booking.ts', 'utf8')
  const postCommitSource = actionSource.slice(actionSource.indexOf('const successMessage'))
  assert.match(postCommitSource, /buildCommittedCancellationImpact/)
  assert.doesNotMatch(postCommitSource, /buildCancellationImpact\(/)

  console.log('PASS: cancellation policy, atomic 12-hour boundary receipt, actor-safe stored receipts, and authorization.')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
