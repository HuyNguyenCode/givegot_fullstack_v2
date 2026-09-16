# Learning Hub Risk Register

## Rating

Severity and likelihood are qualitative. `Open baseline` means verified before any Learning Hub implementation. Release gates require closure or explicit owner acceptance where allowed.

| ID | Risk and evidence | Severity | Likelihood | Required mitigation/owner | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | Client-controlled chat identity: conversation/message routes accept `userId`, `viewerId`, or `senderId` without binding actor to `auth()`. Message GET lacks membership authorization. | Critical | High | A1: server-session identity, object guards, spoofing/IDOR tests | CLOSED 2026-09-12: session identity, participant guards, and executable route tests |
| R-002 | Conversation Pusher channels are public and have no authorization endpoint, so private message payloads depend on channel-ID secrecy. | Critical | High | A2: private channels, authorization route, non-member subscription tests | CLOSED 2026-09-16: private conversation/user channels, session-backed authorization, guessed-ID denial, and LearningSpace deny-by-default |
| R-003 | Auto-complete cron authorization block is commented out while middleware exposes `/api/cron`. | Critical | High | A2: mandatory production `CRON_SECRET`, unset-secret failure, route tests | CLOSED 2026-09-16: shared fail-closed production guard on all three cron routes with route-level tests |
| R-004 | Auto-complete selects `CONFIRMED` solely by `endTime < now-72h`; future Exercise Review/Hybrid work could settle before fulfillment. | Critical | Certain if reused | I1-I3: separate fulfillment, `deliveredAt` eligibility, dispute guard, concurrency/reconciliation tests | Open baseline; do not reuse for async/hybrid |
| R-005 | Many legacy server actions accept actor-like user IDs from clients. Participant comparison alone cannot prove caller identity. | High | High | A1 inventory protected Booking/review, notification, and admin boundaries and bind concrete actor paths to session before private Hub work | MITIGATED 2026-09-12 for A1 scope; do not reuse unaudited legacy action families for Learning Hub data |
| R-006 | Learning artifacts may expose personal work through metadata, signed URLs, logs, admin support, or realtime events. | Critical | Medium | F1/F2/M1: private bucket, membership before metadata/URL, short TTL, redacted logs, narrow audited admin access | Planned |
| R-007 | Pair-plus-skill uniqueness would fragment or block legitimate separate goals; hard mentor/learner membership roles would prevent role reversal. | High | Medium | B1/B2: no hard unique constraint; role on Booking/Task; concurrency tests | Decision locked |
| R-008 | Non-null Learning Hub fields or broad backfill could invalidate legacy Booking rows. | Critical | Medium | B1: nullable additions, selective backfill, legacy fixtures, rollback rehearsal | Planned |
| R-009 | Repository uses manual migrations and `prisma db push`; drift or destructive implicit change can bypass review. | Critical | Medium | B1: reviewed SQL, backup/rollback, clean and legacy validation; never push shared DB for Hub migration | Open baseline |
| R-010 | Settlement races could double-credit GivePoints or desynchronize balance and TransactionLog. | Critical | Medium | I2/I3: conditional claim in transaction, unique idempotency evidence, reconciliation | Planned |
| R-011 | Provider failure could roll back or misreport a committed domain mutation. | High | Medium | Keep email/Pusher/provider calls post-commit and retryable; mock failures | Existing partial pattern; verify per task |
| R-012 | P0 scope can expand into LMS, video infrastructure, transcript capture, or AI before core usage. | High | High | Enforce P0/P1/P2/P3 gates and out-of-scope list; owner approval to expand | Controlled by plan |
| R-013 | AI recap can leak private context or follow instructions embedded in uploaded text. | Critical | Medium | P2A/P2B: explicit sources, consent, provenance, untrusted-input boundary, draft-only review | Deferred |
| R-014 | `npm run db:generate` passed in Tasks 01 and A1 after the earlier Windows EPERM baseline. Generated client may still become stale after future schema edits. | High for B1 | Medium | B1: rerun `npm run db:generate` before schema validation; do not claim schema task pass until it succeeds | Revalidate before B1 |
| R-015 | Lint baseline has 77 errors and 32 warnings, including scripts and application code. New regressions can be obscured. | Medium | High | Task 01 records baseline/delta strategy without excluding or weakening relevant files | Open baseline |
| R-016 | The canonical package test harness now exists, but disposable database integration coverage, migration matrix, and E2E remain pending. | High | High | Later tasks add T2/T5 evidence with an explicit disposable DB guard | Partially mitigated 2026-09-12 |
| R-017 | `review-deadlines` and existing UI encode endTime-based 48/72-hour legacy policy. Fulfillment rollout could create contradictory timers/copy. | High | High | E1/I1/I3 update mode-aware behavior while preserving legacy LIVE semantics; deterministic clock tests | Open baseline |
| R-018 | Office files and malicious uploads can expose users if previewed or downloaded without scanning. | High | Medium | P0 allowlist safe types; defer Office upload or download-only until malware scanning | Planned |
| R-019 | DOCX visual review could not run because bundled LibreOffice was unavailable. Text/tables were fully extracted, but layout was not independently verified. | Low for Task 00 | Certain | Restore bundled `soffice.exe` before any DOCX deliverable; not a product blocker | Known limitation |

## Immediate gates

- R-001 through R-003 are closed. LearningSpace realtime remains disabled until concrete B1/B2 membership authorization is wired.
- No Learning Hub schema migration before R-008, R-009, R-014, and R-016 have executable evidence.
- No async/hybrid GivePoint settlement before R-004, R-010, and R-017 are closed.
- No AI/transcript implementation while R-013 remains ungated.
