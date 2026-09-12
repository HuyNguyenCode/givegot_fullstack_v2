# Learning Hub Engineering Runbook

## Start a task

1. Read `MASTER_SPEC.md`, `CONTEXT_PACKET.md`, `ARCHITECTURE_DECISIONS.md`, and `IMPLEMENTATION_STATE.md` plus relevant test/regression/risk rows.
2. Run `git status --short --untracked-files=all`; treat all pre-existing changes as user-owned.
3. Confirm the prior dependency task reached an accepted checkpoint.
4. State affected files, invariants, data/API/visible behavior, rollback, and test plan before editing.
5. Work only on the named task. Do not continue to the next task after completion.

## Task Completion Contract

1. Check every requirement and acceptance criterion one by one.
2. Show files changed and why.
3. Report schema, migration, API, and visible behavior changes.
4. Report compatibility and rollback impact.
5. Run task tests and required regression checks.
6. Separate pre-existing failures from task-introduced failures.
7. Do not mark PASS while a required task test fails.
8. Update implementation state, context, test matrix, and changelog; update ADR/risk when needed.
9. Record exact assumptions the next task may rely on.
10. End with `TASK STATUS: PASS`, `PASS WITH KNOWN LIMITATION`, or `BLOCKED`, then stop.

## Baseline and test ladder

Current Task 00 commands:

```text
npm run db:generate
npx prisma validate
npm run lint
npx tsc --noEmit
npm run build
node scripts/test-cancellation-preview.cjs
node scripts/test-pa02-deadlines.cjs
node scripts/test-quiz-publication.cjs
node scripts/test-skill-approval.cjs
node scripts/test-withdrawal-rejection.cjs
```

Task 01 must add canonical package scripts for typecheck, Learning Hub unit/integration, and regression suites. Run `npm ci` only at a clean-install gate. Database-writing tests require an explicit disposable database and must never use production or print secrets.

Failure protocol:

- Capture command, exit code, assertion/error, and fixture.
- Compare with Task 00 baseline.
- Fix task-introduced failures in scope or report BLOCKED.
- Keep pre-existing failures visible; never skip, weaken, or exclude tests merely to pass.
- Run targeted coverage before the broader gate.

## Identity and authorization

- Resolve actor from `auth()` once in server code; reject absent/suspended sessions as policy requires.
- Treat any client `userId`, `senderId`, `viewerId`, mentor ID, or learner ID as untrusted target data.
- Load the target object and verify participant/membership plus action-specific role.
- Authorize metadata before returning it, not only content/download URLs.
- Use narrowly scoped admin permission with actor, reason, entity, and timestamp audit.
- Test unauthenticated, spoofed actor, non-member, wrong role, archived member, and valid member.

## Migration procedure

- Do not use `prisma db push` for a shared Learning Hub migration.
- Back up and inspect representative legacy rows before DDL.
- Use additive tables/enums/indexes and nullable Booking fields.
- Avoid hard pair-plus-skill uniqueness.
- Backfill only unambiguous rows; leave `learningSpaceId` null otherwise.
- Validate on a clean disposable DB and a representative legacy copy.
- Run Prisma generate/validate, migration tests, legacy dashboard/history tests, and rollback rehearsal.
- Stop if Prisma generation remains blocked or rollback cannot be described and exercised.

## Settlement procedure

- State the ledger invariant before editing: every eligible settlement credits once and has one auditable TransactionLog; retries change nothing.
- Verify mode checklist, `deliveredAt`, acceptance/review window, and dispute state.
- Claim eligibility with a conditional update inside the transaction.
- Update lifecycle and ledger atomically; send notification/realtime after commit.
- Test double click, parallel requests, parallel cron, dispute, revision, provider failure, transaction rollback, and reconciliation.
- Never reuse the current `CONFIRMED + endTime after 72h` query for Exercise Review or Hybrid.

## Storage procedure

- Authenticate and authorize space membership before issuing a token or URL.
- Use private bucket, random scoped key, short TTL, MIME/extension/size/quota allowlist.
- Upload directly from browser; finalize only after verifying provider metadata.
- Store `storageKey`, never a signed URL; soft delete metadata then purge idempotently.
- Never expose service-role credentials in `NEXT_PUBLIC_` or logs.
- Do not server-fetch arbitrary external URLs in P0.

## Cron and realtime procedure

- Production cron requires `CRON_SECRET`; reject missing and invalid values.
- Keep cron batches bounded, deterministic, retry-safe, and observable without private payloads.
- Use private/authorized Pusher channels for conversations and learning activity.
- Test unauthorized subscription, forged channel/object ID, replay, and provider failure.

## Operational triage

### Stuck fulfillment

Inspect BookingStatus, FulfillmentStatus, mode checklist, last activity, dispute, delivered/accepted times, and ledger. Do not force-credit manually without an audited admin resolution. Re-run an idempotent transition only after identifying the failed boundary.

### Ledger mismatch

Freeze automated settlement for affected records, compare Booking/fulfillment transitions to TransactionLog and balances, preserve evidence, and use an approved compensating transaction. Never edit or delete ledger history.

### Orphan upload

Confirm no READY resource references the storage key, observe retention/quarantine policy, then use an idempotent purge job. Do not infer authorization from the object key alone.

### Provider failure

Determine whether domain commit occurred. Retry notification/provider work without replaying the domain mutation. Record provider event/request ID without secrets or private content.

### Prisma generate EPERM

The Task 00 failure indicates a Windows process holds the query-engine DLL. Identify/release the lock before a schema task, rerun generation, and record the result. Do not delete broad directories or claim a generated client is current while generation fails.

## Task 00 rollback

Task 00 changes documentation only. Remove only the ten new Markdown files if rollback is required. Do not restore, delete, move, or stage the four pre-existing DOCX dirty-state entries.
