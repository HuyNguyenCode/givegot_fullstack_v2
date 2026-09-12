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
