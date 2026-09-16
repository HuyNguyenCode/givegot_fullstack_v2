# Learning Hub Implementation State

## Checkpoint

- Recorded: 2026-09-16, Asia/Saigon.
- Branch: `feature/learning-hub-mvp`.
- HEAD before Task A1 authoring: `b2342f4c07430c2441ae4bcc2ec410fc27dfefb1`.
- Task: A2 Realtime and cron security.
- Status: PASS WITH KNOWN LIMITATION.
- Production behavior: chat and user-targeted realtime use authorized private channels; sensitive cron routes require production `CRON_SECRET`.
- Schema/migration behavior: unchanged; no database row was read or written by tests.
- API behavior: added session-backed `POST /api/pusher/auth`; cron business responses are unchanged after successful authentication.
- Learning Hub implementation: secure realtime/cron foundation only; no Learning Hub model, migration, or feature UI.

The four memory files the task asked to read first did not exist at baseline. Task 00 creates the complete memory set from the supplied references, the tracked playbook at HEAD, and current repository evidence.

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
/homepage
/mentor/[mentorId]
/policies/cancellation
/profile
/profile/[id]
/suspended
/wallet
```

There is no current `/learning` or `/api/learning` route.

## Current schema

`prisma/schema.prisma` has 462 lines and validates. Current models are User, Skill, UserSkill, AvailableSlot, Booking, Review, MentorReview, Account, Session, VerificationToken, TransactionLog, TrustHistory, Report, Notification, Conversation, Message, and WithdrawRequest.

Booking currently has mentor/mentee, optional unique slot, start/end time, BookingStatus, note, meeting URL, review/transaction/conversation relations, blind-review state, absence-report fields, and reports. It has no LearningSpace, topic, learning mode, objective, definition of done, FulfillmentStatus, `deliveredAt`, or `acceptedAt` fields.

Current BookingStatus values are `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `MISSED`, and `DISPUTED`. FulfillmentStatus does not exist. No Learning Hub model exists.

The data source is PostgreSQL with `DATABASE_URL`, `DIRECT_URL`, and the pgvector extension. The repository uses Prisma 5.22.0 and notes `prisma db push`; it has no standard `prisma/migrations` history.

## Current migrations

Only `prisma/migrations-manual/` exists:

- `001_skill_category_to_enum.sql`: converts legacy Skill category strings to SkillCategory; drops/renames columns after backfill.
- `002_skill_embedding_readiness.sql`: additive BR-11 readiness fields, audit backup, vector eligibility check; explicitly reviewed/manual.
- `003_withdrawal_rejection_atomic_refund.sql`: adds `REFUND_WITHDRAWAL_REJECTED` to TransactionType.

No Task 00 migration was created or applied.

## Current scripts

Package scripts:

- `dev`, `build`, `start`, `lint`.
- `db:generate`, `db:push`, `db:seed`, `db:backfill-embeddings`, `db:backfill-transactions`, `db:migrate-skill-category`.
- `postinstall` runs Prisma generate.

Repository scripts:

- Interactive/provider or data-changing: `scripts/google-oauth-setup.ts`, `scripts/seed-users.ts`; Prisma seed/backfill/migration/admin utilities under `prisma/`. Not run in Task 00.
- Offline regressions: `scripts/test-cancellation-preview.cjs`, `scripts/test-pa02-deadlines.cjs`, `scripts/test-quiz-publication.cjs`, `scripts/test-skill-approval.cjs`, `scripts/test-withdrawal-rejection.cjs`.
- No package-level `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, or `test:regression` command exists yet; Task 01 owns that harness.

## Environment variable names

Values were not read or recorded.

`.env`: `CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_SHOW_DEV_BAR`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_URL`, `VNP_HASHSECRET`, `VNP_RETURNURL`, `VNP_TMNCODE`, `VNP_URL`.

`.env.restore-test`: `RESTORE_DATABASE_URL`.

## Verified current findings

### Client-controlled identity in chat

- `src/app/api/conversations/route.ts` GET accepts `userId` from query and returns that user's conversation list without session authentication.
- The same route POST accepts body `userId`; it checks that supplied ID is a Booking participant but does not bind it to the server session.
- `src/app/api/messages/route.ts` GET accepts `conversationId` and optional query `userId`/viewerId, returns messages without membership/session authorization, and uses the supplied viewer ID when marking messages read.
- The same route POST accepts body `senderId`; it checks that supplied ID is a conversation participant but does not bind it to the server session.
- `src/lib/pusher-client.ts` documents `conversation-<id>` as a public channel; no channel authorization endpoint exists.

### Current auto-complete behavior

- `src/app/api/cron/auto-complete/route.ts` computes `cutoffTime = now - 72 hours`.
- It selects every Booking where `status = CONFIRMED` and `endTime < cutoffTime`; no mode or fulfillment predicate exists.
- It conditionally changes status to COMPLETED in a transaction, credits the mentor one GivePoint, creates a BOOKING_COMPLETED TransactionLog, and sends best-effort notifications.
- Its optional `CRON_SECRET` guard is commented out, while middleware treats all `/api/cron` routes as public.
- `review-deadlines` uses the same endTime-based 24/46/48/72-hour window and does enforce `CRON_SECRET` when configured, refusing an unset secret only in production.

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

## Next task assumptions

- A2 must enforce auto-complete cron authentication and private realtime before private artifacts.
- B1 must not use `prisma db push` against shared/legacy data; it needs reviewed SQL, clean and representative legacy tests, and rollback evidence.
- Existing baseline failures remain separate from task-introduced failures and must not be hidden by skips or weakened assertions.

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
