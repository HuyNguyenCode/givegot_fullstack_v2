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
