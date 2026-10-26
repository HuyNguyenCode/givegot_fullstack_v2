# Learning Hub Context Packet

## Current post-I1 checkpoint (2026-10-26)

I1 mode-aware fulfillment is implemented with ADR 020 and the pre-code matrix in `I1_TRANSITION_AUDIT.md`. Migration 008 passed disposable PostgreSQL TEST forward/guarded rollback and controlled START/DELIVER/ACCEPT races, then was applied to STAGING project `tuamfxfquhyccserzmab` on 2026-10-21 with precheck/postcheck PASS and all 102 historical Booking rows preserved; production remains unmigrated. Server-session-authorized, version-conditional transitions require mode evidence and write deduplicated activity; legacy manual completion and auto-complete payout are gated to null-mode rows. I1 itself does not release GP. The automated gap audit mapped 11 cases across unit, in-process route, and real TEST PostgreSQL evidence. Owner-reported localhost/STAGING browser-session smoke on 2026-10-26 passed mentor GET/START, learner DELIVER denial, and nonmember GET denial. Unauthenticated GET redirected to `/auth/signin`; fetch followed it to HTTP 200 HTML without fulfillment JSON, an access-control PASS with a LOW-priority deviation from the expected 401 JSON contract. Codex did not independently reproduce the browser run or inspect its GP/ledger. I2 linked settlement is NEXT, NOT STARTED; I3 cron/deadline policy remains pending. R-004, R-010, and R-017 stay open/partial, and the H2 Gap B pilot/public-launch distinction remains.

## Historical H2 checkpoint (2026-10-19)

H2/LH 060 is IMPLEMENTED. Actor attribution is fixed and owner-verified (6/6 manual PASS; historical 135/135 unit and 61/61 integration PASS). Missing activity events for resource deletion and shared-note edits/deletion are implemented and owner-verified (8/8 manual PASS); the later automated/build result for that source remains unconfirmed. The final audit repair adds transaction-local active, unsuspended membership and ACTIVE-space rechecks for LINK deletion and note create/update/delete; 20/20 focused, 139/139 unit, and 61/61 integration tests passed, along with typecheck, targeted lint, legacy regressions, and diff check. The latest production build was not rerun. A concurrent revocation/archive after the transaction-local check remains possible under existing transaction semantics. The LEARNING_SPACE_DETAILS_UPDATED Vietnamese label is fixed. AUD-03 timeline state reuse is POTENTIAL / DEFERRED with no confirmed UI reproduction. I1 remains separately owner-authorized; optional I0 is audit-only and may precede it.

## Historical H1 checkpoint (2026-10-16)

H1/LH 050 implementation is COMPLETE. Manual GENERAL/RECAP notes use server-session authorship, private visibility, optional Booking scope, version-checked author edits, and audited soft deletion labeled “Xóa ghi chú” in the UI under ADR 019. Archived spaces remain readable and reject writes; recap remains optional and legacy Bookings are unchanged. Migration 007 passed disposable TEST forward/rollback/refusal/cleanup and STAGING forward/schema/Prisma checks; PRODUCTION was not migrated. Initial full suites were 123/123 unit and 58/58 integration; latest H1-11 focused suites were 9/9 Notes unit and 2/2 route, with five legacy regressions passing at both checkpoints. Owner-reported browser H1-01–H1-20: 20/20 PASS, including H1-09/11/15 retests, H1-10 soft delete, and H1-19 Booking ownership; no independent browser automation was run. H1-UX-01/02 are deferred P2. This is historical H1 evidence; H2 is the current completed checkpoint.



## Historical G3 checkpoint (reconciled 2026-10-16)

G3/LH 042 implementation is COMPLETE in the uncommitted working tree at HEAD `3e0cb6f8c2bf0d009195f0305f8979b7fccd516b` (D0e committed). G3 REAL POSTGRESQL CONCURRENCY: VERIFIED on 2026-10-16; R1-R5 passed in seven controlled cases with verified cleanup, closing that limitation without claiming exhaustive schedules. OWNER-REPORTED MANUAL BROWSER SMOKE: 13/13 PASS — not independently reproduced or automated. G3-M08 verifies UI reviewer permission; no separate review page/URL is required. Detailed evidence and all case IDs are in IMPLEMENTATION_STATE and TEST_MATRIX.

Task creator reviews the assignee's current SUBMITTED revision; active unsuspended pair and ACTIVE space are required. A linked Booking must contain the pair and cannot be CANCELLED/DISPUTED/MISSED. REVIEWED sets Task COMPLETED and Submission REVIEWED only; REVISION_REQUESTED sets both records to REVISION_REQUESTED for unchanged G2 resubmission. Optional revisionDueAt updates independent Task.dueAt (omitted preserves; null clears). No Booking fulfillment, GP/settlement, public Review/Trust, provider, notification, or cron mutation occurs. ADR 018 governs atomic version/status/revision claims and single current review; duplicate/stale decisions return 409, and previous revision decisions remain in content-free audit.

Historical automated implementation checkpoint (2026-10-15): unit 118/118, integration 56/56 plus smoke, five legacy regressions, typecheck, targeted lint, production build, and diff check PASS; full lint retained unrelated 77 errors/32 warnings. The 2026-10-16 focused mock rerun passed 18/18 separately from PostgreSQL and owner evidence. No tests were rerun for this reconciliation. I1/I2/I3 and J1 remain pending. At this historical G3 checkpoint, H1 was the next task and had not started. Dated sections below preserve earlier states and are historical.

## Historical D0e checkpoint (reconciled 2026-10-14)

D0e protects every current Submission FILE attachment independent of resource purpose. F1 FILE deletion rechecks the active member, LearningSpace state, uploader ownership, FILE state, and current reference inside a Serializable transaction, then commits a conditional DELETED transition before provider removal. Referenced files and `P2034` conflicts return privacy-safe 409. G2's existing Serializable transaction is unchanged, as are orphan cleanup and F2 LINK deletion. Existing legacy FILE rows already DELETED are not restored; a current Submission that already references an unavailable/deleted legacy FILE remains unavailable.

Focused F1 integration 22/22, Learning Hub unit 105/105, Learning Hub integration 53/53, real disposable PostgreSQL races 4/4 controlled scenarios, typecheck, targeted ESLint, offline legacy regressions, and diff check passed. The race suite covers submit wins, delete wins, controlled overlap, and revision A to B, not every theoretical schedule. The backend independent audit was `PASS WITH FINDINGS` with LOW-only documentation findings and reviewed test source/evidence without independently rerunning database tests.

D0e-UI-001 resolves the specific current-Submission FILE conflict message; D0e-UI-002 hides and guards FILE delete in ARCHIVED spaces while preserving reads/downloads. Its focused UI 19/19, relevant F1/F2 integration 28/28, typecheck, targeted ESLint, and diff check passed. The owner reports M01-M05 PASS, including M03 and M05 after the UI repair. No independent UI re-audit or production build was run. D0e remains uncommitted. G3 is NOT STARTED and not authorized.

## Historical D0d pre-commit reconciliation (2026-10-13)

D0d, UX1, UX2, and D0d-F1 are implemented and remain uncommitted. D0d-F1 repaired two audited P1 client-state races: parent-owned per-task upload settlement across task navigation and a per-task G2 pending lock that preserves the submitted snapshot. Its automated verification passed 14/14 focused submission UI tests, 105/105 Learning Hub unit tests, 24/24 relevant integrations, typecheck, targeted ESLint, and `git diff --check`. No production build was rerun for F1; the UX2 build PASS is earlier evidence.

At the UX2 checkpoint, automated checks passed but owner acceptance was blocked by missing content on the observed page. The owner later established that affected legacy/test tasks had been inserted directly into Supabase without complete task content; a newly populated task displayed its title, description, and acceptance criteria in the actual UI. This is owner-observed test-data provenance, not a backend or UI fix, and does not rewrite the historical UX2 outcome. The owner now reports PASS for all D0d browser smoke, including sections, task selection/pagination, draft retention, direct F1/G2 submission, materials separation, the existing-file picker, mobile, archived behavior, G2 blocked-request failure/retry, and private file download. The owner also reports PASS for P1-01 upload success after task navigation and upload failure/retry recovery, and P1-02 pending G2 editing lock, task navigation, failure recovery, and retry. These are owner-reported browser results, not independently reproduced automated results. D0e is NOT STARTED and needs owner approval; G3 is NOT STARTED. No next implementation task is selected.

## D0d-UX2 content visibility repair (verified 2026-10-10)

The owner rejected UX1 visual acceptance after seeing status-only task rows and missing task requirements. UX2 keeps the 35/65 desktop master/detail and mobile list/detail/back pattern, rendering title-first rows and a persistent selected requirements block with explicit optional-field states. The native file input is visually replaced by a styled accessible control. G1 returns full task rows under the property names consumed by the client; the exact cause of the observed running-page omission and the screenshot tasks' dueAt values remain unverified without authorized runtime inspection. React static-render fixtures, focused UI 33/33, Learning Hub unit 102/102, relevant integrations 24/24, typecheck, targeted ESLint, build, and diff check passed. Owner browser review is pending; D0e and G3 remain unstarted.

## D0d-UX1 bounded UX repair (verified 2026-10-09)

D0d-UX1 keeps the four-section shell and replaces the task area with a desktop 35/65 master/detail view plus mobile list/detail/back navigation. Task rows use authoritative G1 titles, localized statuses, optional due dates, and eight-row local pagination. The selected detail keeps one G2-gated Bài làm của bạn form for text, HTTPS link, and optional file. Direct upload, READY association, no-reupload G2 retry, fresh optional ready-files picker, and per-task in-memory draft retention remain intact with clearer state/error presentation. The focused UI suite passed 30/30, all Learning Hub unit tests 99/99, relevant integrations 24/24, typecheck, targeted ESLint, diff check, and production build passed. Owner manual smoke remains pending; D0e and G3 remain unstarted.

## D0d LearningSpace UI and submission flow checkpoint (verified 2026-10-09)

D0d is implemented: shared context remains above four hash-addressable sections (Tài liệu, Công việc & bài nộp, Ghi chú, Lịch sử). Materials load and refresh through D0c `view=materials`; material F1 uploads send `purpose=MATERIAL`. Tasks show a compact list and one full-width selected detail/form. Per-task in-memory drafts retain text, HTTPS link, chosen attachment, local file, and finalized READY association across task and section changes. Direct uploads send `purpose=SUBMISSION_ATTACHMENT`, then attach the finalized resource ID automatically for G2 and reuse it on G2 retry. The optional existing-file picker requests fresh `view=ready-files` data with `no-store` on each open; current Submission attachment metadata also comes from that scoped read. No schema, F1 lifecycle, D0c backend, F2 link write, G1/G2 service, or delete semantic changed. F2 links still use the legacy database purpose default and remain visible as LEGACY_UNCLASSIFIED. Drafts do not survive page reload/navigation; a deleted current attachment retains the explicit unavailable message. D0e deletion protection is still recommended before G3; both remain unstarted.

## D0c scoped-resource-read checkpoint (verified 2026-10-09)

D0c is complete. The F2 collection GET accepts optional `view=materials` and `view=ready-files`; omission keeps the original all-purpose PENDING/READY/QUARANTINED collection and the one-argument `listLearningResources(spaceId)` caller. Materials include MATERIAL and LEGACY_UNCLASSIFIED; ready-files include non-deleted READY FILE rows of every purpose. The resource query applies scope in Prisma, keeps `createdAt desc`, and does not expose purpose, storage keys, signed URLs, or provider credentials. Quota remains the full-space FILE PENDING/READY/QUARANTINED aggregate for every view. Current LearningResources grouping and five-row per-group pagination remain client-side. F2 link creation still uses the legacy database default. At the D0c checkpoint, D0d was next and unstarted; D0d is complete now. D0e and G3 remain unstarted.

## D0b resource-purpose assignment checkpoint (verified 2026-10-08)

D0b is complete. F1 file initiation accepts optional `purpose`; only explicit `MATERIAL` and `SUBMISSION_ATTACHMENT` are client-selectable, while omission is persisted as `LEGACY_UNCLASSIFIED` for older callers. Explicit `LEGACY_UNCLASSIFIED` and every unknown or malformed value fail with the existing 400 validation style before reservation or provider access. Purpose is written in the existing advisory-locked quota reservation and is not changed by finalize, READY, quarantine, cleanup, download, or soft delete. F1 authorization, provider, quota, locking, key, expiry, and lifecycle contracts are unchanged; G2 attachment eligibility remains READY, non-deleted, FILE, and same-space without a purpose predicate. At the 2026-10-08 D0b checkpoint, D0c scoped reads were next; D0c is complete now. At the D0c checkpoint, D0d was next and unstarted; D0d is complete now. D0e and G3 remain unstarted.

## D0a resource-purpose checkpoint (verified 2026-10-07)

D0a is complete. The additive `LearningResource.purpose` enum uses `MATERIAL`, `SUBMISSION_ATTACHMENT`, and `LEGACY_UNCLASSIFIED`; the non-null database default preserves unknown legacy intent and older writers. Migration 006 and its guarded rollback passed clean, representative-legacy, classification/default, relationship, rollback, atomic-failure, and cleanup rehearsal on a disposable TEST database; their SQL was unchanged during final rehearsal debugging. D0a did not change F1/F2/G1/G2 runtime behavior. At the 2026-10-07 D0a checkpoint, D0b purpose assignment was next, followed by D0c scoped reads. Both are complete now; D0d owns the later LearningSpace redesign. G3 remains separate and unstarted while this D0 path is resolved.

## G2 completion update (2026-09-28)

LH 041 is complete. One current Submission per task accepts text, a safe HTTPS link, and/or a READY same-space FILE resource reference. First submit is allowed from OPEN/IN_PROGRESS; only a dual task/Submission REVISION_REQUESTED state reopens editing. The session assignee owns submissions, revisionCount starts at 1 and increments once per resubmit, and a content-free deduplicated activity event records each revision. The task version/status claim is transactional and serializable. The mobile form retains failed drafts. No reviewer outcome, GP, Booking, or settlement behavior changed. G3 owns revision-request transitions and feedback.

## G1 completion update (2026-09-28)

LH 040 is complete. The task service/API uses session identity, active-pair authorization, optional space-owned Booking/topic, independent future dueAt, and version-checked edits. Migration 005 adds only `LearningTask.version` with default 1; forward and rollback rehearsals passed on approved staging, and forward SQL was reapplied to leave staging in the post-G1 schema state. Prisma generate/validate, typecheck, 62 unit tests, 39 integration tests, all five legacy regressions, targeted ESLint, and production build passed. The F2 pagination repair changed only an implementation-coupled test assertion, not production behavior. Submission was reserved for G2 and Review for G3 at this checkpoint; G2 is now complete and Review remains G3 scope.

## Read order

1. `MASTER_SPEC.md` for product requirements and invariants.
2. `ARCHITECTURE_DECISIONS.md` for accepted design decisions.
3. `IMPLEMENTATION_STATE.md` for the latest code and test baseline.
4. The relevant task in `IMPLEMENTATION_PLAN.md`.
5. Relevant rows in `TEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, and `RISK_REGISTER.md`.

## Historical implementation overview (through 2026-10-14)

Earlier B2/C1/D1/E1/F1/F2/G1/G2 and D0 checkpoints remain documented in IMPLEMENTATION_STATE, TEST_MATRIX, and the dated sections above. They preserve their original tests, limits, and then-pending task status; the current post-I1 checkpoint controls today's status.

## Owner-owned dirty state before Task 00

- Deleted: `docs/GiveGot Learning Hub Codex Implementation Prompt Playbook.docx`.
- Deleted: `docs/GiveGot Learning Hub Product and Technical Specification.docx`.
- Untracked: `docs/learning-hub/Codex_GiveGot Learning Hub Product and Technical Specification.docx`.
- Untracked: `docs/learning-hub/GPT_GiveGot_Learning_Hub_MVP_Spec_v1.0.docx`.
- Preserve these exact changes; do not restore, reset, clean, reformat, stage, or rename them.

## Fixed product decisions

- LearningSpace is persistent across multiple Bookings.
- Booking remains the session, schedule, attendance, cancellation, dispute, review, escrow, and GivePoint transaction.
- `primarySkill` is mutable with audit/notification; history retains prior provenance.
- Subtopics are flexible free-form topics with optional canonical Skill mapping.
- No hard unique constraint for pair plus primary skill; suggest reuse but allow another space.
- Exactly two active members in MVP; roles live on Booking/Task, not permanent membership.
- P0 modes are LIVE, EXERCISE_REVIEW, and HYBRID, each with distinct evidence and completion rules.
- For EXERCISE_REVIEW only, `Booking.startTime`/`endTime` are unchanged legacy compatibility fields, not synchronous availability/attendance or async workflow timing. `LearningTask.dueAt` is independent; `Submission.submittedAt`, `SubmissionReview.reviewedAt`, `Booking.deliveredAt`, and fulfillment lifecycle state are authoritative. The separate question of whether EXERCISE_REVIEW should stop consuming an AvailableSlot is deferred; G1/G2/G3 do not change it, and I1/I2/I3 own endTime-independent settlement enforcement.
- BookingStatus and FulfillmentStatus are separate.
- Old rows and Bookings with future Learning Hub fields null remain valid.
- Private SubmissionReview is separate from public Review and Trust Score.
- History is derived from source data and activity, not a mutable history table.

## Security and settlement invariants

- Server session owns actor identity; never authorize from client identity fields.
- Membership/object checks precede private metadata, content, signed upload, and signed download.
- Private realtime uses authorized channels; never broadcast private learning content publicly.
- Production cron requires `CRON_SECRET` and an unset secret is an error.
- Async/Hybrid completion uses `deliveredAt`, acceptance, review window, and dispute state, never only `endTime`.
- Settlement is conditional, transactional, idempotent, and recorded in the immutable ledger.
- Provider/notification failure after commit does not roll back domain state.

## Security state after A2

- CLOSED: `/api/conversations` GET/POST scope identity to the server session; changing legacy `userId` values cannot enumerate another user's conversations or create/open a Booking conversation as that user.
- CLOSED: `/api/messages` GET checks session plus conversation participation before returning data or changing read state.
- CLOSED: `/api/messages` POST checks session plus participation and always persists the session user as sender.
- CLOSED IN A1 SCOPE: Booking lifecycle/review actor IDs and private Booking list/receipt reads are session-bound; notification reads/read-state are session-bound; internal notification creation is no longer a server action; admin actions guard role at the action boundary.
- CLOSED: conversation and user-targeted realtime channels are private and authorized from the server session; guessed conversation/user IDs fail before Pusher signing.
- CLOSED: LearningSpace channel names are private and authorized through B2's active-membership lookup.
- After I1, auto-complete retains the legacy `CONFIRMED` plus `endTime < now - 72h` rule only for null-mode Bookings; linked modes are excluded at selection and conditional claim. I3 owns mode-aware timing.
- CLOSED: auto-complete, reminders, and review-deadlines enforce the shared production `CRON_SECRET` guard; middleware exposure does not bypass route authentication.
- Other legacy action families outside the explicitly audited A1 boundaries still require case-by-case authorization review before they are reused for Learning Hub data.

## Current repository shape

- Next.js 16.1.6 App Router, React 19.2.3, NextAuth 5 beta, Prisma/PostgreSQL 5.22.0.
- Existing user routes: auth, homepage, discover, mentor, booking, dashboard, chat, history, wallet, profile, admin.
- Existing APIs: auth, conversations, messages, existing cron routes plus F1 storage cleanup, two test routes, three VNPay routes, and `/api/pusher/auth`. Current Learning Hub APIs include:
    - F1 file initiation/finalize/download/delete routes,
    - F2 resource collection/item routes,
    - G1 task list/create/update routes,
    - G2 current-submission route: `/api/learning/spaces/[spaceId]/tasks/[taskId]/submission`; G3 private review GET/POST appends `/review`.
    - H1 Notes collection/item APIs: `/api/learning/spaces/[spaceId]/notes` and `/api/learning/spaces/[spaceId]/notes/[noteId]`; Learning invite APIs: `/api/learning/invites/*`; I1 fulfillment GET/POST: `/api/learning/spaces/[spaceId]/bookings/[bookingId]/fulfillment`.
- Schema has 27 models, including the ten Learning Hub domain models. Booking retains additive nullable Learning Hub fields, including I1 fulfillment version/timestamps, and keeps its original status enum unchanged.
- Manual migration 004 adds the Learning Hub domain additively, with an executable rollback plus a production rollback note. Additive migration 005 adds only `LearningTask.version` with default 1 and has executable rollback SQL plus a rollback note. Migration 006 adds only `LearningResourcePurpose` and non-null `LearningResource.purpose` with the `LEGACY_UNCLASSIFIED` database default, plus its guarded rollback. Migration 007 adds H1 note type/default, audited soft deletion, and an active-list index; TEST rehearsal and STAGING forward passed. Migration 008 adds nullable `Booking.fulfillmentVersion` and terminal fulfillment labels; TEST rehearsal and STAGING forward passed with no Booking backfill. Production remains unmigrated for 007/008.
- Canonical commands include `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, `test:learning-hub:migration`, and `test:regression`.

## Environment names only

`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `LEARNING_STORAGE_BUCKET`, `CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_SHOW_DEV_BAR`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_URL`, `VNP_HASHSECRET`, `VNP_RETURNURL`, `VNP_TMNCODE`, `VNP_URL`, `RESTORE_DATABASE_URL`.

## Next task

I2 linked GivePoint settlement is next and NOT STARTED; I3 mode-aware cron/deadline policy and J1 remain pending. I2 must independently prove atomic, idempotent GP/TransactionLog release and reconciliation without changing legacy Booking semantics or assuming I1's controlled fulfillment races prove settlement. Task COMPLETED/private feedback is not Booking delivery, acceptance, or GP settlement. The current post-I1 checkpoint above controls; dated historical evidence remains in its owning checkpoint.

## Completion contract

For each task: check every requirement; list changed files and reasons; report schema/migration/API/visible behavior; report compatibility and rollback; run task and regression tests; distinguish pre-existing failures; update state/context/test/changelog; record exact next assumptions; end with PASS, PASS WITH KNOWN LIMITATION, or BLOCKED; then stop.

## Historical Task 01 checkpoint

- Task 01 completed on 2026-09-12 with a dependency-free `node:test` plus existing `tsx` harness; no full test framework was added.
- Canonical commands are `npm run typecheck`, `npm run test:learning-hub`, `npm run test:learning-hub:integration`, and `npm run test:regression`.
- The integration smoke test imports legacy conversations, messages, and auto-complete routes without a server, database, provider, dotenv load, or secret output. Future database suites require an explicit `DISPOSABLE_TEST_DATABASE_URL` and must reject production/shared targets.
- Historical Task 01 verification passed Prisma generate/validate, typecheck, unit, integration, legacy regression, and build. Its recorded lint baseline was 78 errors and 32 warnings.

## Historical Task A1 checkpoint

- Task A1 completed with no schema, migration, database, settlement-policy, or visible UI change.
- Existing chat callers may continue sending legacy identity fields, but the server ignores them for authorization and authorship.
- The A1 suites cover missing session, spoofed query/body actor, nonparticipant IDOR/read-state, session-owned sender, legitimate list/read/send, admin role behavior, and Booking-to-chat association.
- A2 may rely on `requireAuthenticatedUser` and `requireConversationParticipant` when authorizing private Pusher channels.
- B1 may implement `LearningSpaceMembershipLookup` without changing the A1 server-session identity contract.
- Remaining critical blockers before private Learning Hub payloads are R-002 public realtime and R-003 cron authentication.

## Historical Task A2 checkpoint

- Task A2 closed R-002 and R-003 with private authorized realtime channels and one shared production cron guard.
- Server-session identity authorizes conversation and user channels. LearningSpace channels remain private and deny by default until a concrete membership lookup exists.
- The explicit local cron bypass is accepted only outside production and only with `x-givegot-local-cron: 1`; it cannot override production authentication.
- No schema, migration, database, settlement timing, eligibility rule, or visible UI structure changed.
- A2 suites cover unauthenticated subscription, guessed conversation/user IDs, legitimate participant authorization, chat event delivery, notification channel privacy, missing/invalid/valid cron credentials, production bypass denial, and no secret/private-boundary logging.
- Verification passed typecheck, 11 unit tests, 12 integration tests, all five legacy regressions, targeted lint with no errors, and production build. Full lint remains the unchanged 77-error/32-warning baseline.

## Historical Task B1 checkpoint

- Added the ten approved Learning Hub models, supporting enums, explicit relations/deletion behavior, indexes, archive/soft-delete state, deduplicated activity, and one-current Submission/SubmissionReview constraints.
- Added nullable `learningSpaceId`, `topicId`, `learningMode`, `objective`, `definitionOfDone`, `fulfillmentStatus`, `deliveredAt`, and `acceptedAt` fields to Booking. Existing `BookingStatus` and settlement behavior are unchanged.
- Manual migration 004 performs no backfill. A guarded real-PostgreSQL verifier and representative six-status legacy fixtures are committed; credential-free in-memory PostgreSQL execution passed clean, legacy, invariant, and rollback paths.
- The schema has no member role, no two-member database cap, and no pair-plus-primary-skill uniqueness. B2 must enforce at most two active members transactionally and derive every actor from the server session.
- Verification passed Prisma generation/validation, typecheck, 15 unit tests, 12 integration tests, all five legacy regressions, migration execution/rehearsal, and production build. Full lint remains the documented pre-existing 77-error/32-warning baseline.

## Historical Task B2 checkpoint

- Recorded: 2026-09-16, Asia/Saigon.
- Status: PASS WITH KNOWN LIMITATION.
- Added server-session-backed LearningSpace/Topic service handlers and `/api/learning/spaces` routes; no UI, schema, migration, provider, mode, fulfillment, settlement, or legacy Booking lifecycle change.
- Direct and confirmed-Booking creation require two distinct active users and an existing primary Skill. The service uses a transaction-scoped PostgreSQL advisory lock before membership capacity changes; there is no pair-plus-skill unique constraint, so reuse is suggested but creation remains allowed.
- Reads and mutations use active membership derived from `auth()`; archived spaces remain readable to members and reject normal mutations, while restore is allowed. Topics are soft-archived without changing historical `Booking.topicId` references. Primary-skill changes write structured activity with the previous/new IDs and version.
- LearningSpace Pusher authorization now checks the concrete active-membership repository; no LearningSpace content is published by B2.
- Verification: typecheck; 17 Learning Hub unit tests; 12 integration tests; all five legacy regressions; production build. Full lint remains the pre-existing 77-error/32-warning baseline.
- Later correction (2026-09-20): this preserves the B2 checkpoint result. The then-current 151/34 result was classified as 77/32 unrelated legacy debt, 46/1 B2 debt, and 28/1 C1 debt. The B2/C1 findings were repaired on 2026-09-21 before F2.
- Compatibility/rollback: no schema/data migration or backfill; legacy Bookings with null Learning Hub fields remain unchanged/readable. Rollback is file-level reversion of B2 routes, services, tests, realtime authorizer wiring, and docs.
- At the B2 checkpoint, C1 was the next planned task; it is now complete.
