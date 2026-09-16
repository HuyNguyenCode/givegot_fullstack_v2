# Learning Hub Context Packet

## Read order

1. `MASTER_SPEC.md` for product requirements and invariants.
2. `ARCHITECTURE_DECISIONS.md` for accepted design decisions.
3. `IMPLEMENTATION_STATE.md` for the latest code and test baseline.
4. The relevant task in `IMPLEMENTATION_PLAN.md`.
5. Relevant rows in `TEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, and `RISK_REGISTER.md`.

## Current checkpoint

- Task A1 completed on 2026-09-12 from branch `feature/learning-hub-mvp`, HEAD `b2342f4c07430c2441ae4bcc2ec410fc27dfefb1`.
- Reusable server authorization derives identity from NextAuth `auth()` and defines authenticated-user, conversation-participant, admin, and future LearningSpace-member guards.
- Conversations/messages are session-scoped; legacy `userId`/`senderId` fields remain compatible but do not authorize or choose the actor.
- Concrete booking/review, notification, and admin spoofing paths in the A1 scope are session-bound and action-level admin guards are enforced.
- No Learning Hub schema field, model, migration, database row, or visible UI flow was added.
- Typecheck, targeted lint, A1 unit/integration tests, legacy regression, and production build pass.
- Full lint retains pre-existing debt: 77 errors and 32 warnings. A touched pre-existing booking `any` was safely typed, reducing the baseline error count by one.

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

## Security state after A1

- CLOSED: `/api/conversations` GET/POST scope identity to the server session; changing legacy `userId` values cannot enumerate another user's conversations or create/open a Booking conversation as that user.
- CLOSED: `/api/messages` GET checks session plus conversation participation before returning data or changing read state.
- CLOSED: `/api/messages` POST checks session plus participation and always persists the session user as sender.
- CLOSED IN A1 SCOPE: Booking lifecycle/review actor IDs and private Booking list/receipt reads are session-bound; notification reads/read-state are session-bound; internal notification creation is no longer a server action; admin actions guard role at the action boundary.
- Pusher conversation channels are documented as public; no authorization route exists.
- Auto-complete selects `CONFIRMED` plus `endTime < now - 72h`, with no mode/fulfillment predicate.
- Auto-complete's `CRON_SECRET` block is commented out; middleware exposes `/api/cron`.
- Other legacy action families outside the explicitly audited A1 boundaries still require case-by-case authorization review before they are reused for Learning Hub data.

## Current repository shape

- Next.js 16.1.6 App Router, React 19.2.3, NextAuth 5 beta, Prisma/PostgreSQL 5.22.0.
- Existing user routes: auth, homepage, discover, mentor, booking, dashboard, chat, history, wallet, profile, admin.
- Existing APIs: auth, conversations, messages, three cron routes, two test routes, and three VNPay routes.
- Schema has 17 models; none are Learning Hub models and Booking has no Learning Hub fields.
- Only manual migrations 001 skill category, 002 embedding readiness, and 003 withdrawal refund exist.
- Canonical commands are `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, and `test:regression`.

## Environment names only

`CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_SHOW_DEV_BAR`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_URL`, `VNP_HASHSECRET`, `VNP_RETURNURL`, `VNP_TMNCODE`, `VNP_URL`, `RESTORE_DATABASE_URL`.

## Next task

Task A2 only: secure private realtime subscriptions and enforce production cron authentication. Do not start schema task B1 until A2's critical realtime/cron gates are closed.

## Completion contract

For each task: check every requirement; list changed files and reasons; report schema/migration/API/visible behavior; report compatibility and rollback; run task and regression tests; distinguish pre-existing failures; update state/context/test/changelog; record exact next assumptions; end with PASS, PASS WITH KNOWN LIMITATION, or BLOCKED; then stop.

## Task 01 completion

- Task 01 completed on 2026-09-12 with a dependency-free `node:test` plus existing `tsx` harness; no full test framework was added.
- Canonical commands are `npm run typecheck`, `npm run test:learning-hub`, `npm run test:learning-hub:integration`, and `npm run test:regression`.
- The integration smoke test imports legacy conversations, messages, and auto-complete routes without a server, database, provider, dotenv load, or secret output. Future database suites require an explicit `DISPOSABLE_TEST_DATABASE_URL` and must reject production/shared targets.
- Current verification passed Prisma generate/validate, typecheck, unit, integration, legacy regression, and build. Lint remains the unchanged baseline failure: 78 errors and 32 warnings.

## Task A1 completion

- Task A1 completed with no schema, migration, database, settlement-policy, or visible UI change.
- Existing chat callers may continue sending legacy identity fields, but the server ignores them for authorization and authorship.
- The A1 suites cover missing session, spoofed query/body actor, nonparticipant IDOR/read-state, session-owned sender, legitimate list/read/send, admin role behavior, and Booking-to-chat association.
- A2 may rely on `requireAuthenticatedUser` and `requireConversationParticipant` when authorizing private Pusher channels.
- B1 may implement `LearningSpaceMembershipLookup` without changing the A1 server-session identity contract.
- Remaining critical blockers before private Learning Hub payloads are R-002 public realtime and R-003 cron authentication.
