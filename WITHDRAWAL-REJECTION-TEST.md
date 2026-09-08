# Manual test — rejected withdrawal refund

## Automated pre-merge

```powershell
node node_modules/prisma/build/index.js validate
npm run db:generate
node scripts/test-withdrawal-rejection.cjs
node scripts/test-skill-approval.cjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
git diff --check
```

## Staging UI test

1. Login as admin and open `/admin/finance`.
2. Locate pending request `2f1b2989-7563-4081-8a40-8399d41c73ef` (1 point).
3. Record request status and mentor wallet balance (baseline: PENDING, 99).
4. Click Reject once.
5. Expected UI: immediate success message states 1 GivePoint was returned; request becomes REJECTED.
6. Open the mentor wallet/history. Expected balance: 100. Expected one positive entry labelled “Hoàn điểm do yêu cầu rút tiền bị từ chối”, amount +1.
7. Refresh/reopen admin finance. No refund button/manual step exists for this request.
8. Attempting the same server action again must return already processed and leave balance 100 with one refund ledger row.

## Atomic failure test

Covered offline by `scripts/test-withdrawal-rejection.cjs`: forced ledger failure leaves status PENDING, balance unchanged and no ledger row. Do not break the staging database or credentials to reproduce this manually.

## Release gates

- Migration 003 applied before new code starts.
- One real staging UI rejection passes.
- Repeated-action/idempotency result passes.
- Mentor history displays the refund clearly.
- Existing approve flow remains status-only with no extra points/ledger.
- Audit old REJECTED requests before production; do not bulk refund without evidence.
