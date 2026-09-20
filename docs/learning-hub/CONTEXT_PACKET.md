# Learning Hub Context Packet

## Read order

1. `MASTER_SPEC.md` for product requirements and invariants.
2. `ARCHITECTURE_DECISIONS.md` for accepted design decisions.
3. `IMPLEMENTATION_STATE.md` for the latest code and test baseline.
4. The relevant task in `IMPLEMENTATION_PLAN.md`.
5. Relevant rows in `TEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, and `RISK_REGISTER.md`.

## Current checkpoint

- Tasks D1, C2, E1, and F1 completed after B2’s protected LearningSpace domain service work and C1’s invite backend. The narrow E1 AvailableSlot repair completed on 2026-09-18; F1 private storage infrastructure completed on 2026-09-20.
- LearningSpace and LearningTopic have server-session-backed protected service/API handlers. Direct and confirmed-Booking creation create exactly two active members; a transaction-scoped advisory lock rejects a third active member.
- Primary-skill changes are versioned and audited. Objective/definition updates use optimistic concurrency. Topics are free-form or canonically mapped, and archive state preserves historical Booking references.
- Reuse suggestions return matching active pair spaces without forcing reuse or imposing pair-plus-skill uniqueness. Archived spaces remain readable to members and only restore is allowed among normal mutations.
- `/api/pusher/auth` authorizes private LearningSpace channels through active membership. C1 provides `/api/learning/invites` create, preview, accept, and inviter-revoke APIs; C2 now provides the invite-onboarding UI for those APIs.
- LearningInvite creation returns a 256-bit raw token once and stores only SHA-256. Acceptance is session-bound, transactionally locked/idempotent, and supports an explicit matching active-space reuse or a distinct new space for the same pair. It rejects self, expired, revoked, exhausted, different-user replay, and third-member outcomes.
- Logged-out preview stores the raw token only in a ten-minute AES-GCM encrypted HttpOnly/SameSite=Lax continuation cookie, cleared after acceptance. No email is sent in C1.
- D1 adds the server-session/member-authorized, mobile-first `/learning/[spaceId]` shell. It is read-only; it shows pair/skill/topics/objective/definition/Booking context, archive state, rebooking, and future artifact placeholders. At the D1 checkpoint, invite onboarding was not part of the shell; C2 subsequently delivered it. Resource, task, note, provider, fulfillment, settlement, Discover, social graph, and legacy Booking lifecycle work remain out of scope.
- C2 adds the minimum Bring Your Pair onboarding UI: `/learning/new` creates a one-use link from an approved primary skill and optional objective, while `/learning/invite/[token]` previews active invite data, uses C1's encrypted login continuation, and accepts through the server-session endpoint. Stale links reveal no pair metadata; the new LearningSpace presents only the existing first-Booking action. Resource/task creation remains out of scope.
- E1 carries LearningSpace context into Booking creation after server-session pair authorization and transaction-time validation. LIVE/HYBRID now select future unbooked mentor slots and use the existing `bookAvailableSlot` row-lock path; direct `createBooking` rejects those linked modes before side effects. EXERCISE_REVIEW and unlinked legacy creation retain their prior manual-time behavior.
- LIVE, EXERCISE_REVIEW, and HYBRID now have executable required-artifact and completion-readiness contracts. Async and Hybrid timing is expressed from `deliveredAt`/artifact deadlines and not Meet `endTime`; no fulfillment transition, settlement, or cron behavior is implemented by E1.
- F1 adds an S3-backed provider interface, private-bucket template, five-minute direct upload POST, provider-confirmed metadata and content-signature finalize, ten-minute signed attachment download, 20 MiB allowlist, 500 MiB per-space quota, soft deletion, and secret-protected orphan cleanup. It reuses the B1 LearningResource model without schema or legacy data changes. Typecheck, targeted lint, 41 unit tests, 35 integration tests after route smoke, five legacy regressions, and the 35-page build passed with mocked storage; the Windows `tsx` host preload was temporary and removed. Later lint reconciliation classifies 151 errors/34 warnings as 77/32 unrelated legacy debt plus 74/2 B2/C1 debt; F1 has zero findings.

- Later lint reconciliation: no lint scope/configuration or generated/temp-file contribution exists. B2 introduced 46 errors/one warning and C1 introduced 28 errors/one warning, all 74 errors being `@typescript-eslint/no-explicit-any` and both warnings known unused variables. An isolated B2/C1 lint repair is required before F2; until then, 151 errors/34 warnings is the observed full-repository comparison baseline.

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

## Security state after A2

- CLOSED: `/api/conversations` GET/POST scope identity to the server session; changing legacy `userId` values cannot enumerate another user's conversations or create/open a Booking conversation as that user.
- CLOSED: `/api/messages` GET checks session plus conversation participation before returning data or changing read state.
- CLOSED: `/api/messages` POST checks session plus participation and always persists the session user as sender.
- CLOSED IN A1 SCOPE: Booking lifecycle/review actor IDs and private Booking list/receipt reads are session-bound; notification reads/read-state are session-bound; internal notification creation is no longer a server action; admin actions guard role at the action boundary.
- CLOSED: conversation and user-targeted realtime channels are private and authorized from the server session; guessed conversation/user IDs fail before Pusher signing.
- CLOSED: LearningSpace channel names are private and authorized through B2's active-membership lookup.
- Auto-complete selects `CONFIRMED` plus `endTime < now - 72h`, with no mode/fulfillment predicate.
- CLOSED: auto-complete, reminders, and review-deadlines enforce the shared production `CRON_SECRET` guard; middleware exposure does not bypass route authentication.
- Other legacy action families outside the explicitly audited A1 boundaries still require case-by-case authorization review before they are reused for Learning Hub data.

## Current repository shape

- Next.js 16.1.6 App Router, React 19.2.3, NextAuth 5 beta, Prisma/PostgreSQL 5.22.0.
- Existing user routes: auth, homepage, discover, mentor, booking, dashboard, chat, history, wallet, profile, admin.
- Existing APIs: auth, conversations, messages, existing cron routes plus F1 storage cleanup, two test routes, three VNPay routes, and `/api/pusher/auth`. Current Learning Hub APIs are `/api/learning/spaces/*` (including F1 file boundaries) and `/api/learning/invites/*`.
- Schema has 27 models, including the ten Learning Hub domain models. Booking has eight nullable Learning Hub fields and keeps its original status enum unchanged.
- Manual migration 004 adds the Learning Hub domain additively, with an executable rollback plus a production rollback note. It performs no historical backfill.
- Canonical commands include `typecheck`, `test:learning-hub`, `test:learning-hub:integration`, `test:learning-hub:migration`, and `test:regression`.

## Environment names only

`AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `LEARNING_STORAGE_BUCKET`, `CRON_SECRET`, `DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN`, `NEXT_PUBLIC_PUSHER_APP_KEY`, `NEXT_PUBLIC_PUSHER_CLUSTER`, `NEXT_PUBLIC_SHOW_DEV_BAR`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `PUSHER_APP_ID`, `PUSHER_SECRET`, `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE`, `SUPABASE_URL`, `VNP_HASHSECRET`, `VNP_RETURNURL`, `VNP_TMNCODE`, `VNP_URL`, `RESTORE_DATABASE_URL`.

## Next task

Task F1 private storage infrastructure is complete with PASS WITH KNOWN LIMITATION because private S3 deployment, server-only AWS credentials, and the configured CORS origin remain pending; no production upload was attempted. Active members may read files in an archived space, while archived spaces accept no file mutations. A previously issued signed download URL can remain usable until its at-most-ten-minute expiry when provider deletion fails. LearningSpace LIVE/HYBRID retain the locked AvailableSlot path; EXERCISE_REVIEW and unlinked Bookings retain their E1/legacy-compatible paths. The lint delta is classified: 77/32 unrelated legacy debt and 74/2 B2/C1 debt; F1 has zero findings, and isolated B2/C1 lint repair is required before F2. F2 Resource domain and UI must consume the storage-service abstraction rather than depend directly on AWS SDK/S3 behavior; do not begin it, G1 artifacts, fulfillment, settlement, or mode-aware cron automatically.

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
- Later correction (2026-09-20): this preserves the B2 checkpoint result. The current 151/34 result is now classified as 77/32 unrelated legacy debt, 46/1 B2 debt, and 28/1 C1 debt; repair the B2/C1 findings before F2.
- Compatibility/rollback: no schema/data migration or backfill; legacy Bookings with null Learning Hub fields remain unchanged/readable. Rollback is file-level reversion of B2 routes, services, tests, realtime authorizer wiring, and docs.
- At the B2 checkpoint, C1 was the next planned task; it is now complete.
