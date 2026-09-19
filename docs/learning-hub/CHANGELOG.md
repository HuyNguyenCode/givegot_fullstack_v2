# Learning Hub Changelog

## 2026-09-11 Task 00 Control plane and baseline

### Added

- Created the ten-file Learning Hub repository memory set.
- Consolidated LH 001 through LH 100, P0-P3, out-of-scope boundaries, accepted architecture decisions, implementation sequence, test placeholders, legacy regressions, risks, and operational guidance.
- Recorded branch/commit, exact pre-existing dirty files, current routes, schema/models, scripts, environment variable names without values, manual migrations, and high-risk paths.
- Verified current client-controlled identity behavior in conversations/messages and current `CONFIRMED` plus `endTime` 72-hour auto-complete behavior.
- Recorded command exits and exact offline regression results.

### Not changed

- No application, API, component, action, library, configuration, package, schema, database row, migration, or DOCX file was changed.
- No Learning Hub feature was implemented.
- Pre-existing DOCX deletions and untracked reference DOCX files were preserved.

### Baseline

- PASS: Prisma validate, TypeScript no-emit, Next.js build, five offline regression scripts.
- FAIL, pre-existing/unfixed: Prisma generate Windows EPERM on locked query-engine DLL.
- FAIL, pre-existing/unfixed: lint with 78 errors and 32 warnings.
- Warning: Next.js reports deprecated `middleware` file convention.
- Documentation limitation: DOCX paragraph/table extraction completed; visual rendering could not start because bundled LibreOffice was unavailable.

### Compatibility and rollback

Production behavior and data compatibility are unchanged. Rollback consists only of removing the ten new Markdown files; do not touch the user-owned DOCX changes.

## 2026-09-12 Task 01 Minimal test harness

### Added

- Added dependency-free `node:test` coverage via the existing `tsx` package, deterministic clock/actor/Prisma-mock helpers, and an import-only legacy route smoke script.
- Added canonical typecheck, Learning Hub unit, Learning Hub integration, and offline regression package commands.

### Not changed

- No application, API, schema, migration, database row, provider call, or visible product behavior changed.
- The smoke suite does not load environment files, connect to Prisma, or invoke external providers.

## 2026-09-12 Task A1 Server identity and authorization

### Added

- Added reusable NextAuth-backed authenticated-user, conversation-participant, admin, and future LearningSpace-member authorization foundations.
- Added executable auth/chat coverage for unauthenticated requests, spoofed identity fields, nonparticipant IDOR/read state, session sender identity, valid participant flows, admin behavior, and Booking-to-chat association.

### Changed

- Conversations and messages now authorize and identify the actor exclusively from the server session while retaining legacy request-field compatibility and successful response shapes.
- Booking lifecycle/cancellation/no-show and blind-review actor identities now come from the session; review author/receiver identity comes from the Booking.
- Notification reads/read-state use session identity, and the internal notification writer is no longer exposed as a server action.
- Admin user/report/skill/withdrawal boundaries now enforce database-backed ADMIN access; report creation uses session authorship and absence resolution verifies its Booking association.
- Updated only affected offline regression mocks for the internal notification module and session actor dependency.

### Not changed

- No schema, migration, database row, Learning Hub model/UI, settlement policy, public realtime channel, cron authentication, or provider behavior changed.
- Realtime and cron hardening remain A2.

### Verification and compatibility

- PASS: 7 Learning Hub unit tests, integration smoke plus 6 route tests, all five legacy regressions, typecheck, targeted changed-file lint, and production build.
- KNOWN PRE-EXISTING LIMITATION: full lint reports 77 errors and 32 warnings; changed production and A1 test TypeScript files are clean.
- Existing UI request shapes remain accepted; authorized chat response payloads and mentee=userA/mentor=userB conversation association are preserved.
- Rollback is source/test/documentation file reversion only; no data rollback is required.

## 2026-09-16 Task A2 Realtime and cron security

### Added

- Added private conversation, user, and future LearningSpace channel conventions.
- Added session-backed `POST /api/pusher/auth` with participant/user ownership checks and deny-by-default LearningSpace behavior.
- Added a shared production cron guard plus an explicit non-production-only local test header.
- Added executable unit, integration, route, chat realtime, notification realtime, and logging-safety coverage.

### Changed

- Chat now publishes and subscribes on authorized `private-conversation-*` channels.
- Booking-cancellation realtime now publishes on authorized `private-user-*` channels.
- Auto-complete, reminders, and review-deadlines now require a configured matching `CRON_SECRET` in production.

### Not changed

- No schema, migration, database row, Learning Hub model/UI, cron timing, settlement eligibility, GivePoint rule, notification copy, or legacy request/response shape changed.
- Future LearningSpace subscriptions remain denied until concrete membership authorization is available.

### Verification and compatibility

- PASS: 11 Learning Hub unit tests, route smoke plus 12 integration tests, all five legacy regressions, typecheck, targeted lint without errors, and production build.
- KNOWN PRE-EXISTING LIMITATION: full lint remains exactly 77 errors and 32 warnings; the changed chat page retains one pre-existing hook warning.
- Rollback is file-level source/test/documentation reversion only; no schema or data rollback is required.

## 2026-09-16 Task B1 Learning Hub domain schema

### Added

- Added LearningSpace, LearningSpaceMember, LearningTopic, LearningInvite, LearningResource, LearningTask, Submission, SubmissionReview, LearningNote, and LearningActivity with supporting enums, explicit foreign-key deletion behavior, indexes, archive/soft-delete state, and audit/event deduplication fields.
- Added named manual migration `004_learning_hub_domain_schema.sql`, executable rollback SQL, and a production rollback note.
- Added a guarded local-disposable migration verifier, pre-B1 schema fixture, representative six-status Booking fixture, and schema/migration contract tests.

### Changed

- Added nullable Learning Hub references, mode, objective/definition snapshots, fulfillment state, and delivery/acceptance timestamps to Booking.
- Added `test:learning-hub:migration` for explicit local disposable PostgreSQL verification.

### Not changed

- BookingStatus and its six values/meanings are unchanged. The migration performs no historical backfill and does not reinterpret any legacy row.
- No UI, route, service, settlement, GivePoint, Review/Trust, provider, storage, cron-timing, or visible behavior changed.
- Membership has no permanent mentor/learner role; there is no pair-plus-primary-skill unique and no database two-active-member cap. B2 owns transactionally enforcing that service invariant from server-session identity.

### Verification and compatibility

- PASS: Prisma client generation/validation, generated DDL comparison, typecheck, B1 contract tests, route integration tests, all five legacy regressions, and production build.
- PASS: credential-free clean and representative legacy migration execution, legacy Booking queries, same-pair multiple-space insertion, archived history reads, no Skill auto-publication, and rollback rehearsal.
- The first default Prisma generation attempt reproduced the known Windows DLL lock from the running dev server; the required command then passed in Prisma binary-engine mode without stopping user work.
- KNOWN PRE-EXISTING LIMITATION: full lint remains the 77-error/32-warning baseline.

### Rollback

- Before Learning Hub writes, use the paired rollback SQL. After writes, pause writers and export all ten Learning Hub tables plus the eight Booking fields first; roll-forward is preferred. Never use `prisma db push` for shared migration state.

## 2026-09-16 — B2 LearningSpace domain services

- Added protected LearningSpace/Topic service/API handlers, membership-backed realtime authorization, B2 tests, and repository-memory evidence. No UI, schema, migration, or legacy Booking behavior change.

## 2026-09-16 — C1 Bring Your Pair invite backend

### Added

- Added session-bound LearningInvite create, preview, accept, and inviter-revoke APIs plus transaction-scoped service logic.
- Added 256-bit raw-token issuance with SHA-256-only persistence, safe public preview, exact pair usage limit, and idempotent acceptance for the original recipient.
- Added an encrypted, ten-minute HttpOnly/SameSite=Lax continuation cookie so login/signup does not lose an intended invite.
- Added executable coverage for valid/expired/revoked/self/replay/concurrent/third-member paths, logged-out continuation, existing-space reuse, and same-pair separate-space choice.

### Not changed

- No schema or migration, Booking lifecycle, Discover, social graph, UI, email, notification, provider, settlement, or legacy-row behavior changed.

### Verification and compatibility

- PASS: typecheck; 23 Learning Hub unit tests; route smoke plus 13 integration tests; five offline legacy regressions; targeted ESLint; production build.
- The standard `tsx` command initially failed before discovery on this Windows host because `os.userInfo()` returned ENOMEM. The same command passed with a temporary one-command compatibility preload; the preload was removed and no project runtime behavior depends on it.
- Rollback is file-level reversion of C1 source/tests/docs only; no data rollback is required.

## 2026-09-17 — D1 LearningSpace shell

- Added the authorized, mobile-first, read-only `/learning/[spaceId]` shell with private pair metadata, mutable-skill display, active topics, objective/definition, linked Booking context, archive notice, rebooking CTA, and future artifact placeholders.
- Session-backed membership is checked before the shell query; inaccessible and missing IDs use the same not-found path. No resource/task/note mutation, schema, API, or legacy flow changed.
- Added executable member/nonmember/archived/empty/long-Vietnamese/mobile/keyboard/navigation tests. Typecheck, 28 unit tests, 17 integration tests, and the five legacy regressions passed.
- KNOWN LIMITATION: the D1 production build compiled, but this host did not expose a final build-process exit; it is not recorded as a completed build verification. Full lint remains the existing baseline failure.

## 2026-09-17 — C2 Bring Your Pair user experience

- Added authenticated `/learning/new` invite creation with an approved primary-skill picker, optional objective, seven-day single-use link, copy affordance, clear Vietnamese copy, and back navigation.
- Added `/learning/invite/[token]` preview/continuation/acceptance UI. It uses C1's encrypted HttpOnly continuation cookie, leaves identity to the server-session accept endpoint, safely handles stale/self/full/replay outcomes, and opens the authorized LearningSpace with its available first Booking action.
- Invite preview now returns only skill/objective for an active usable link; expired, revoked, exhausted, and accepted links reveal no private pair metadata. Resource/task actions remain unavailable and are not implemented.
- PASS: typecheck; 31 Learning Hub unit tests; route smoke plus 17 integration tests; and all five legacy regressions. Targeted lint is clean for C2 files; inherited C1 invite service/test retain their documented pre-existing `any` lint findings. The build compiler started but this host left a worker-held lock without a final exit, so it is not recorded as a completed build verification.

## 2026-09-17 — E1 Booking and Learning Mode integration

- Added server-session-authorized LearningSpace context to both existing Booking creation paths. Linked bookings require the actor and selected mentor to be active members of the same space, validate an optional active topic, and snapshot mode/objective/definition/topic inside the Booking transaction.
- Added distinct LIVE, EXERCISE_REVIEW, and HYBRID artifact/completion contracts plus an accessible selector on LearningSpace-originated booking. Async/hybrid delivery and review anchors are independent of Meet `endTime`; meeting end alone is insufficient.
- Preserved legacy null-mode bookings, AvailableSlot locking, Calendar/Meet acceptance, cancellation/no-show/dispute, wallet/ledger amounts, TransactionLog, settlement, notifications, and cron. No schema, migration, backfill, fractional point, or mode-dependent amount logic was added.
- PASS: typecheck; 37 unit tests; route smoke plus 23 integration tests; all five legacy regressions; targeted ESLint; and production build (34 pages, existing middleware warning only). Full lint retains 151 errors and 34 warnings in pre-existing/out-of-scope files; E1 TypeScript is clean.

## 2026-09-16 — Repository memory and B2 realtime reconciliation

- Historical correction at that checkpoint: B2 and C1 were complete and D1 was next. D1, C2, and E1 are now complete; F1 is next in registry order.
- Replaced the stale pre-B2 LearningSpace deny-by-default integration assertion with active-member authorization, unauthenticated/nonmember/inactive denial, and readable-archived-space coverage. No production behavior changed.
- Verification: typecheck; 23 Learning Hub unit tests; route smoke plus 17 integration tests; and five offline legacy regressions.

## 2026-09-18 — E1 narrow AvailableSlot repair

- Confirmed that LearningSpace LIVE/HYBRID were using the legacy manual-time `createBooking` path despite the existing E1-ready `bookAvailableSlot` integration.
- LIVE/HYBRID now load future unbooked mentor slots, require a slot selection, submit the complete LearningSpace selection through the existing locked slot transaction, and refresh after stale failures. Empty availability has no manual fallback.
- Added an early `createBooking` rejection for linked LIVE/HYBRID before review-gate work or any GP, Booking, ledger, notification, or email side effect. EXERCISE_REVIEW and unlinked legacy manual booking remain unchanged; the mentor-profile slot component was not modified.
- No schema, migration, lifecycle, GP/pricing, wallet, settlement, provider, cron, artifact, or fulfillment-state-machine change. F1 remains unstarted.
- PASS WITH KNOWN LIMITATION: typecheck; 41 unit tests; route smoke plus 25 integration tests; all five legacy regressions; targeted ESLint; and production build with 34 pages. Standard `tsx` reproduced the documented Windows `os.userInfo()` ENOMEM before discovery; suites passed under the temporary compatibility preload, which was removed. The earlier full-lint delta remains open and was not rerun.

