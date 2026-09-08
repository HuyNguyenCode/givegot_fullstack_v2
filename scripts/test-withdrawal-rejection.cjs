// Offline regression tests for atomic withdrawal rejection refunds.
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
    module, exports: module.exports,
    require: id => {
      if (!(id in mocks)) throw Error('Unexpected dependency: ' + id)
      return mocks[id]
    },
    console: { log() {}, error() {}, warn() {} },
  }, { filename: file })
  return module.exports
}

async function main() {
  let admin = true
  let request
  let balance
  let logs
  let failLedger = false
  let revalidations = []

  function reset(status = 'PENDING', points = 7) {
    request = { id: 'w1', mentorId: 'u1', pointsRequested: points, status }
    balance = 10
    logs = []
    failLedger = false
    revalidations = []
  }

  const tx = {
    withdrawRequest: {
      findUnique: async ({ where }) => where.id === request?.id ? { ...request } : null,
      updateMany: async ({ where, data }) => {
        if (!request || request.id !== where.id || request.status !== where.status) return { count: 0 }
        request.status = data.status
        return { count: 1 }
      },
    },
    user: {
      update: async ({ where, data }) => {
        assert.equal(where.id, request.mentorId)
        balance += data.givePoints.increment
      },
    },
    transactionLog: {
      create: async ({ data }) => {
        if (failLedger) throw Error('ledger unavailable')
        logs.push({ ...data })
      },
    },
  }
  const db = {
    ...tx,
    $transaction: async fn => {
      const before = { request: { ...request }, balance, logs: logs.map(x => ({ ...x })) }
      try {
        return await fn(tx)
      } catch (error) {
        request = before.request
        balance = before.balance
        logs = before.logs
        throw error
      }
    },
  }
  const actions = load('src/actions/admin-finance.ts', {
    '@/lib/prisma': { prisma: db },
    'next/cache': { revalidatePath: path => revalidations.push(path) },
    '@/lib/admin': { isAdmin: async () => admin },
  })

  // Reject: all three writes occur and the ledger is explicit/positive.
  reset()
  const rejected = await actions.updateWithdrawStatus('w1', 'REJECTED')
  assert.equal(rejected.success, true)
  assert.equal(request.status, 'REJECTED')
  assert.equal(balance, 17)
  assert.equal(logs.length, 1)
  assert.deepEqual(logs[0], {
    userId: 'u1', amount: 7, type: 'REFUND_WITHDRAWAL_REJECTED',
    status: 'SUCCESS', referenceId: 'withdrawal-rejection:w1',
  })
  assert.deepEqual(revalidations, ['/admin/finance', '/profile', '/history'])

  // Idempotency: retry cannot refund or write a second ledger row.
  const duplicate = await actions.updateWithdrawStatus('w1', 'REJECTED')
  assert.equal(duplicate.success, false)
  assert.equal(balance, 17)
  assert.equal(logs.length, 1)

  // Atomic rollback: a ledger failure rolls status and wallet balance back.
  reset(); failLedger = true
  const failed = await actions.updateWithdrawStatus('w1', 'REJECTED')
  assert.equal(failed.success, false)
  assert.equal(request.status, 'PENDING')
  assert.equal(balance, 10)
  assert.equal(logs.length, 0)

  // Approval remains status-only: points were frozen at request creation.
  reset()
  const approved = await actions.updateWithdrawStatus('w1', 'APPROVED')
  assert.equal(approved.success, true)
  assert.equal(request.status, 'APPROVED')
  assert.equal(balance, 10)
  assert.equal(logs.length, 0)

  // Non-admin calls cannot read/mutate the request.
  reset(); admin = false
  const unauthorized = await actions.updateWithdrawStatus('w1', 'REJECTED')
  assert.equal(unauthorized.success, false)
  assert.equal(request.status, 'PENDING')
  assert.equal(balance, 10)
  assert.equal(logs.length, 0)
  admin = true

  // Corrupt/non-positive amounts never credit the wallet.
  reset('PENDING', 0)
  const invalid = await actions.updateWithdrawStatus('w1', 'REJECTED')
  assert.equal(invalid.success, false)
  assert.equal(request.status, 'PENDING')
  assert.equal(balance, 10)
  assert.equal(logs.length, 0)

  console.log('PASS: atomic reject refund, immutable ledger, rollback, idempotency, approval isolation and admin authorization.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
