# Learning Hub Changelog

Current checkpoint: post-I1 reconciliation (2026-10-26); I2 is NEXT, NOT STARTED, and I3 remains pending. Dated entries retain their original evidence levels.

## 2026-10-28 — Standalone Teaching Calendar A2 date-range bug fix

- Teaching Calendar previously loaded only AvailableSlot records newer than seven days before the current date. Older weeks could appear blank while Learning Calendar displayed historical Bookings. `MentorCalendarManager` now requests surviving mentor slots overlapping the displayed FullCalendar week/day range through optional `getAllMentorSlots` range arguments: `startTime < rangeEnd` and `endTime > rangeStart`. Existing one-argument callers retain their prior behavior. Current-range mutation refresh, stale-response protection, and explicit load errors preserve the existing slot event mapping, styling, dialogs, and interaction rules.
- Automated verification: targeted Calendar 15/15, Learning Hub unit 148/148, integration 64/64, legacy route smoke, all five existing regression scripts, typecheck, targeted lint, production build, and `git diff --check` PASS. The six pre-existing lint warnings and middleware deprecation warning are non-blocking. These are the implementation verification results; tests/build were not rerun for this documentation update.
- OWNER-REPORTED manual SQL-fixture Calendar rendering: TC-A2 and TC-C01 through TC-C04, 5/5 PASS. Cancelled Booking display cases used STAGING SQL fixtures, not end-to-end cancellation workflow execution. Other browser smoke tests have not been confirmed as completed. Teaching Calendar remains AvailableSlot-based: Bookings without a surviving linked Slot do not appear as Booking events, and the 07:00–22:00 display window is unchanged.
- This is a standalone Calendar bug fix, separate from Learning Hub implementation checkpoint A2. No Booking lifecycle, GivePoint, wallet, escrow, settlement, database schema, or migration change occurred. I1 implementation and I2/I3 status, dependencies, scope, and sequencing remain unchanged: I2 is NEXT, NOT STARTED; I3 remains pending.

## 2026-10-26 — Post-I1 evidence reconciliation

Recorded the 2026-10-21 STAGING migration 008 deployment and owner-reported localhost/STAGING browser-session smoke alongside the prior I1 implementation, disposable PostgreSQL, and 11-case automated audit. Owner HTTP-01 denied unauthenticated fulfillment data through a sign-in redirect; fetch followed it to 200 HTML rather than expected 401 JSON, a LOW-priority API contract deviation pending client compatibility/contract decision. Owner HTTP-02 mentor GET/START returned 200 with IN_PROGRESS/version 1; HTTP-03 learner DELIVER returned 403 with unchanged IN_PROGRESS/version 1 on a separate test Booking; HTTP-04 nonmember GET returned 403. Codex did not reproduce browser traffic, inspect cookies or GP/ledger for the manual POST, or rerun automated/PostgreSQL tests. I2 linked settlement remains next and unstarted; I3 remains pending.

## 2026-10-26 — Historical I1 automated test gap closure

Mapped I1-01–I1-11 to existing mock, route, and disposable PostgreSQL evidence. Added exact in-process route response/error contract assertions and a DML-only post-008 TEST runner for EXERCISE_REVIEW revision/acceptance, HYBRID prework after Meet end, persisted versions/timestamps, audit entries, nonmember/role denial, BookingStatus and GP/TransactionLog invariance, and run-owned cleanup. PostgreSQL PASS; focused route 3/3, unit 7/7, and typecheck PASS. Actual HTTP/browser-session authentication remains unverified; no production code/schema/migration, STAGING or production data, I2 or I3 change occurred.

## 2026-10-21 — I1 migration 008 STAGING deployment

Migration 008 was applied once to STAGING project `tuamfxfquhyccserzmab` after prerequisite precheck PASS. Postcheck PASS confirmed the intended nullable version column and enum labels, preserved all 102 historical Booking rows and BookingStatus values, and found no unrelated schema change. No production migration or I2 settlement occurred; RUNBOOK and IMPLEMENTATION_STATE retain the detailed evidence.

## 2026-10-21 — I1 disposable PostgreSQL verification

Added an opt-in focused PostgreSQL verification runner. On the disposable TEST project only, migration 008 passed pre-008 fixture, injected failure atomicity, forward, safe prewrite rollback/reforward, postwrite rollback refusal, nullable/default/no-backfill, and cleanup checks. Two independent serializable sessions produced one winning START, DELIVER, and ACCEPT claim apiece; stale/replayed claims produced no duplicate activity, and fixture GP/TransactionLog values were unchanged. Final TEST schema retains 008 with zero test-owned rows. Linux focused I1 unit/route tests passed 9/9. Existing static/full-suite evidence remains separate. No application/staging/production migration, production feature edit, I2 settlement, or I3 cron work occurred; controlled fulfillment races do not establish settlement concurrency. See IMPLEMENTATION_STATE and TEST_MATRIX for assertions and limits.

## 2026-10-19 — H2 audit repair and documentation reconciliation

Recorded the current H2 checkpoint: transaction-local membership/space rechecks for LINK deletion and note writes, the Vietnamese LearningSpace-details event label, and AUD-03 as deferred potential state reuse. Current H2 evidence is 20/20 focused, 139/139 unit, and 61/61 integration PASS; the latest production build was not rerun. Actor attribution and missing activity-events owner manual confirmations are 6/6 and 8/8 PASS respectively.


## 2026-10-18 — H2 missing activity events

Added privacy-safe, deduplicated activity entries for resource soft deletion and successful shared-note edits and deletion. The timeline labels these actions in Vietnamese. Private notes, downloads, views, failed mutations, Booking, GP, fulfillment, notifications, and legacy behavior are unchanged.

## 2026-10-17 — H2 activity actor attribution

Learning Activity responses now include the actor display name from the existing authorized activity relation, and each History timeline entry shows that name beside its timestamp. Missing/deleted actors use `Thành viên GiveGot`; actorless system events use `Hệ thống`. No schema, endpoint, event writer, pagination, deduplication, authorization, legacy Booking flow, or metadata exposure changed.

## 2026-10-16 — H2 structured learning activity

Added an active-member, cursor-paged LearningSpace activity feed and compact History-tab timeline. Added content-free space/topic/task/space-visible-note/linked-Booking events in existing transactions; reused existing resource, Submission, and review events. Reads redact event metadata through an allowlist, keep archived/deleted history, and never mirror chat or private feedback. No schema, migration, data backfill, GP/settlement, provider, notification, or legacy Booking policy change. Fulfillment writes remain I1 scope; private note existence is excluded from the shared timeline. Verification and rollback are recorded in IMPLEMENTATION_STATE.

## 2026-10-16 — H1 checkpoint reconciliation

H1/LH 050 implementation is COMPLETE. Migration 007 passed disposable TEST forward/legacy/default/enum/index/safe rollback/unsafe refusal/cleanup and owner-authorized STAGING forward/schema/Prisma checks; PRODUCTION was not migrated. The initial full suite passed 123/123 unit and 58/58 integration; latest H1-11 repair passed 9/9 focused Notes unit and 2/2 route. Five legacy regressions, typecheck, and targeted lint passed at both checkpoints; initial build and latest diff check passed at their respective checkpoints. Owner-reported browser H1-01–H1-20 20/20 PASS includes H1-09/11/15 retests, H1-10 soft delete, and H1-19 Booking ownership; no independent reproduction or browser automation is claimed. The UI says “Xóa ghi chú” for existing audited soft deletion. H1-UX-01/02 are deferred P2 UX work, and group learning/multi-learner slots are Post-MVP design backlog. H2/LH 060 is next and NOT STARTED; fulfillment and settlement risks remain open. No code, schema, migration, database, ADR, or risk classification changed during this documentation reconciliation.

## 2026-10-16 — H1 manual notes and recap

Added private, versioned GENERAL/RECAP notes with optional Booking scope, visibility rules, author-only edit/soft delete, and an optional LearningSpace recap editor after eligible linked sessions. Added additive migration 007 and API routes. Legacy Booking, dashboard/history, AI, chat, fulfillment, settlement, and provider flows are unchanged. Automated evidence and deployment limitation are in IMPLEMENTATION_STATE.



## 2026-10-16 — G3 documentation staleness reconciliation (F-01 through F-04)

- F-01/F-04: established one authoritative current G3 checkpoint in state/context/plan/matrix/regression documents; labeled older G3/D0e checkout summaries as historical without rewriting their results, limits, or counts. G3/LH 042 implementation COMPLETE; real PostgreSQL concurrency VERIFIED on 2026-10-16 for R1-R5 in seven controlled cases with cleanup confirmed; that limitation is CLOSED, without claiming all theoretical schedules.
- F-02: OWNER-REPORTED MANUAL BROWSER SMOKE: 13/13 PASS — not independently reproduced or automated. Individually accepted PASS case IDs: G3-M01, G3-M02, G3-M03, G3-M04, G3-M05, G3-M06, G3-M07, G3-M08, G3-M09, G3-M10, G3-M11, G3-M12, G3-M13. M08 verifies UI reviewer permission: assignees lack review input/actions but may view authorized feedback and resubmit after revision request; no separate review page/URL is required. Backend authorization has separate automated evidence. No screenshots, logs, Playwright/E2E execution, or independent manual reproduction are claimed.
- F-03: added the PostgreSQL R1-R5 regression checkpoint covering duplicate/stale rejection, atomicity, audit deduplication, Booking/GP/ledger/Trust/public Review isolation, test-owned cleanup, and owner-reported manual smoke. Historical 118/118 units, 56/56 integrations, five legacy regressions, typecheck/targeted lint/build/diff PASS, unrelated 77-error/32-warning lint baseline, focused mock 18/18, and real PostgreSQL evidence remain separate; no passing suite/build/database verification was rerun for reconciliation.
- Only relevant Markdown documentation changed. Accepted ADRs and risk classifications remain unchanged; unresolved GP/fulfillment/settlement/cron risks remain open. REVIEWED completes LearningTask, not Booking or GP settlement. I1/I2/I3 and J1 remain pending; H1 is the next safe dependency-registry task (D1 complete), NOT STARTED and not authorized for implementation by this documentation task. Historical entries below describe their own checkpoint dates, including then-unverified browser/concurrency status.

## 2026-10-16 — G3 real PostgreSQL concurrency verification

- Verification-only: added opt-in PostgreSQL runner, synchronized/hash-verified current G2/G3 dependencies into existing Linux TEST workspace, preserved local .env and prior source backup, and passed read-only project/URL guard, SELECT 1, independent connections, schema/enums/uniqueness/foreign-key preflight without migrations or application connections.
- Actual G2/G3 services and independent Serializable transactions passed seven controlled cases: R1, both R2 winner orders, R3, stale R4 with real G2 resubmit and subsequent valid review, and both R5 state boundaries. PostgreSQL activity proved overlapping backend transactions; DB assertions verified winner-only state/review/deadline/audit updates and unchanged unrelated Booking/GP/ledger/Trust/public-rating data. Seven synthetic fixtures were removed with zero remaining rows in all checked run-owned categories and final source/config/global snapshot parity.
- Status PASS; G3 real PostgreSQL concurrency VERIFIED for these cases. Focused static/mock compatibility rerun 18/18, verifier lint, and typecheck passed. Historical evidence is preserved; G3 browser smoke remains unverified. Only IMPLEMENTATION_STATE, TEST_MATRIX, and CHANGELOG evidence changed alongside the new verifier; production code/schema/migrations and pre-existing user changes were preserved. H1 is the next safe playbook task (D1 complete), but was not started.

## 2026-10-15 — G3 private Submission review and revision

- Added session-backed creator-counterpart private review GET/POST, current feedback display, REVIEWED/REVISION_REQUESTED controls, optional independent revision deadline, stale revision identity guards, and atomic conditional claims/current-review upsert/safe revision audit. ADR 018 records task-only transitions and current-content/audit semantics. G2 and D0e server contracts are unchanged.
- Added meaningful service, route, rollback/concurrent-request, private visibility, public Review/Trust isolation, and rendered feedback/form tests plus route smoke imports. Focused 11/11 service/routes and 3/3 UI, complete unit 118/118, integration 56/56 plus smoke, typecheck, targeted lint, build, diff check, and all five regressions passed. Full lint retains 77 errors/32 warnings in legacy code. Status PASS WITH KNOWN LIMITATION; exact commands are recorded in IMPLEMENTATION_STATE. No schema/migration, DB/provider, Booking/fulfillment, GP/settlement, notification, or cron operation occurred. Real PostgreSQL G3 races and browser smoke remain unverified.

## 2026-10-13 — D0d pre-commit evidence reconciliation

- D0d-F1 repaired two audited P1 client-state races: per-task upload lifecycle now settles in the mounted parent across task navigation, and pending G2 submission locks that task's draft inputs and attachment actions until the request settles. F1/G1/G2 backend contracts did not change. Focused submission UI tests 14/14, Learning Hub unit 105/105, relevant integration 24/24, typecheck, targeted ESLint, and diff check passed. F1 did not rerun the production build; the UX2 build PASS below is earlier evidence.
- Historical UX2 automation passed while owner acceptance was blocked by the missing-content observation. The owner later found affected legacy/test tasks were inserted directly into Supabase without complete task content; a newly populated task displayed title, description, and acceptance criteria in the actual UI. This owner-observed test-data provenance does not rewrite the historical UX2 result or represent a backend/UI fix.
- The owner now reports all D0d browser smoke PASS, including sections, task selection/pagination, draft retention, direct F1/G2, materials separation, the existing-file picker, mobile, archived behavior, G2 blocked-request failure/retry, and private file download. The owner also reports P1-01 upload success after navigation and failure/retry recovery, and P1-02 pending G2 editing lock, task navigation, failure recovery, and retry PASS. These are owner-reported browser results, not independently reproduced automated results. D0d remains uncommitted; D0e and G3 are NOT STARTED. Deferred BUG-033, GG-LH-UI-002, and GG-LH-F1-001 are not D0d fixes.

## 2026-10-10 — D0d-UX2 task content and file-control repair

- Replaced inline task row and requirements markup with render-tested title-first row and selected-detail components. The detail consistently presents task title, localized status, optional deadline, Mô tả bài tập, and Yêu cầu hoàn thành. Invalid or absent optional values have explicit restrained copy. The exposed native file input is now inside a styled accessible selection control.
- The owner rejected UX1 visual acceptance after seeing missing titles and requirements. G1 returns full task rows and UX1 already referenced the matching property names; no title-hiding CSS was found. The exact running-page cause and the specific screenshot tasks' dueAt values remain unverified without authorized runtime response inspection. No private records were queried.
- Focused render/UI tests 33/33, Learning Hub unit 102/102, relevant integrations 24/24, typecheck, targeted ESLint, production build, and diff check passed. Owner browser review remains pending. No server, schema, migration, provider, D0e, or G3 change; no commit or push.

## 2026-10-09 — D0d-UX1 master/detail and submission-form repair

- Reworked Công việc & bài nộp into a desktop 35/65 master/detail view with an eight-row title-first task list and immediate selected detail. Mobile now starts on the list, opens one detail, and provides an accessible back action. Task statuses are localized and due dates are shown without changing G1 data or enums.
- Clarified the Bài làm của bạn hierarchy and observable direct-upload stages while preserving text, HTTPS link, and file inputs. READY attachments remain associated directly with each in-memory draft; G2 failures keep the draft and retry the same resource ID. The optional picker stays secondary and refreshes `view=ready-files` on every open. Current Submission content, link, submitted time, revision, file download, and unavailable state remain read-only.
- Verification passed 30 focused UI tests, 99 Learning Hub unit tests, 24 relevant integration tests, typecheck, targeted ESLint, diff check, and production build. The obsolete render/loading attachment assertion was replaced by contract-level metadata-fetch and click-only download coverage. Manual owner smoke remains pending. No server contract, schema, migration, database, provider, D0e, or G3 work was performed.

## 2026-10-09 — D0d LearningSpace sections and submission flow

- Replaced the lower resource/task/placeholder grid with four hash-linked, responsive sections while keeping shared LearningSpace and Booking context above them. Task rows are compact; one selected task has the full-width detail and editable form. Notes and History remain placeholders.
- The page and Tài liệu refresh use D0c `view=materials`. Material uploads request `MATERIAL`; direct task uploads request `SUBMISSION_ATTACHMENT`, automatically attach the finalized READY ID, and reuse it on G2 retry. Per-task unsent drafts remain in memory across section/task changes. The secondary existing-file picker fetches fresh `view=ready-files` data on each open; current attachment metadata uses the same view.
- Focused tests, 96 Learning Hub unit tests, 24 relevant integration tests, typecheck, targeted ESLint, diff check, and production build passed. Manual smoke remains pending. F2 LINK purpose remains legacy; drafts do not survive reload; deleted current attachments show unavailable. D0e deletion protection is recommended next and G3 remains unstarted. No commit, push, schema, migration, database, provider, or server-contract change.

## 2026-10-09 — D0c scoped F2 resource reads

- Added optional `view=materials` and `view=ready-files` to the existing resource collection GET. Omitted view retains all-purpose compatibility; filters run in the Prisma resource query. Unsupported views return the existing 400 error style.
- Preserved member authorization, archived-space reads, response privacy, ordering, independent full-space FILE quota, page caller, and client-side topic grouping/pagination. F2 link creation continues to rely on the legacy purpose default. No schema, migration, F1/G2, UI, D0d, D0e, or G3 change was made.
- Verification passed 23 focused F2/D0c tests, 24 relevant integration tests, route smoke, typecheck, targeted ESLint, and diff check. Standard Windows `tsx` hit the documented ENOMEM before discovery; unchanged suites passed with the temporary preload, then removed. Full lint, build, legacy regression scripts, shared database, and real provider were not run. D0d is next.

## 2026-10-08 — D0b F1 resource-purpose assignment

- Extended F1 file initiation with optional `purpose`. Explicit `MATERIAL` and `SUBMISSION_ATTACHMENT` are persisted in the existing locked PENDING reservation; omission persists `LEGACY_UNCLASSIFIED` for backward compatibility. Explicit legacy, unknown, and malformed values return 400 before reservation or provider access.
- Preserved F1 authorization, archive, ownership, MIME/extension, size, quota, advisory-lock, signing, key, finalize, lifecycle, cleanup, download, and deletion contracts. Purpose remains unchanged after reservation. G2 attachment eligibility remains READY, non-deleted, FILE, and same-space without purpose filtering.
- D0b verification passed 18/18 focused F1 storage tests, 43/43 Learning Hub integration tests, 97/97 Learning Hub unit tests, typecheck, targeted ESLint, and `git diff --check`. Production build, full repository lint, and the five legacy regression scripts were not rerun for D0b. Provider calls were mocked; no shared database or real storage provider was used. The documented temporary Windows `tsx` preload was removed afterward.
- D0c scoped resource reads are next. D0d, D0e, and G3 were not started.

## 2026-10-07 — D0a resource-purpose schema foundation

- Added `LearningResourcePurpose`, a non-null legacy-default purpose column, transactional manual migration 006, guarded rollback and production note, focused static tests, and a disposable-database migration verifier. When applied, existing rows retain their data and receive `LEGACY_UNCLASSIFIED`; no intent is inferred.
- Verified 2026-10-07 on the approved disposable Supabase TEST project: clean/legacy forward and rollback, old-writer defaults, explicit classifications, invalid-enum rejection, relationship preservation, classified rollback refusal, injected-failure atomicity, and cleanup passed. Repaired only the verifier's transaction-prologue insertion so PostgreSQL `DO $$` dollar quotes remain literal; migration 006 and rollback SQL were unchanged.
- Prisma binary-engine generation, validation, typecheck, 21 focused D0a tests after the verifier repair, targeted ESLint, static migration/schema parity, and diff checks passed. No shared staging/production database or storage provider was touched.
- D0a is complete. F1/F2/G1/G2 behavior and all unrelated contracts remain unchanged; D0b purpose assignment is next and D0c owns scoped reads.

## 2026-09-29 — LearningResources dependency micro-repair

- Audited the additional `react-hooks/exhaustive-deps` warning in `src/components/learning/LearningResources.tsx` and confirmed it pre-dated G2 and was unrelated to G2.
- Memoized `resourceGroups` from `resourceItems` and `topics`, made the pagination effect depend on the stable memoized value, and updated the learning-resource pagination contract test.
- Targeted ESLint, 71 Learning Hub unit tests, 39 Learning Hub integration tests, typecheck, all five legacy regressions, production build, and `git diff --check` passed. Full repository lint returned to 77 errors/32 warnings, the unrelated legacy baseline.

## 2026-09-28 — G2 current Submission workflow

- Added session-assignee-only current Submission GET/POST, HTTPS/text/READY same-space file validation, first-submit and revision-requested edit windows, transactional task claim, revision count, and content-free deduplicated activity.
- Added the mobile LearningSpace submission form with loading, file selection, duplicate-click guard, and draft-preserving validation.
- No migration or change to legacy Booking, reviewer outcome, GP, settlement, notifications, or cron. Typecheck, targeted lint, Learning Hub suites, legacy regressions, and build passed.

## 2026-09-28 — G1 completion and verification

- Diagnosed the F2 resource-pagination blocker as an implementation-coupled source assertion and repaired only that test assertion; production pagination behavior did not change.
- Prisma generation now passes. Migration 005 forward rehearsal and rollback rehearsal passed on approved staging; forward SQL was reapplied after rollback, leaving staging in the post-G1 schema state.
- Final verification passed 62 Learning Hub unit tests, 39 integration tests, all five legacy regression scripts, Prisma generate/validate, targeted ESLint, and production build. G1 status is PASS; the next safe task is G2 — Submission workflow.

## 2026-09-27 — G1 Learning Task Domain

- Added LH 040 task create/list/update service and protected API with server-session actor, active pair and Booking/topic ownership checks, archived-space write denial, independent future dueAt, required acceptance criteria, and optimistic version conflicts.
- Added additive `LearningTask.version` migration and rollback SQL. G1 status actions permit assignee start and creator cancellation; submission, review, and completion remain reserved for later tasks. No UI, notifications, Booking scheduling, fulfillment, settlement, or GivePoint changes.
- Targeted G1 unit tests, integration route smoke, legacy regression, typecheck, Prisma validate, targeted lint, and production build passed. Full unit suite has a resource-pagination failure in unchanged F2 code. Prisma generation hit the Windows DLL lock; database migration execution awaits an explicit disposable database.

## 2026-09-21 Task F2 Resource domain and UI

- Added member-authorized HTTPS resource routes and a LearningSpace resource UI. Links normalize HTTPS-only URLs and open safely; files continue to use F1 private direct upload/finalize and on-demand download.
- Resource list/activity payloads exclude storage keys and signed URLs. Files retain lifecycle/deletion behavior and provider cleanup from F1; no arbitrary URL fetch, file parsing, raw video, Booking, or settlement change was added.
- Added F2 tests for dangerous URL schemes, quota/empty/mobile/long-Vietnamese display, and private-boundary/activity contracts. Typecheck, 44 units, 35 integrations, five legacy regressions, targeted lint, and build passed.

## 2026-09-21 B2/C1 lint debt repair

- Replaced the 74 B2/C1 `@typescript-eslint/no-explicit-any` findings and two known unused-variable warnings with precise request, route-context, Prisma-derived repository, and typed test-double boundaries across the seven audited files. No intended runtime, API, authorization, database, query, status-code, or side-effect-order behavior changed.
- Verification passed targeted ESLint at 0 errors/0 warnings, typecheck, 41 Learning Hub unit tests, route smoke plus 35 integration tests, all five legacy regression scripts, and the 35-page production build. Full lint is 77 errors/32 warnings, exactly the unrelated legacy baseline.
- The two `tsx` suites used the previously documented host-only temporary preload for the Windows `os.userInfo()` ENOMEM issue. The untracked helper was removed afterward and is not a product/runtime dependency.

## 2026-09-20 Repository-memory lint reconciliation

- Later read-only diagnosis classifies the current 151-error/34-warning full-lint result: 77 errors/32 warnings are unrelated legacy debt, while B2 introduced 46 errors/one warning and C1 introduced 28 errors/one warning. All 74 Learning Hub errors are `@typescript-eslint/no-explicit-any`; the two warnings are known unused variables.
- The diagnosis found no lint scope/configuration change, newly included untracked-file contribution, or generated/temp-file contribution. F1 files have zero lint findings.
- An isolated B2/C1 lint repair was required before F2 and completed on 2026-09-21, removing the 74/2 Learning Hub findings and restoring full lint to the unrelated 77/32 legacy baseline.

## 2026-09-20 Task F1 Private storage infrastructure

- Added an S3-backed provider abstraction, private bucket CloudFormation template, server-session/member-authorized signed file APIs, and an hourly secret-protected orphan cleanup route.
- Uploads use five-minute signed POST credentials, random staging keys, PDF/JPEG/PNG/TXT/Markdown allowlist, 20 MiB file and 500 MiB space caps. Finalize verifies S3 metadata and promoted file signatures before READY. Downloads use ten-minute signed attachment URLs after fresh membership authorization. Soft deletion blocks new URLs and retries object removal.
- Reused the existing LearningResource schema and statuses with no migration, backfill, old-row mutation, Booking/GP/settlement change, or visible UI. F2 owns resource list/detail and external link UI.
- Verification passed typecheck, 41 unit tests, 35 integration tests after route smoke, five legacy regression scripts, targeted ESLint, and the 35-page production build. Provider calls were mocked; no production upload occurred. Standard `tsx` still requires the documented temporary Windows host preload, which was removed. Later reconciliation confirms F1 has zero lint findings; the 151/34 full-lint result is 77/32 unrelated legacy debt plus 74/2 B2/C1 debt.
- Rollback removes only F1 code/config/docs; if deployed with files already written, first stop writes and retain/export LearningResource rows and bucket objects. The private bucket template uses `Retain` and is not destroyed automatically.

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
- PASS WITH KNOWN LIMITATION: typecheck; 41 unit tests; route smoke plus 25 integration tests; all five legacy regressions; targeted ESLint; and production build with 34 pages. Standard `tsx` reproduced the documented Windows `os.userInfo()` ENOMEM before discovery; suites passed under the temporary compatibility preload, which was removed. This narrow repair did not rerun full lint. Later reconciliation classifies the earlier 151-error/34-warning result as 77 errors/32 warnings of unrelated legacy debt plus 74 errors/2 warnings introduced by B2/C1.
## 2026-10-21 — I1 fulfillment state machine

- Audited every existing Booking status/financial/deadline writer in `I1_TRANSITION_AUDIT.md`; accepted ADR 020.
- Added nullable fulfillment version and terminal fulfillment enum values (manual migration 008), a server-session-bound GET/POST transition service, mode evidence checks, conditional Serializable claims, and versioned content-free activity.
- Mirrored Booking cancellation/no-show/dispute outcomes into linked fulfillment and prevented legacy manual/auto-complete time-only payouts for linked modes. No new GivePoint release, ledger write, public Review/Trust mutation, or full cron redesign was added.
- Initial implementation verification and limitations are recorded in IMPLEMENTATION_STATE and TEST_MATRIX. At this initial checkpoint migration 008 had not been applied; the later disposable TEST rehearsal is recorded above. Application/staging/production remain unmigrated. I2/I3 are separate tasks.
