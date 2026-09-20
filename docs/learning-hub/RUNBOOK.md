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

Task 00 baseline commands:

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

Task 01 added the canonical package scripts for typecheck, Learning Hub unit/integration, and regression suites. Run `npm ci` only at a clean-install gate. Database-writing tests require an explicit disposable database and must never use production or print secrets.

Failure protocol:

- Capture command, exit code, assertion/error, and fixture.
- Compare with the applicable classified baseline: 77 errors/32 warnings for unrelated legacy debt and 151 errors/34 warnings for the current full repository until the required isolated B2/C1 lint repair completes.
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
- Archived-space storage reads require an ACTIVE member of that archived space; archived spaces reject storage mutations.
- F2 and later code must use the storage-service abstraction, never direct AWS SDK/S3 behavior.
- Never expose service-role credentials in `NEXT_PUBLIC_` or logs.
- Do not server-fetch arbitrary external URLs in P0.

### F1 S3 setup and lifecycle

- Deploy `infra/learning-storage.yaml` with a unique bucket name and the app's exact HTTPS origin. It blocks all four forms of public access, encrypts objects, retains the bucket on stack deletion, permits the browser's signed POST through CORS, and expires `pending/` objects after one day. Keep the bucket private; the API checks its four bucket-level public-access blocks before issuing credentials.
- Set server-only `LEARNING_STORAGE_BUCKET` and `AWS_REGION`, and give the server an IAM role or server-only AWS credentials with `s3:GetBucketPublicAccessBlock`, `s3:ListBucket`, and `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject` on this bucket's objects. No AWS key belongs in a `NEXT_PUBLIC_` variable or browser request. `s3:ListBucket` lets a missing object return a distinguishable 404 during finalize.
- The signed POST lasts five minutes and binds one random `pending/spaces/{spaceId}/resources/{resourceId}/{uuid}.{ext}` key, exact MIME, and a maximum byte count. The browser submits the returned fields plus the file directly to S3, with the file part last, then calls finalize. The API accepts only PDF, JPEG, PNG, TXT, and Markdown, up to 20 MiB per file and 500 MiB reserved plus ready bytes per space. Office files wait for malware scanning.
- Finalize uses S3 HEAD metadata, checks exact reserved MIME and byte count, copies the object to `spaces/{spaceId}/resources/{resourceId}/{uuid}.{ext}`, then checks the promoted object's metadata and PDF/JPEG/PNG signature or UTF-8 text prefix before conditionally marking READY. This staging copy means reuse of the signed POST cannot overwrite the downloadable object. A mismatched upload becomes QUARANTINED. A missing object remains PENDING until cleanup. Provider or database failure leaves it non-downloadable and eligible for retry or cleanup.
- Downloads require a fresh server session and ACTIVE membership in the target space. An archived space remains readable only to its ACTIVE members. The at-most-ten-minute URL forces an attachment response with `application/octet-stream`; it is never persisted or logged. A soft delete immediately prevents new URLs and attempts to remove both final and staging copies. An already issued URL is an accepted bearer capability until its at-most-ten-minute expiry if provider deletion fails.
- Vercel calls `/api/cron/learning-storage-cleanup` at minute 15 of each hour using `CRON_SECRET`. The bounded, idempotent job claims PENDING or QUARANTINED rows older than 15 minutes, removes both possible object keys, and retries any DELETED row whose storage key has not been cleared. S3's one-day `pending/` lifecycle is a backstop for a process crash or failed staging removal. Check the cron response and investigate repeated provider failures without logging keys, URLs, filenames, or file contents.
- F1 adds file-boundary APIs only: `POST /api/learning/spaces/{spaceId}/files` accepts `fileName`, `mimeType`, `sizeBytes`; `POST .../{resourceId}/finalize` verifies and promotes; `POST .../{resourceId}/download` returns a signed URL; `DELETE .../{resourceId}` soft-deletes. F2 owns the resource list/detail UI and external links. No server-side arbitrary URL fetch is used.

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
