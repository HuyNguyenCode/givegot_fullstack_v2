# Learning Hub Implementation State

## Checkpoint

- Recorded: 2026-09-11, Asia/Saigon.
- Branch: `feature/learning-hub-mvp`.
- HEAD before Task 00 authoring: `970a033af38ffc2580e3c5bce11fbd3834dc4244`.
- Task: 00 Control plane and baseline.
- Status: PASS WITH KNOWN LIMITATION.
- Production behavior: unchanged.
- Schema/migration/API behavior: unchanged.
- Learning Hub implementation: not started.

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

- Task 01 starts from this checkpoint and creates the minimal test harness only.
- A1 must precede private Learning Hub data because current chat routes and many server actions accept client identity.
- A2 must enforce auto-complete cron authentication and private realtime before private artifacts.
- B1 must not use `prisma db push` against shared/legacy data; it needs reviewed SQL, clean and representative legacy tests, and rollback evidence.
- Existing baseline failures remain separate from task-introduced failures and must not be hidden by skips or weakened assertions.
