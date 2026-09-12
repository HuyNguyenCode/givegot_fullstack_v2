# Learning Hub Context Packet

## Read order

1. `MASTER_SPEC.md` for product requirements and invariants.
2. `ARCHITECTURE_DECISIONS.md` for accepted design decisions.
3. `IMPLEMENTATION_STATE.md` for the latest code and test baseline.
4. The relevant task in `IMPLEMENTATION_PLAN.md`.
5. Relevant rows in `TEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, and `RISK_REGISTER.md`.

## Current checkpoint

- Task 00 completed documentation only on 2026-09-11.
- Branch `feature/learning-hub-mvp`; baseline HEAD `970a033af38ffc2580e3c5bce11fbd3834dc4244`.
- No Learning Hub feature, API, schema field, model, migration, or package script was added.
- Current application build passes; TypeScript passes; Prisma schema validates.
- Prisma generation fails on a locked Windows query-engine DLL.
- Lint baseline fails with 78 errors and 32 warnings.
- Five current offline regression scripts pass.

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

## Verified current gaps

- `/api/conversations` GET/POST accepts client `userId` and does not bind it to `auth()`.
- `/api/messages` GET has no participant/session guard and trusts optional client viewer ID for read state.
- `/api/messages` POST accepts client `senderId`; participant comparison does not prove the caller is that sender.
- Pusher conversation channels are documented as public; no authorization route exists.
- Auto-complete selects `CONFIRMED` plus `endTime < now - 72h`, with no mode/fulfillment predicate.
- Auto-complete's `CRON_SECRET` block is commented out; middleware exposes `/api/cron`.
- Many legacy server actions accept actor-like user IDs; A1 must inventory and bind protected paths to session.

## Current repository shape

- Next.js 16.1.6 App Router, React 19.2.3, NextAuth 5 beta, Prisma/PostgreSQL 5.22.0.
- Existing user routes: auth, homepage, discover, mentor, booking, dashboard, chat, history, wallet, profile, admin.
- Existing APIs: auth, conversations, messages, three cron routes, two test routes, and three VNPay routes.
- Schema has 17 models; none are Learning Hub models and Booking has no Learning Hub fields.
- Only manual migrations 001 skill category, 002 embedding readiness, and 003 withdrawal refund exist.
- Package has no canonical typecheck or Learning Hub/regression test scripts; Task 01 owns them.

## Environment names only

`CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_SHOW_DEV_BAR`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_URL`, `VNP_HASHSECRET`, `VNP_RETURNURL`, `VNP_TMNCODE`, `VNP_URL`, `RESTORE_DATABASE_URL`.

## Next task

Task 01: create a minimal test harness and canonical package commands. It may add test infrastructure but must not implement Learning Hub features or weaken existing regressions. Required future commands are `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, and `test:regression`.

## Completion contract

For each task: check every requirement; list changed files and reasons; report schema/migration/API/visible behavior; report compatibility and rollback; run task and regression tests; distinguish pre-existing failures; update state/context/test/changelog; record exact next assumptions; end with PASS, PASS WITH KNOWN LIMITATION, or BLOCKED; then stop.
