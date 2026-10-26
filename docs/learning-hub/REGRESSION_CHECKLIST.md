# Learning Hub Regression Checklist

Current checkpoint: post-I1 reconciliation (2026-10-26). I1 implementation, disposable PostgreSQL verification, STAGING migration 008, automated gap audit, and owner-reported runtime smoke are complete at distinct evidence levels. I2 is NEXT, NOT STARTED; I3 remains pending.

## I1 owner-reported localhost/STAGING HTTP smoke (2026-10-26)

- HTTP-01: unauthenticated GET redirected to `/auth/signin`; fetch followed it to HTTP 200 HTML without fulfillment JSON. Access control PASS; expected 401 JSON API contract deviation is LOW priority and awaits a client-compatibility/contract decision.
- HTTP-02: authenticated mentor GET 200 JSON and POST START 200 JSON, `IN_PROGRESS`/version 1, for Booking `8650dab9-5008-42bf-9e1a-55f31f935aff` in LearningSpace `e4f0b7cc-5122-44f0-bfe9-7bfbba2996b1`.
- HTTP-03: authenticated learner DELIVER 403 with “Booking role cannot perform this transition”; subsequent GET stayed `IN_PROGRESS`/version 1 on separate test Booking `demo_booking_req_id`. HTTP-04: authenticated nonmember GET 403 with “Active learning space membership required”.
- This is owner-reported browser evidence, not a Codex rerun or Playwright result. Network cookies and GP/ledger after manual START were not inspected. Existing automated and real disposable PostgreSQL evidence remain separate; I2 settlement concurrency and I3 cron/deadline policy are pending.

## Historical H1/LH 050 regression checkpoint (reconciled 2026-10-16)

H1 implementation COMPLETE. Migration 007 passed disposable TEST forward, legacy/default/index/enum checks, safe rollback, unsafe rollback refusal, and cleanup; STAGING forward, schema, and Prisma Notes query checks passed. No PRODUCTION migration. The initial implementation gate passed 123/123 Learning Hub unit, 58/58 integration, five legacy regressions, typecheck, targeted lint, and build. Latest H1-11 repair gate passed 9/9 focused Notes unit, 2/2 route, five legacy regressions, typecheck, targeted lint, and diff check; no newer full-suite run is claimed.

- OWNER-REPORTED manual browser H1-01 through H1-20: 20/20 PASS. H1-09 stale edit recovery, H1-11 archived/deleted-note recovery, and H1-15 network retry were retested PASS; H1-10 soft delete PASS and H1-19 Booking ownership owner-confirmed PASS. This is not independently reproduced or automated, and no browser automation was run.
- The UI calls the existing soft delete “Xóa ghi chú”; the audited row and ADR 019 policy remain. H1-UX-01 and H1-UX-02 are deferred P2 UX items, not H2 blockers. H2/LH 060 is next and NOT STARTED. Booking fulfillment, GivePoint settlement, and cron risks remain open; I1/I2/I3 and J1 remain pending.

## Historical G3 regression checkpoint (reconciled 2026-10-16)

G3 implementation is COMPLETE; real PostgreSQL concurrency VERIFIED and the limitation CLOSED for the controlled R1-R5 schedules below. Actual independent overlapping Prisma/PostgreSQL transactions were confirmed through the established Linux/disposable Supabase TEST path. Detailed run evidence remains in IMPLEMENTATION_STATE, rather than duplicated here. Historical counts and earlier unverified statements below retain their dated scope.

- R1: two simultaneous REVIEWED requests produced one committed decision and competitor 409. R2: REVIEWED versus REVISION_REQUESTED passed both controlled winner orders. R3: duplicate revision requests committed once with the winner's deadline and no duplicate audit.
- R4: stale revision identity returned 409 after actual G2 resubmission, leaving the current revision unchanged. R5: both reachable SUBMITTED and REVISION_REQUESTED boundaries passed; G2 replacement and G3 review cannot both be eligible in the same committed state.
- Database assertions confirmed matching Task/Submission/review state, exact revision/version changes, transaction atomicity, duplicate/stale rejection, and activity event-key deduplication. No partial loser state or unrelated Booking/GP/TransactionLog/Trust/public Review mutation remained. All seven test-owned fixtures were removed and cleanup verified. These seven cases are controlled evidence, not all theoretically possible schedules.
- OWNER-REPORTED MANUAL BROWSER SMOKE: 13/13 PASS — not independently reproduced or automated. G3-M01 through G3-M13 are accepted as reported; M08 checks that the assignee has no review input/actions, while authorized feedback reads and revision-requested resubmission remain available. No separate review page/URL is required; backend authorization has separate automated evidence. No Playwright/E2E run is claimed.
- Evidence types remain separate: historical implementation unit 118/118, integration 56/56, five legacy regressions and typecheck/lint/build/diff gates; focused mock 18/18 rerun; real PostgreSQL seven controlled cases; owner-reported manual 13/13. None was rerun for this documentation task. REVIEWED completes only the task; Booking fulfillment, GP settlement, notification, and cron changes remain outside G3. I1/I2/I3 and J1 remain pending. At this historical G3 checkpoint, H1 was the next safe task (D1 complete), had NOT STARTED, and was not authorized by that task.

## Historical G3 private review boundary (2026-10-15)

G3 changes only task/submission/private-review state and independent task deadline inside a Serializable transaction, with content-free revision audit. G2 current-row/revisionCount and D0e FILE-reference protection remain unchanged. No public Review, Trust, wallet, TransactionLog, notification, Booking/fulfillment, Calendar/Meet, or cron writes are introduced. G3 service/route tests forbid public/financial/notification delegate calls and assert linked Booking fields stay unchanged. The G3-to-G2 revision loop, stale/duplicate/conditional claims, cancellation/dispute guards, active membership/private visibility, and escaped feedback pass. All five offline legacy scripts passed; current complete unit/integration results are 118/118 and 56/56 plus route smoke. Real database G3 races and browser smoke remain unverified; mocked concurrency is not exhaustive schedule evidence. Build/lint/typecheck results are recorded in IMPLEMENTATION_STATE.

## Historical D0e FILE deletion boundary (reconciled 2026-10-14)

F1 FILE delete rejects a current Submission reference in a Serializable transaction and maps serialization conflict to 409. Uploader-only deletion, archived-space write denial, already-deleted idempotence, postcommit provider removal, and provider-failure cleanup retry remain. All three resource purposes are protected; a replaced historical attachment is released. G2 attachment eligibility and transaction, F2 LINK deletion/UI, upload/finalize/download, orphan cleanup, schema, G3, Booking, GP, and settlement remain unchanged. A legacy FILE already marked DELETED is not restored, and a current Submission already referencing an unavailable/deleted legacy FILE remains unavailable. Focused F1 22/22, Learning Hub unit 105/105, integration 53/53, and four controlled real PostgreSQL scenarios passed; those scenarios do not represent every theoretical schedule. The backend independent audit was `PASS WITH FINDINGS` with LOW-only documentation findings and did not rerun the database suite. D0e-UI-001 corrects the known current-Submission conflict presentation; D0e-UI-002 hides and guards FILE deletion in ARCHIVED spaces. Focused UI 19/19, relevant F1/F2 integration 28/28, typecheck, targeted ESLint, and diff check passed. The owner reports M01-M05 PASS. No independent UI re-audit or production build ran. D0e is uncommitted; G3 remains NOT STARTED.

## Historical D0d-F1 boundary and owner smoke (2026-10-13)

D0d-F1 repaired two client-state races by keeping per-task upload/submit lifecycle in the mounted parent. F1/G1/G2 server contracts, resource deletion, Booking, GP, settlement, and cron behavior did not change. The focused 14/14, Learning Hub unit 105/105, relevant integration 24/24, typecheck, targeted ESLint, and diff check passed; F1 did not rerun the production build, while UX2's earlier build PASS remains recorded. The owner reports all D0d browser smoke PASS: sections, selection/pagination, drafts, direct F1/G2, materials separation, picker, mobile, archived reads, G2 blocked-request failure/retry, and private file download. The owner also reports P1-01 upload success after navigation and failure/retry recovery, and P1-02 pending G2 editing lock, task navigation, failure recovery, and retry PASS. These are owner-reported browser results, not independently reproduced automated results. D0e and G3 remain unstarted.

## D0d-UX2 content and file-control boundary (completed 2026-10-10)

The task list/detail presentation now renders G1 title, description, acceptance criteria, optional dueAt, and status through tested view components. The styled file label retains the native file input and existing F1 upload path. G1/G2 server contracts, task order, eight-row pagination, per-task draft retention, current Submission, archive reads, and deletion semantics remain unchanged. Focused render/UI, full Learning Hub unit, relevant integration, typecheck, targeted lint, build, and diff check passed. UX1 owner visual acceptance was rejected; UX2 browser review remains pending. No private/live task records were inspected, and D0e/G3 remain unstarted.

## D0d-UX1 task UX boundary (completed 2026-10-09)

The master/detail layout, mobile list/detail switch, eight-row local pagination, Vietnamese labels, and submission-form feedback are client-only changes. G1 task ordering/data and G2 authorization, state, validation, concurrency, and current-Submission semantics are unchanged. Direct upload still uses the established F1 lifecycle and the finalized READY ID; removing it from an unsent draft performs no resource deletion. Focused UI, complete Learning Hub unit, relevant resource/storage integration, typecheck, targeted ESLint, diff check, and production build passed. Owner manual smoke is pending; D0e and G3 were not started.

## D0d UI and submission boundary (completed 2026-10-09)

The page and Tài liệu refreshes use D0c materials scope; F2 omitted-view compatibility remains unchanged. Material and direct-submission F1 initiation send their explicit supported purposes. Task selection and per-task in-memory drafts affect only client UI; G1/G2 authorization, states, same-space READY FILE eligibility, transaction/idempotency, and F1 lifecycle remain unchanged. The optional picker and current attachment display read D0c READY files independently of materials. Focused UI tests, complete Learning Hub unit suite, relevant resource/storage integration, typecheck, targeted ESLint, diff check, and production build passed. Manual smoke is owner-pending; offline legacy regression scripts were not rerun because shared domain logic did not change. D0e and G3 were not started.

## D0c scoped resource read boundary (completed 2026-10-09)

The F2 collection GET now passes optional `view` to the member-authorized service. Omission preserves all-purpose resource status/order/shape and the existing LearningSpace page caller. Materials and ready-files filters run in the Prisma resource query; quota remains the independent full-space FILE aggregate. Invalid views return 400, and the response still omits purpose, storage keys, and signed URLs. The current client-side topic grouping and five-row group pagination, F2 link write, F1 lifecycle, G2 eligibility, and archived-space read authorization did not change. Focused F2/D0c tests, relevant F1 storage integration, route smoke, typecheck, targeted ESLint, and diff check passed. Full lint, production build, and offline legacy regressions were not rerun for this bounded read change.

## D0b F1 assignment boundary (completed 2026-10-08)

D0b changes only the F1 initiation request type, purpose validation/reservation write, focused storage tests, and repository memory. Server-session/member authorization still precedes validation/provider behavior; the advisory lock, quota aggregate, row reservation, provider signing, finalize, READY/quarantine, cleanup, download, and soft-delete paths retain their prior ordering and behavior. G2 attachment eligibility has no purpose predicate. The focused storage, complete Learning Hub integration, complete Learning Hub unit, typecheck, targeted ESLint, and `git diff --check` passed. Legacy behavior preservation was established through the bounded source diff and relevant Learning Hub tests; the five offline legacy regression scripts were not rerun during D0b. No schema, migration, shared database, real provider, F2 scoped read, UI redesign, deletion protection, G3, Booking, GP, settlement, notification, or cron change was made. At the 2026-10-08 D0b checkpoint, D0c was the next task.

## D0a schema-only boundary (completed 2026-10-07)

The D0a diff changes only the LearningResource schema foundation, migration 006/rollback, focused verifier/tests, and repository memory. Prisma diff parity, validation, typecheck, 21 focused D0a tests after the verifier repair, targeted ESLint, and diff checks passed. The disposable TEST rehearsal passed clean and representative-legacy forward migration, old-writer defaults, explicit classifications, invalid-enum rejection, relationship preservation, classified-row rollback refusal, safe rollback, injected-failure atomicity, and temporary-schema cleanup. D0a was schema-only and did not change F1/F2/G1/G2 or any legacy runtime path, so their historical regression evidence remains valid. D0b may proceed separately as the next task.

## Use

Run the rows affected by a task, then the full applicable gate before a block checkpoint. Preserve legacy behavior for rows without Learning Hub fields. Do not weaken, delete, skip, or snapshot-update an assertion merely to obtain a pass.

| Legacy flow | Invariant to preserve | Sensitive tasks | Minimum evidence |
| --- | --- | --- | --- |
| Authentication | Google/credentials login, session user ID, suspension policy | A1, A2 | Auth tests and protected-route smoke |
| Discover/matching | Semantic search and profile discovery | C2, D1 | Build and targeted UI regression |
| Mentor profile | Public data and Booking CTA | D1, K2 | Profile render/access regression |
| AvailableSlot | A slot cannot be double-booked | E1, I1 | Concurrent Booking test |
| Booking lifecycle | Existing PENDING/CONFIRMED/COMPLETED/CANCELLED/MISSED/DISPUTED meanings | E1, I1, I3 | Transition matrix and legacy fixture |
| Google Calendar | Event creation/update/cancel stays compatible | E1, I3 | Mock provider integration |
| Google Meet | Link creation remains; meeting end is not universal fulfillment | E1, I1 | LIVE and HYBRID tests |
| Cancellation | Refund, compensation, Trust, slot release, receipt | I1, I2, I3 | Cancellation regression script |
| No-show/dispute | Evidence, funds freeze, penalties, admin resolution | I1, I2, I3 | PA-02 and dispute cases |
| Wallet/ledger | Balance equals immutable TransactionLog; no double credit | I2, I3, K2 | Concurrent settlement and reconciliation |
| Public Review | Private SubmissionReview never changes public Review | G3, K2 | Visibility/count regression |
| Trust Score | Private task feedback has no direct Trust effect | G3, K2 | TrustHistory assertion |
| Chat | Authorized participants can list/read/send/realtime | A1, A2, H2 | Route auth and Pusher tests |
| Notifications | Legacy read state, dedupe, and deep links | A2, J1 | Notification regression |
| Admin | Role guard and support access remain narrow/audited | A1, I2, M1 | Admin authorization tests |
| AI quiz/roadmap | Independent of Learning Hub | D1, L1 | Existing offline tests and build |
| Dashboard/history | Legacy Bookings without space still render | B1, K1 | Representative legacy fixture |
| Cron jobs | Secret, batch, retry, deterministic time, idempotency | A2, I3 | Clock and concurrent-cron tests |
| VNPay/top-up/cash-out | Signature, state, balance, refund behavior | I2, N1 | Payment mock and withdrawal script |

## Task F1 storage regression evidence

- F1 changed only new storage routes/services, the private bucket template, package dependencies, and the new cleanup schedule. It did not edit Booking, AvailableSlot, Calendar/Meet, cancellation/no-show/dispute, GP/ledger, public Review/Trust, chat, notification, dashboard/history, or existing cron logic. Old Booking and resource rows remain valid because there is no migration or backfill.
- `npm run test:regression` passed all five offline scripts. The 41-unit and 35-integration Learning Hub suites passed with mocked provider calls, including archived member access, nonmember/unauthenticated denial, deleted resource denial, and cleanup retry. Production build passed with 35 pages and the existing middleware warning.
- Later lint reconciliation classified the historical 151 errors/34 warnings as 77/32 unrelated legacy debt plus 74/2 B2/C1 Learning Hub debt; F1 had zero findings. The isolated B2/C1 lint repair completed before F2. This does not change the recorded F1 regression evidence or its pending production S3 configuration gate.

## Current executable regressions

- `node scripts/test-cancellation-preview.cjs`
- `node scripts/test-pa02-deadlines.cjs`
- `node scripts/test-quiz-publication.cjs`
- `node scripts/test-skill-approval.cjs`
- `node scripts/test-withdrawal-rejection.cjs`

All five passed during Task 00. They are not a Learning Hub suite and do not replace future integration/database coverage.

## Per-task checklist

- Read the master spec, decisions, current state, and relevant test/risk rows.
- Capture `git status --short --untracked-files=all`; list and preserve unrelated/user-owned changes.
- Identify affected legacy rows above before editing.
- For server code, prove identity comes from `auth()` and object authorization is applied.
- For schema work, use clean and representative legacy databases and document rollback before applying shared state.
- For Booking/settlement work, enumerate transitions, cancellation/no-show/dispute interactions, concurrency, and ledger invariants.
- For providers, use mocks; verify signatures/authorization; keep provider failure outside committed domain invariants.
- For UI, cover empty/loading/error/mobile/keyboard/focus/long Vietnamese states.
- Run targeted tests first, then the required T0-T5 gate.
- Record exact command, exit code, and failure classification.
- Review diff for out-of-scope refactors, secrets, identity fields, private payloads, and migration hazards.
- Update state, context, test matrix, changelog, and any changed ADR/risk.

## Failure classification

1. Reproduce with exact command and fixture.
2. Determine whether it existed in Task 00 baseline.
3. A task-introduced required failure blocks PASS and must be fixed in scope or reported BLOCKED.
4. A pre-existing failure remains visible; do not hide it with skip, weaker assertion, or config exclusion.
5. Re-run targeted coverage after a fix; run the full gate when targeted coverage passes.
6. Security, settlement, and migration blockers cannot be waived as ordinary known limitations for tasks that own those gates.

## Task 00 dirty-state guard

The following pre-existing entries are user-owned: two deleted tracked DOCX files under `docs/` and two untracked reference DOCX files under `docs/learning-hub/`, exactly as recorded in `IMPLEMENTATION_STATE.md`. Task 00 may add only the ten requested Markdown files. No application/schema/migration file should appear in its diff.

## Task 01 harness commands

- `npm run test:learning-hub`
- `npm run test:learning-hub:integration`
- `npm run test:regression`

The baseline smoke command is `npm run test:learning-hub:integration`. It imports the legacy conversations, messages, Pusher auth, and cron route modules without starting a server, touching Prisma, or calling external providers. The separate B1 migration command requires `DISPOSABLE_TEST_DATABASE_URL`; neither command prints environment values or secrets.

## Task A1 regression evidence

- Authentication: server-session 401 and database-backed admin USER/suspended/ADMIN cases pass.
- Chat: spoofed list query, nonparticipant open/read-state, session sender/viewer, legitimate participant list/read/send, and Booking-to-chat association pass.
- Booking lifecycle: actor-like Booking/review parameters are replaced by session identity; cancellation and PA-02 scripts pass unchanged.
- Notifications: reads/read-state use session identity; provider-independent internal writes remain best effort; PA-02 passes.
- Admin: action-level guards cover user/report/skill/withdrawal boundaries; skill and withdrawal authorization regressions pass.
- Full legacy regression command passes all five scripts. No database or external provider was used.

## Task A2 regression evidence

- Authentication: unauthenticated Pusher authorization fails with 401; public/unknown channels and guessed IDs are not signed.
- Chat: authorized participants receive a signed private channel and the existing message payload is emitted on `private-conversation-*`.
- Notifications: booking-cancellation realtime retains its event/payload behavior on participant-owned `private-user-*` channels and contains no note, filename, task, resource, or secret field.
- Cron jobs: missing/invalid production credentials stop before database access; a valid secret preserves the current response; the explicit local header is ineffective in production.
- Settlement/business rules: PA-02 selection, 72-hour cutoff, conditional claim, GivePoint credit, ledger write, and post-commit notifications are unchanged and pass.
- Full legacy regression command passes all five scripts. No database or external provider was used.

## Task B1 regression evidence

- Starting worktree was clean. Only B1 schema, migration/rollback, fixtures/verifier, tests, package command, smoke wording, and repository memory files changed.
- Clean path: migration 004 applied to an empty pre-B1 PostgreSQL schema; all ten tables and eight Booking columns were present.
- Legacy path: representative PENDING, CONFIRMED, COMPLETED, CANCELLED, MISSED, and DISPUTED Bookings migrated without row loss or reinterpretation; legacy select/filter queries returned the original notes, meeting links, participants, times, and status order.
- New Booking fields remained null for every legacy row. No migration backfill ran.
- The same pair and primary Skill inserted into two distinct spaces. Membership carried no permanent role and the database imposed no two-active-member cap.
- Archived space/topic rows remained readable, and a free-form topic with no canonical mapping did not create a Skill.
- Rollback removed only B1 objects and retained the original BookingStatus labels; the production rollback note requires export before any rollback after Learning Hub writes.
- Prisma generation/validation, typecheck, Learning Hub tests, all five legacy regressions, and production build passed. Existing auto-complete/settlement, Review/Trust, providers, and UI were untouched.

## Task B2 regression evidence

- LearningSpace routes/services do not alter existing Booking status, cancellation, no-show, ledger, review, chat, notification, provider, dashboard, or cron flows. Old Bookings with null Learning Hub fields remain unchanged; the full five-script legacy regression suite passed.

## Task C1 regression evidence

- Authentication: invite create, accept, and revoke derive actor identity exclusively from the server session. Public preview is bearer-token scoped and exposes no token hash or raw token.
- Pair safety: valid acceptance, expiry, revocation, self acceptance, cross-user replay, same-user replay, concurrent same-user acceptance, third-member reuse, active-space reuse, and same-pair new-space choice have executable coverage.
- Login continuation: the raw token is encrypted in a ten-minute HttpOnly/SameSite=Lax cookie and is consumed/cleared after authenticated acceptance; it is absent from the preview response and cookie plaintext.
- Legacy flows: no Booking, Discover, matching, social graph, notification, email, provider, schema, or migration code changed. All five offline legacy regression scripts passed.

## Historical Task E1 regression evidence

- AvailableSlot concurrency retains the row-level `FOR UPDATE` lock, post-lock `isBooked` check, one Booking create, and slot update in the existing transaction.
- LearningSpace linkage is optional and null-compatible. Linked creation takes the LearningSpace advisory lock and verifies the session actor plus selected mentor are the two active members before deducting the unchanged one GP.
- Calendar/Meet acceptance remains on `createGoogleMeetForMentor` and persists CONFIRMED plus `meetingUrl`; LIVE/HYBRID contracts require Meet evidence while EXERCISE_REVIEW completion ignores `endTime`.
- Existing cancellation, no-show, DISPUTED, wallet/ledger, and cron code remains reachable and unchanged. Source assertions confirm no `learningMode`-dependent amount or GivePoint branch and no mode-specific cron edit.
- Typecheck, 37 unit tests, 23 integration tests, all five offline legacy regressions, targeted lint, and production build passed.

## E1 narrow AvailableSlot repair evidence

- LearningSpace LIVE/HYBRID expose only future unbooked mentor slots, have no manual-time fallback, and submit the selected slot plus authorized LearningSpace selection through `bookAvailableSlot`.
- `createBooking` rejects linked LIVE/HYBRID before review-gate work, transaction entry, GP debit, Booking/TransactionLog creation, notification, or email; EXERCISE_REVIEW and unlinked legacy creation remain on their prior path.
- The existing row lock, post-lock `isBooked` rejection, locked mentor/start/end authority, one Booking create, one GP debit, `slotId`, and slot update remain intact. Failed slot requests refresh availability.
- The mentor-profile slot component, Calendar/Meet acceptance, cancellation/decline slot handling, no-show/dispute, GP/ledger, cron, chat, dashboard, and history code were unchanged.
- PASS: typecheck; 41 unit tests; route smoke plus 25 integration tests; all five offline legacy regressions; targeted ESLint; and the 34-page production build. The standard `tsx` host limitation reproduced before discovery; suites passed with the documented temporary preload, which was removed.
## I1 checkpoint (2026-10-21)

The Booking transition inventory is `I1_TRANSITION_AUDIT.md`. Legacy null-mode creation, scheduling, cancellation receipt/Trust/slot policy, no-show, dispute, public Review, GP/ledger, and PA-02 deadline notification regressions passed. Linked modes are excluded from the existing manual completion and auto-complete payout entries; the cron otherwise retains its legacy 72-hour logic. Focused fulfillment tests cover mode evidence, null rows, terminal freeze, retries, and conditional claims. I2/I3 must test real database payout races, reconciliation, and new deadline behavior before deployment.
