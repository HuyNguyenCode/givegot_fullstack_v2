# Learning Hub Regression Checklist

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

