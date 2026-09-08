# Withdrawal rejection atomic refund — changelog

## Rule implemented

When an admin rejects a PENDING withdrawal, one Prisma interactive transaction:

1. conditionally changes the request from PENDING to REJECTED;
2. credits the full `pointsRequested` amount to the mentor;
3. writes one positive SUCCESS ledger row of type `REFUND_WITHDRAWAL_REJECTED`.

There is no separate/manual refund action and no waiting period.

## Safety properties

- Admin authorization is checked before reading or mutating the request.
- `updateMany({ id, status: PENDING })` is the concurrency/idempotency gate. A second admin/retry cannot refund twice.
- Invalid non-positive `pointsRequested` aborts without credit.
- Any wallet or ledger failure rolls the whole transaction back, including the REJECTED status.
- Approval remains status-only because points were already debited when the request was created.
- Cache refresh runs after commit and cannot turn a committed refund into a misleading failure result.
- Ledger amount is positive and referenceId is `withdrawal-rejection:<requestId>`.

## Files changed

- `prisma/schema.prisma`: adds transaction type `REFUND_WITHDRAWAL_REJECTED`.
- `prisma/migrations-manual/003_withdrawal_rejection_atomic_refund.sql`: additive enum migration.
- `src/actions/admin-finance.ts`: authorization and atomic reject/refund/ledger transaction.
- `src/components/admin/WithdrawActionButtons.tsx`: successful rejection is presented as a successful refund using the server result message.
- `src/app/history/page.tsx`: Vietnamese label/color for the refund ledger.
- `src/app/admin/layout.tsx`: adds the missing “Rút tiền” sidebar entry to `/admin/finance`.
- `src/app/admin/page.tsx`: adds pending-withdrawal statistics and a finance quick action.
- `src/actions/admin.ts`: admin dashboard stats now include the PENDING withdrawal count.
- `scripts/test-withdrawal-rejection.cjs`: offline rollback/idempotency/auth/approval regression tests.
- `WITHDRAWAL-REJECTION-TEST.md`: staging and release test script.

## Verification performed

- Prisma schema validate: PASS.
- Prisma Client generation: PASS.
- Atomic withdrawal rejection test: PASS.
- BR-11 regression suite: all three groups PASS.
- TypeScript no-emit: PASS.
- ESLint for changed finance action/component: PASS.
- git diff check: PASS (line-ending warnings only).
- Staging migration 003: APPLIED successfully.
- Post-migration enum verification: PASS.
- Admin finance navigation/dashboard visibility fix: TypeScript, ESLint and both regression suites PASS.
- No withdrawal was processed during migration.

## Staging manual-test baseline

- Request: `2f1b2989-7563-4081-8a40-8399d41c73ef`
- Status: PENDING
- Points requested: 1
- Mentor balance: 99
- Matching rejection-refund ledger rows: 0

Expected after one rejection: REJECTED, balance 100, exactly one +1 refund ledger. A repeated action must not change balance or ledger count.

## Production note

Migration 003 must run before deploying the code. Audit historical REJECTED requests separately before production rollout; this change does not guess whether old rejected requests were already refunded manually.
