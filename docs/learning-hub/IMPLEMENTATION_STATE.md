# Learning Hub Implementation State

## Checkpoint

- Recorded: 2026-09-17, Asia/Saigon.
- Branch: `feature/learning-hub-mvp`.
- Current repository HEAD: `d6ac7ae2cee2d21160858b1f3d4c7ed49a7e15f8` (`feat(learning-hub): add LearningSpace shell`).
- Current checkout checkpoint: 00, 01, A1, A2, B1, B2, C1, D1, and C2 are PASS; E1 is PASS WITH KNOWN LIMITATION. C2 and E1 are current working-tree work after the recorded HEAD; checkpoint status does not require separate commits.
- Historical baseline before Task A1 authoring: `b2342f4c07430c2441ae4bcc2ec410fc27dfefb1`.
- Status: PASS WITH KNOWN LIMITATION (unclassified 151-error/34-warning full-lint delta and the documented Windows `tsx` host limitation).
- Production behavior: a Booking started from a LearningSpace now carries a server-authorized `learningSpaceId`, optional active `topicId`, selected LIVE/EXERCISE_REVIEW/HYBRID mode, objective/definition snapshots, and `NOT_STARTED` fulfillment state. Each mode exposes a distinct required-artifact and completion-readiness contract. Legacy Booking creation remains valid with all Learning Hub fields null.
- Schema/migration behavior: unchanged from B1: ten Learning Hub models plus eight nullable Booking fields; named additive migration 004 with rollback SQL/note and no historical backfill.
- API behavior: no new public route was added. `getLearningBookingContext` is a server action that derives identity from the session and returns context only when the actor and selected mentor are the two active members. Both existing Booking creation actions revalidate the linkage inside their database transaction.
- Learning Hub implementation: B2/C1/D1/C2 remain intact. E1 adds LearningSpace-aware booking selection, mode contract evaluation, immutable Booking snapshots, and a member-authorized booking UI. It does not implement artifacts, delivery mutations, acceptance, settlement, or mode-aware cron.
- Historical E1 verification recorded typecheck, targeted changed-file lint, 37 Learning Hub unit tests, route smoke plus 23 integration tests, all five legacy regressions, and production build as passing. The current observed full-lint result is 151 errors and 34 warnings; repository memory leaves the delta from the Task 00 baseline unclassified. No E1 TypeScript file has a recorded lint finding.
- Next safe task: F1 private storage infrastructure according to the task registry. Do not begin it automatically.

### OPEN PRODUCT DECISION — GivePoint quantity by learning mode

The GP quantity for EXERCISE_REVIEW and HYBRID remains intentionally unresolved. E1 preserves the existing integer one-GP Booking escrow and ledger semantics for every mode. It adds no mode-specific pricing, fractional GP, or time-based calculation from preparation, task, document, video, or feedback work. Wallet, settlement, TransactionLog, and cron behavior are unchanged. An owner decision is required before any future task changes GP quantity by mode.

## Historical baseline note

The four memory files the Task 00 prompt required first did not exist at that baseline. Task 00 created the complete memory set from the supplied references, the tracked playbook at that HEAD, and repository evidence available then.

## Pre-existing dirty state

Captured with `git status --short --untracked-files=all` before authoring. These entries are user-owned and were not restored, edited, staged, or deleted:

```text
 D "docs/GiveGot Learning Hub Codex Implementation Prompt Playbook.docx"
 D "docs/GiveGot Learning Hub Product and Technical Specification.docx"
?? "docs/learning-hub/Codex_GiveGot Learning Hub Product and Technical Specification.docx"
?? docs/learning-hub/GPT_GiveGot_Learning_Hub_MVP_Spec_v1.0.docx
```

Task 00 adds only the ten requested Markdown files under `docs/learning-hub/`.

## Current application routes

Verified by source inventory and successful Next.js build:

```text
/
/_not-found
/admin
/admin/finance
/admin/reports
/admin/skills
/admin/users
/api/auth/[...nextauth]
/api/conversations
/api/cron/auto-complete
/api/cron/reminders
/api/cron/review-deadlines
/api/messages
/api/test-trust
/api/test-wallet
/api/vnpay/create-payment
/api/vnpay/ipn
/api/vnpay/return
/auth/signin
/book/[mentorId]
/chat
/dashboard
/discover
/history
/learning/[spaceId]
/learning/new
/learning/invite/[token]
/homepage
/mentor/[mentorId]
/policies/cancellation
/profile
/profile/[id]
/suspended
/wallet
```

Current protected Learning Hub APIs are `POST /api/pusher/auth`, `/api/learning/spaces/*`, and `/api/learning/invites/*`. `/learning/[spaceId]` is the completed D1 LearningSpace UI route.

## Current schema

`prisma/schema.prisma` validates with 27 models: the 17 legacy models plus LearningSpace, LearningSpaceMember, LearningTopic, LearningInvite, LearningResource, LearningTask, Submission, SubmissionReview, LearningNote, and LearningActivity.

Booking keeps its legacy mentor/mentee, slot, schedule, BookingStatus, note, meeting, review, transaction, conversation, blind-review, absence, and report fields. B1 adds nullable `learningSpaceId`, `topicId`, `learningMode`, `objective`, `definitionOfDone`, `fulfillmentStatus`, `deliveredAt`, and `acceptedAt` fields.

BookingStatus remains exactly `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `MISSED`, and `DISPUTED`. FulfillmentStatus is a separate nullable lifecycle with `NOT_STARTED`, `IN_PROGRESS`, `DELIVERED`, `REVISION_REQUESTED`, `ACCEPTED`, and `SETTLED`.

The data source is PostgreSQL with `DATABASE_URL`, `DIRECT_URL`, and the pgvector extension. The repository uses Prisma 5.22.0 and notes `prisma db push`; it has no standard `prisma/migrations` history.

## Current migrations

Only `prisma/migrations-manual/` exists:

- `001_skill_category_to_enum.sql`: converts legacy Skill category strings to SkillCategory; drops/renames columns after backfill.
- `002_skill_embedding_readiness.sql`: additive BR-11 readiness fields, audit backup, vector eligibility check; explicitly reviewed/manual.
- `003_withdrawal_rejection_atomic_refund.sql`: adds `REFUND_WITHDRAWAL_REJECTED` to TransactionType.

Migration 004 adds the B1 domain additively and has paired executable rollback SQL plus a production rollback note. No ambiguous historical row is backfilled.

## Current scripts

Package scripts:

- `dev`, `build`, `start`, `lint`.
- `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, `test:learning-hub:migration`, and `test:regression`.
- `db:generate`, `db:push`, `db:seed`, `db:backfill-embeddings`, `db:backfill-transactions`, `db:migrate-skill-category`.
- `postinstall` runs Prisma generate.

Repository scripts:

- Interactive/provider or data-changing: `scripts/google-oauth-setup.ts`, `scripts/seed-users.ts`; Prisma seed/backfill/migration/admin utilities under `prisma/`. Not run in Task 00.
- Offline regressions: `scripts/test-cancellation-preview.cjs`, `scripts/test-pa02-deadlines.cjs`, `scripts/test-quiz-publication.cjs`, `scripts/test-skill-approval.cjs`, `scripts/test-withdrawal-rejection.cjs`.
- The Learning Hub unit/integration commands use the existing `tsx` harness. On this Windows host they require the documented one-command compatibility preload; no runtime dependency was added.

## Environment variable names

Values were not read or recorded.

`.env`: `CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_SHOW_DEV_BAR`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_URL`, `VNP_HASHSECRET`, `VNP_RETURNURL`, `VNP_TMNCODE`, `VNP_URL`.

`.env.restore-test`: `RESTORE_DATABASE_URL`.

## Verified current findings

### Server-session identity and private realtime

- Conversations and messages derive actor identity from the server session; client-supplied identity-like fields do not authorize reads or writes.
- Message reads enforce conversation participation, and persisted message senders are session-owned.
- Conversation and user realtime channels are private and server-authorized. LearningSpace realtime authorizes active members through the B2 membership lookup.
- Production cron routes require the shared `CRON_SECRET`; missing or invalid credentials fail before data access.

### Current auto-complete behavior

- `src/app/api/cron/auto-complete/route.ts` computes `cutoffTime = now - 72 hours`.
- It selects every Booking where `status = CONFIRMED` and `endTime < cutoffTime`; no mode or fulfillment predicate exists.
- It conditionally changes status to COMPLETED in a transaction, credits the mentor one GivePoint, creates a BOOKING_COMPLETED TransactionLog, and sends best-effort notifications.
- Mode-aware fulfillment and settlement remain I1-I3 scope; no Learning Hub mode/fulfillment predicate has been added to auto-complete.

## Baseline command evidence

| Command | Exit | Result |
| --- | ---: | --- |
| `npm run db:generate` | 1 | Failed with Windows `EPERM` renaming `node_modules/.prisma/client/query_engine-windows.dll.node.tmp3664` to the live query-engine DLL. Not fixed. |
| `npx prisma validate` | 0 | Schema valid; Prisma 5.22.0. |
| `npm run lint` | 1 | 110 findings: 78 errors, 32 warnings. Existing files include scripts plus application lint debt. Not fixed. |
| `npx tsc --noEmit` | 0 | Passed with no output. |
| `npm run build` | 0 | Compiled, typechecked, generated 29 static pages, and emitted the route list above. Warned that `middleware` convention is deprecated. |

Tool versions: Node `v24.18.0`, npm `11.16.0`, Prisma CLI/client `5.22.0`, Windows x64.

## Safe regression results

All five scripts are offline/mock-based and did not connect to or mutate a database:

| Script | Exit | Result |
| --- | ---: | --- |
| `node scripts/test-cancellation-preview.cjs` | 0 | PASS: cancellation policy, atomic 12-hour boundary receipt, actor-safe receipts, authorization. |
| `node scripts/test-pa02-deadlines.cjs` | 0 | PASS: PA-02 timeline, disclosure, deadline dedupe, auto-complete notifications. |
| `node scripts/test-quiz-publication.cjs` | 0 | PASS: owner/GIVE/APPROVED/READY gates and owner-only private lookup. |
| `node scripts/test-skill-approval.cjs` | 0 | PASS: moderation/readiness/concurrency, profile/publication regressions, migration source checks; SQL not executed. |
| `node scripts/test-withdrawal-rejection.cjs` | 0 | PASS: atomic reject refund, ledger, rollback, idempotency, approval isolation, admin authorization. |

Data-changing seed, backfill, manual migration, OAuth, and database push scripts were intentionally not run.

## Reference review limitation

Both supplied DOCX files were fully extracted at paragraph and table level. Visual rendering was attempted with the packaged document renderer but could not start because the bundled runtime exposed no `soffice.exe` on PATH or under its dependency root. No DOCX was edited. This does not affect the textual requirement baseline.

## Historical E1 task-entry assumptions

- C1's server-session-bound invite backend, including encrypted login continuation, exists and remains the authority for invite acceptance.
- D1's server-session/member-authorized `/learning/[spaceId]` shell exists and remains read-only.
- C2 Bring Your Pair onboarding is complete: `/learning/new` creates the link, `/learning/invite/[token]` continues logged-out recipients safely, and acceptance opens the authorized shell with the existing first-Booking action.
- E1 owns Booking and mode integration only. It must preserve server-session identity, old Booking rows with null Learning Hub fields, legacy Booking lifecycle, Calendar/Meet, cancellation, no-show, dispute, wallet/ledger, Review/Trust, chat, notifications, Discover, dashboard, history, and cron behavior unless an explicit E1 contract changes them.
- Keep settlement, storage, resources, tasks, submissions, reviews, notes, activity, notifications, providers, analytics, and other future-task work out of E1 scope.
- Existing baseline failures remain separate from task-introduced failures and must not be hidden by skips or weakened assertions.

## Historical task evidence

The following sections record the state and verification evidence at their named checkpoints. They are not current-checkout claims unless the checkpoint section explicitly says so.

## Task 01 completion

- Recorded: 2026-09-12, Asia/Saigon.
- Status: PASS WITH KNOWN LIMITATION.
- Scope: minimal test harness only; production behavior, API, schema, migrations, and database rows remain unchanged.

### Added

- Package commands: `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, and `test:regression`.
- Deterministic `node:test` helpers for a fixed clock, server-session-shaped authenticated actors, and explicit Prisma mocks.
- An import-only legacy route smoke script for conversations, messages, and auto-complete. It records prerequisite names without reading dotenv, calling providers, connecting to Prisma, or printing secrets.

### Verification

- PASS: `npm run db:generate`; `npx prisma validate`; `npm run typecheck`; `npm run test:learning-hub` (3 tests); `npm run test:learning-hub:integration` (smoke plus 1 test); `npm run test:regression` (all five legacy scripts); `npm run build`.
- KNOWN LIMITATION, pre-existing and not changed: `npm run lint` fails with 78 errors and 32 warnings in existing application and script files.

### Compatibility and rollback

- Legacy routes are import-smoke tested; the five existing offline regressions continue to pass. No test connects to a database or external provider.
- Rollback is removal of the Task 01 package scripts, test helpers/tests, smoke script, and Task 01 documentation entries. Preserve the four user-owned DOCX dirty-state entries unchanged.

## Task A1 completion

- Recorded: 2026-09-12, Asia/Saigon.
- Starting worktree: clean according to `git status --short --untracked-files=all`; no pre-existing user change was modified.
- Scope: reusable server identity/authorization plus concrete chat, Booking/review, notification, and admin spoofing paths named by A1.

### Added and changed behavior

- Added `server-authorization.ts` with `AuthorizationError`, `requireAuthenticatedUser`, `requireConversationParticipant`, `requireAdminUser`, and the schema-independent `LearningSpaceMembershipLookup`/`requireLearningSpaceMember` contract.
- Conversations list/create and messages list/read/send obtain the actor from NextAuth `auth()`. Client `userId`, viewer ID, and `senderId` remain accepted only for UI compatibility and never authorize or select the sender.
- Chat GET/POST endpoints document 401 unauthenticated, 403 nonparticipant, and 404 missing-object behavior. Authorized response bodies and the Booking mentee=userA/mentor=userB mapping remain unchanged.
- Booking lifecycle, cancellation, no-show, Booking lists/receipts, and blind-review actions overwrite actor-like parameters with the server-session user before authorization. Blind-review author/receiver IDs come from the Booking.
- Notification reads and read-state mutations scope to the session user. Internal notification creation moved to a non-server-action module so a browser cannot choose arbitrary recipients/content.
- Previously unguarded admin user/report/skill/withdrawal reads and mutations now enforce the database-backed ADMIN role; generic report authorship comes from the session; absence resolution verifies that the report belongs to the supplied Booking.

### Schema, migration, data, API, and visible UI

- Schema/migration/database rows: unchanged. No Prisma migration or data-changing test ran.
- API: only authorization/error behavior changed; successful conversation/message JSON shapes remain compatible.
- UI: no component changes. Existing clients can continue sending legacy identity fields.
- Realtime and cron security remain unchanged and belong to A2.

### Verification

- PASS: `npm run test:learning-hub` — 7 tests.
- PASS: `npm run test:learning-hub:integration` — smoke plus 6 tests.
- PASS: `npm run test:regression` — all five legacy scripts.
- PASS: `npm run typecheck`.
- PASS: targeted ESLint over all changed production and A1 test TypeScript files.
- PASS: `npm run build`; 29 routes generated, with the pre-existing middleware deprecation warning.
- KNOWN LIMITATION, pre-existing: full `npm run lint` reports 77 errors and 32 warnings. No changed production or A1 test TypeScript file has a lint finding; existing CommonJS regression scripts retain their documented lint errors.

### Compatibility and rollback

- Legacy Booking, cancellation, PA-02, quiz, skill, withdrawal, chat response, and Booking-to-chat association behavior passed.
- Rollback is file-level reversion of the A1 source/test/documentation changes. There is no schema, migration, data, or provider rollback.

### Next assumptions

- A2 can use the session and conversation guards for private Pusher authorization and owns mandatory production `CRON_SECRET`.
- B1 can implement the membership lookup interface after A2; it must remain additive/nullable and preserve legacy rows.
- Do not treat client identity fields as actor identity in any future endpoint or action.

## Task A2 completion

- Recorded: 2026-09-16, Asia/Saigon.
- Starting worktree: clean according to `git status --short`; no pre-existing user change was present or modified.
- Status: PASS WITH KNOWN LIMITATION.
- Scope: realtime privacy and cron authentication only.

### Added and changed behavior

- Added strict private channel constructors for conversations, users, and future LearningSpaces.
- Added `POST /api/pusher/auth`, which derives identity from the server session, authorizes conversation participants, authorizes only the matching user channel, rejects public/unknown channels, and denies LearningSpace subscriptions until a concrete membership authorizer is wired.
- Chat publishes/subscribes on `private-conversation-*`. Booking-cancellation realtime publishes on `private-user-*`.
- Added one shared cron guard to auto-complete, reminders, and review-deadlines. Production requires a configured matching `CRON_SECRET`; missing configuration fails closed.
- Preserved a deliberate local test path requiring non-production `NODE_ENV` plus `x-givegot-local-cron: 1`. The header cannot bypass production authentication.

### Schema, migration, data, API, and visible UI

- Schema/migration/database rows: unchanged; no migration or data-changing test ran.
- API: one new Pusher authorization endpoint; unauthorized cron requests now fail before data access. Authorized cron payloads and business logic remain unchanged.
- UI: no layout or copy change. Chat transparently uses private subscriptions.
- Settlement: unchanged `CONFIRMED` plus `endTime < now - 72h` legacy rule, transaction claim, credit, and notifications. Mode-aware settlement remains I1-I3 scope.

### Verification

- PASS: `npm run typecheck`.
- PASS: `npm run test:learning-hub` — 11 tests.
- PASS: `npm run test:learning-hub:integration` — route smoke plus 12 tests.
- PASS: `npm run test:regression` — all five legacy scripts, including private notification realtime and unchanged PA-02 auto-complete behavior.
- PASS: targeted ESLint over changed TypeScript — 0 errors; one pre-existing `src/app/chat/page.tsx` hook-dependency warning.
- PASS: `npm run build` — 30 routes including `/api/pusher/auth`; existing middleware deprecation warning only.
- KNOWN PRE-EXISTING LIMITATION: full `npm run lint` remains 77 errors and 32 warnings, exactly the A1 baseline.

### Compatibility and rollback

- Legacy request/response payloads, Booking lifecycle, notification content, 72-hour timing, transaction semantics, and old rows remain compatible.
- Pusher clients must use the repository client configuration so private subscriptions authenticate through `/api/pusher/auth`.
- Rollback is file-level reversion of A2 source, test, and documentation changes; no schema or data rollback is required.

### Next assumptions

- B1 may add only reviewed additive/nullable schema with representative legacy fixtures and no shared `db push`.
- B2 can supply the concrete LearningSpace membership authorizer before any LearningSpace realtime event is enabled.
- I1-I3, not A2, own mode-aware fulfillment and settlement timing.

## Task B1 completion

- Recorded: 2026-09-16, Asia/Saigon.
- Starting worktree: clean according to `git status --short --untracked-files=all`; no pre-existing user change was present or modified.
- Status: PASS WITH KNOWN LIMITATION.
- Scope: schema, reviewed migration, rollback, fixtures, and verification only.

### Added and changed behavior

- Added the ten approved Learning Hub models and supporting enums. LearningSpace is persistent across Bookings; `primarySkillId` is mutable; LearningTopic has a free-form normalized label plus optional canonical Skill relation; archive/soft-delete state preserves history.
- LearningSpaceMember uses composite space/user identity and intentionally has no mentor/learner role or database two-member cap. There is no pair-plus-primary-skill unique constraint; B2 owns transactional active-member enforcement and reuse suggestions.
- Booking received eight nullable Learning Hub fields. Old rows remain valid and unmodified; BookingStatus retains all six legacy labels and meanings.
- Relations specify `Restrict` where domain/audit history must prevent hard deletion and `SetNull` where an optional reference may be detached without deleting the retained record. Query-path and lifecycle indexes are explicit.
- Submission and SubmissionReview enforce one current row per task/submission for MVP. LearningActivity deduplicates on `eventKey`; no mutable LearningHistory table was added.

### Migration, rollback, and data

- Added `004_learning_hub_domain_schema.sql`, matching Prisma's HEAD-to-working-schema diff. It is additive, transactional, contains no `UPDATE "Booking"`, and never alters BookingStatus.
- Added executable rollback SQL plus a rollback note requiring writer pause and export of new-domain tables/columns before a production downgrade.
- Added minimal pre-B1 schema and representative legacy fixtures covering PENDING, CONFIRMED, COMPLETED, CANCELLED, MISSED, and DISPUTED Bookings.
- Credential-free in-memory PostgreSQL execution passed an empty legacy baseline, the representative legacy copy, old Booking queries, same-pair/two-space insertion, archived space/topic reads, no topic-to-Skill auto-publication, nullable legacy fields, unchanged BookingStatus, and rollback rehearsal. The temporary runtime was removed; configured remote databases were never contacted.

### API, UI, identity, settlement, and providers

- API and visible UI: unchanged. No `/learning` or `/api/learning` route was added.
- Identity: no service boundary was added in B1. B2 must use `auth()`/the existing server authorization contract and must never trust a client actor ID.
- Settlement, cron timing, GivePoint, public Review/Trust, storage, Calendar/Meet, email, and realtime behavior: unchanged.

### Verification

- PASS: `npm run db:generate` using Prisma binary-engine generation because the already-running dev server held the library DLL; generated Prisma Client 5.22.0.
- PASS: `npx prisma validate`; Prisma's generated schema diff matches migration 004.
- PASS: `npm run typecheck` and B1 schema/migration contract tests.
- PASS: clean and representative legacy migration paths plus rollback rehearsal on isolated in-memory PostgreSQL.
- PASS: `npm run test:learning-hub:integration` (12 tests), `npm run test:regression` (all five scripts), and production build (30 routes).
- KNOWN PRE-EXISTING LIMITATION: full lint remains the documented 77 errors and 32 warnings; B1 changed TypeScript is checked separately.

### Compatibility, rollback, and next assumptions

- Legacy Booking queries, dashboards/history build surface, cancellation, PA-02, quiz, Skill, withdrawal, chat, realtime, cron, and ledger behavior remain compatible.
- Rollback before Learning Hub writes uses the paired SQL. After writes, pause writers and export the ten tables/eight Booking fields first; roll-forward is preferred.
- B2 may implement only server-session-backed LearningSpace services, including a transaction/lock that rejects a third active member. It must not add a hard pair/skill unique or auto-create Skill rows.
- Do not begin UI, invite delivery, storage/provider integration, fulfillment, or settlement automatically.

## Task B2 completion

- Recorded: 2026-09-16, Asia/Saigon.
- Status: PASS WITH KNOWN LIMITATION.
- Added server-session-backed LearningSpace/Topic service handlers and `/api/learning/spaces` routes; no UI, schema, migration, provider, mode, fulfillment, settlement, or legacy Booking lifecycle change.
- Direct and confirmed-Booking creation require two distinct active users and an existing primary Skill. The service uses a transaction-scoped PostgreSQL advisory lock before membership capacity changes; there is no pair-plus-skill unique constraint, so reuse is suggested but creation remains allowed.
- Reads and mutations use active membership derived from `auth()`; archived spaces remain readable to members and reject normal mutations, while restore is allowed. Topics are soft-archived without changing historical `Booking.topicId` references. Primary-skill changes write structured activity with the previous/new IDs and version.
- LearningSpace Pusher authorization now checks the concrete active-membership repository; no LearningSpace content is published by B2.
- Verification: typecheck; 17 Learning Hub unit tests; 12 integration tests; all five legacy regressions; production build. Full lint remains the pre-existing 77-error/32-warning baseline.
- Compatibility/rollback: no schema/data migration or backfill; legacy Bookings with null Learning Hub fields remain unchanged/readable. Rollback is file-level reversion of B2 routes, services, tests, realtime authorizer wiring, and docs.

## Task C1 completion

- Recorded: 2026-09-16, Asia/Saigon.
- Status: PASS.
- Added a session-bound LearningInvite backend: a 256-bit raw token is returned only on creation, while PostgreSQL receives only its SHA-256 hash. Invites retain inviter, primary skill, initial objective, expiry, one-use pair limit, acceptance/revocation timestamps, and optional resulting LearningSpace.
- Acceptance holds transaction-scoped advisory locks for the invite and any selected space. It is idempotent only for the original recipient and rejects self acceptance, revoked/expired/exhausted state, a different-user replay, primary-skill mismatch, and a reuse choice that would create a third active member.
- A recipient may explicitly attach the accepted invite to an existing active matching pair space or omit that choice to create another space for the same pair. No pair-plus-skill uniqueness was introduced.
- Logged-out preview preserves the raw token only as an AES-GCM encrypted, ten-minute, HttpOnly, SameSite=Lax cookie. The cookie is cleared after acceptance; token hashes and raw tokens are never logged or returned in previews.
- Verification: `npm run typecheck`; 23 Learning Hub unit tests; route smoke plus 13 integration tests; all five legacy regressions; targeted ESLint; and production build. The Windows runner initially failed before test discovery because `tsx` calls `os.userInfo()` on this host; the test command passed without changing source after a one-command `NODE_OPTIONS` compatibility preload supplying the unavailable Windows `geteuid` path. The temporary preload was deleted.
- Compatibility/rollback: no schema, migration, backfill, Booking, Discover, social graph, email, notification, or provider change. Old rows remain valid. Rollback is file-level reversion of C1 routes/services/tests/docs; no database rollback is needed.
- Historical checkpoint: D1 was next after C1. D1, C2, and E1 are now complete; F1 is next in registry order.

## Task D1 LearningSpace shell

- Recorded: 2026-09-17, Asia/Saigon. Status: PASS WITH KNOWN LIMITATION.
- Added the mobile-first `/learning/[spaceId]` server route. It authorizes active membership from the server session before reading any shell metadata; unauthorized, unauthenticated, and absent IDs resolve through the same not-found route result, so the page does not disclose a private space's existence.
- The read-only shell displays the pair, mutable primary skill, active subtopics, objective, definition of done, current/next linked Booking, archive state, and the required resources/tasks/notes/history placeholders. Archived spaces remain readable and offer only the existing Book-next-session path; D1 adds no artifact or detail mutation UI/API.
- Route-local loading/error UI, responsive layout, explicit focus-visible controls, wrapping/whitespace handling for long Vietnamese copy, and empty-state content are included. RootLayout continues to own global navigation; the shell adds only a local Dashboard back link.
- Verification: `npm run typecheck`; 28 Learning Hub unit tests (including D1 member, nonmember, archived, empty, long Vietnamese, mobile, keyboard/focus, and navigation assertions); route smoke plus 17 integration tests; and all five legacy regressions. The unit/integration commands used the documented one-command Windows `tsx` compatibility preload and no project runtime dependency.
- Compatibility/rollback: no schema, migration, Booking lifecycle, dashboard/history source, provider, resource/task/note, or legacy UI code changed. Old rows remain valid. Rollback is file-level reversion of the D1 route/component/loader/tests/docs only.
- Historical checkpoint: C2 began after D1. C2 and E1 are now complete; F1 is next in registry order. Do not begin it automatically.

## Task E1 Booking and Learning Mode integration

- Recorded: 2026-09-17, Asia/Saigon. Status: PASS WITH KNOWN LIMITATION.
- Affected production files: `src/actions/booking.ts` integrates an optional LearningSpace snapshot into both Booking creation paths; `src/actions/learning-booking.ts` supplies a server-session context read; `src/lib/learning-booking-service.ts` owns pair/topic validation and snapshot preparation; `src/lib/learning-mode-contracts.ts` owns the three evidence/timing contracts; `/book/[mentorId]` and the LearningSpace CTA expose mode selection only for LearningSpace-originated bookings.
- Identity and authorization: the client never supplies the authoritative actor. The Booking actions overwrite `menteeId` from `requireAuthenticatedUser()`, take the existing LearningSpace advisory lock inside the Booking transaction, and require the actor plus selected mentor to be the two active members. Missing, inactive, outsider, self-pair, mismatched-pair, and cross-space/archived-topic choices are rejected without exposing private membership.
- Mode contracts: LIVE requires objective, scheduled Booking, Meet link, recap, elapsed scheduled component, and learner acceptance. EXERCISE_REVIEW requires task, submission, feedback, `deliveredAt`, and learner acceptance or expiry of a review window anchored to `deliveredAt`; `endTime` is not consulted. HYBRID requires prework, acknowledgement/questions, scheduled Booking, Meet link, recap, `deliveredAt`, and learner acceptance; its prework deadline and review window use artifact/delivery anchors rather than Meet `endTime`. Meeting end alone is never sufficient.
- Data behavior: no schema, migration, backfill, or existing row changed. A linked new Booking stores existing nullable fields and initializes fulfillment to `NOT_STARTED`; an unlinked legacy Booking still writes none of those fields. Booking objective/definition and topic reference are transaction-time snapshots and are not rewritten when the LearningSpace changes later.
- Legacy/provider behavior: AvailableSlot retains `SELECT ... FOR UPDATE`, the `isBooked` recheck, and the one-slot/one-Booking path. Calendar/Meet acceptance remains unchanged. Existing PENDING/CONFIRMED/COMPLETED/CANCELLED/MISSED/DISPUTED transitions, cancellation/no-show/dispute actions, wallet escrow, immutable TransactionLog amounts, settlement, notifications, and cron remain reachable and unchanged. The existing review gate now applies its `endTime` rule only to legacy-null and LIVE bookings; it does not apply Meet timing to async/hybrid work.
- Verification: `npm run typecheck` PASS; `npm run test:learning-hub` PASS (37); `npm run test:learning-hub:integration` PASS (23 after route smoke); `npm run test:regression` PASS (all five scripts); targeted ESLint PASS; `npm run build` PASS (34 generated pages, existing middleware deprecation warning only). At the E1 checkpoint, full `npm run lint` recorded 151 errors and 34 warnings, with no finding in an E1 TypeScript file. The current repository-memory delta classification remains open rather than treating that count as pre-existing. The standard `tsx` invocation reproduced the known Windows `os.userInfo()` ENOMEM host issue before discovery; the same commands passed with the previously documented temporary preload, which was removed.
- Rollback: revert only the E1 source, test, and documentation changes. No schema or data rollback is required. Existing linked rows remain compatible because every E1 Booking field was introduced as nullable in B1.
- Next assumptions: F1 may add private storage without changing E1 mode or GP contracts. G1 may use the EXERCISE_REVIEW/HYBRID artifact requirements after E1. I1-I3 still own fulfillment mutations, settlement enforcement, and mode-aware cron; do not infer settlement eligibility from this read-only evaluator alone.

## Historical repository-memory and B2 realtime reconciliation

- Recorded: 2026-09-16, Asia/Saigon. Status: PASS.
- Reconciled the stale pre-B2 integration assertion with the actual B2 authorizer. Private LearningSpace channels require a server session and ACTIVE membership; nonmembers and LEFT/REMOVED memberships are denied. An archived LearningSpace remains readable, so its active members remain authorized.
- Verification: `npm run typecheck`; 23 Learning Hub unit tests; route smoke plus 17 integration tests; and all five legacy regressions. No production behavior, schema, API, or UI changed.
- Historical reconciliation only: B2, C1, D1, C2, and E1 are complete; F1 is next in registry order.
