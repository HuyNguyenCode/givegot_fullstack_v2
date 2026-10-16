# Learning Hub Implementation State

## Current H1/LH 050 checkpoint (reconciled 2026-10-16)

H1 implementation is COMPLETE in the preserved working tree. The UI labels the existing audited soft delete “Xóa ghi chú”; ADR 019 still governs privacy and deletion. Migration 007 passed disposable Supabase TEST forward, legacy/default/enum/index checks, safe rollback, unsafe rollback refusal, and fixture cleanup. Owner-authorized STAGING forward application, schema checks, and Prisma Notes queries passed. No PRODUCTION migration was performed.

The initial implementation checkpoint passed 123/123 Learning Hub unit tests, 58/58 integration tests, five legacy regressions, typecheck, targeted lint, and build. The latest H1-11 repair checkpoint passed 9/9 focused Notes unit tests, 2/2 Notes route tests, five legacy regressions, typecheck, targeted lint, and diff check; no newer full-suite run is claimed. The owner reports browser cases H1-01 through H1-20 20/20 PASS, including H1-10 soft delete and H1-19 Booking ownership, with H1-09 stale edit, H1-11 archived/deleted-note recovery, and H1-15 network retry retested PASS. These browser results are owner-reported, not independently reproduced or automated; browser automation was not run.

Deferred H1-UX-01 (long/many note scrolling) and H1-UX-02 (top editor scrolling) are P2 UX backlog, not H2 blockers. Future group learning and multi-learner slots remain Post-MVP design work. H2/LH 060 is the NEXT SAFE TASK and is NOT STARTED. I1/I2/I3 and J1 remain pending; fulfillment, GivePoint settlement, and cron risks remain open. Dated sections below retain their original checkpoint scope.

## H1-11 archived-note recovery (2026-10-16)

Status: PASS WITH KNOWN LIMITATION. When another tab archives the edited note, its next GET response no longer falls back to the stale edit object. The client removes that edit target, disables save, and leaves the current textarea content available for copying. It never recreates or restores the archived note. A 404 update response now has Vietnamese recovery copy; a successful reload explains that the note was archived elsewhere and that the draft is available to copy.

- Scope: `LearningNotes` client state and focused H1 tests only. Server authorization, version claims, types, visibility, soft-deletion semantics, Booking, GP, AI, schema, and migrations are unchanged.
- Verification: `npx tsc --noEmit`, targeted ESLint, focused Notes unit 9/9, Notes route tests 2/2, `git diff --check`, and all five legacy regression scripts PASS. Focused coverage includes archived note while editing, 404 recovery, absent-note reload, disabled repeat save, no resurrection, and retained draft text. Browser automation was not run.

## H1 Notes recovery UX repair (2026-10-16)

Status: PASS WITH KNOWN LIMITATION. Confirmed the existing retry button already invoked the Notes GET handler. The handler left the old error visible after a successful response, surfaced browser-native `Failed to fetch`, and kept the stale edit base version. Reload now fetches the list, clears errors only after a valid response, refreshes the edited note's server version, and preserves the editor fields as the unsaved draft. A visible status message tells the member that the draft was retained. Failed reloads retain a concise Vietnamese retry message; retry performs no POST or PATCH.

- Scope: only `LearningNotes` client recovery state and focused H1 test evidence changed. Server session authorization, note types and visibility, conditional version checks, soft deletion, archive behavior, Booking ownership, and recap behavior are unchanged. No database, migration, Booking, GivePoint, fulfillment, or AI path was touched.
- Verification: `npx tsc --noEmit`, focused Notes unit 9/9, focused Notes route tests 2/2, targeted ESLint, `git diff --check`, and all five legacy regression scripts PASS. The regular Windows `tsx` launcher still fails before discovery due the documented host `uv_os_get_passwd` issue; the focused tests passed with the established temporary getEUID preload, which was removed afterward. Browser automation was not run.

## Historical H1 migration 007 STAGING application (2026-10-16)

Status: PASS WITH KNOWN LIMITATION. Owner-authorized migration 007 was applied once to the configured GiveGot STAGING Supabase project through the established Linux manual-migration path and application `DIRECT_URL`. Local identity guards confirmed `DATABASE_URL`, `DIRECT_URL`, and `SUPABASE_URL` identify the same documented application project and that it differs from `DISPOSABLE_TEST_DATABASE_URL`; no secret or connection string was printed. No TEST or PRODUCTION database was connected during this application.

- Prerequisites: PASS. `LearningNote`, `LearningSpace`, and `Booking` existed; the pre-H1 LearningNote columns and visibility enum were intact; migrations 005/006 prerequisites (`LearningTask.version` and `LearningResource.purpose`) existed; and all migration 007 columns, enum, and index were absent. There was no partial migration state. STAGING contained zero LearningNote rows before application.
- Execution: PASS. Only `prisma/migrations-manual/007_learning_note_type_soft_delete.sql` ran. No `db push`, reset, unrelated migration, row deletion, database recreation, or rollback ran. A second read-only invocation detected the complete state and did not reapply migration 007.
- Post-migration: PASS. `LearningNoteType` has exactly `GENERAL` and `RECAP`; `LearningNote.type` is non-null with the `GENERAL` default; `deletedAt` and `deletedById` are nullable; and `LearningNote_learningSpaceId_deletedAt_createdAt_idx` exists. Prisma LearningNote list/count queries succeeded. Pre/post snapshots confirmed LearningNote, Booking, and LearningSpace data were unchanged; the LearningNote preservation check was vacuous because the table was empty.
- Verification: focused H1 service/render/route tests passed 7/7 after application. Prisma schema validation and task typecheck/targeted lint were already clean in the authoritative source. Browser UI verification was not executed, so visible Notes behavior on the deployed STAGING application remains unverified.
- Source: authoritative HEAD `d63be35759d8b054e1d3e29eff0ee752351b86c5` plus the preserved uncommitted H1 implementation and migration files. No H2 or Booking/GP/settlement work was started.

## Historical H1 manual notes and recap implementation (2026-10-16)

Status: PASS WITH KNOWN LIMITATION. H1/LH 050 adds manual private notes and recaps only. The starting tree was clean; no pre-existing user change was overwritten.

- Schema/migration: additive LearningNoteType (GENERAL/RECAP), type default GENERAL for old rows, deletedAt/deletedById for audited soft deletion, and an active-list index. Migration 007 matches Prisma's schema diff. No Booking column, BookingStatus, fulfillment, ledger, provider, notification, cron, or AI path changed. No shared database was touched; live forward/rollback migration rehearsal remains a deployment gate.
- API: GET/POST /api/learning/spaces/[spaceId]/notes and GET/PATCH/DELETE item routes. Server session supplies author identity. ACTIVE unsuspended members read according to SPACE_MEMBERS, BOOKING_PARTICIPANTS, or AUTHOR_ONLY visibility. Booking scope requires the same space and author participation. Archived spaces remain readable but reject writes. Only the author edits or soft deletes. Conditional version claims return 409 on stale edits. Deleted rows retain content, author, version, and deletedById for audit but are invisible to normal reads.
- UI: the LearningSpace notes tab now provides a mobile-sized plain-text editor, visibility and optional linked Booking selection, safe escaped rendering, author actions, and an optional recap prompt after an ended eligible linked session. Legacy Bookings without a LearningSpace have no new mandatory step. No chat is ingested and note content is not sent to AI.
- Verification: Prisma generate/validate, typecheck, focused H1 7/7, full Learning Hub unit 123/123, integration 58/58 plus route smoke, five legacy regression scripts, targeted ESLint, schema diff parity, and git diff --check passed. The Windows tsx host hit the pre-existing uv_os_get_passwd ENOMEM before discovery; the unchanged suites passed with the documented one-command host preload, removed after use. Production build PASS (35 static pages and new dynamic notes routes; existing middleware warning). On 2026-10-16, the existing Linux `givegot-test-linux` workspace rehearsed migration 007 only through its isolated `DISPOSABLE_TEST_DATABASE_URL`: source parity, connection isolation, `SELECT 1`, pre-H1 schema prerequisites, forward migration, legacy/default/enum/index/soft-delete checks, unsafe rollback refusal, allowed rollback, unrelated Booking/LearningSpace preservation, and run-owned fixture cleanup all passed. The tested source was authoritative HEAD `d63be35759d8b054e1d3e29eff0ee752351b86c5` plus the uncommitted H1 source, migration, and focused rehearsal test files; the synchronized critical files matched byte-for-byte. The TEST schema was returned to pre-H1 after the rollback. No STAGING or PRODUCTION connection or migration ran. Manual browser smoke remains unverified.
- Compatibility/rollback: old LearningNote rows read as GENERAL with SPACE_MEMBERS and version 1; old Booking/dashboard/history behavior remains. Roll back application files directly. Migration rollback refuses to discard RECAP or soft-deleted rows; after H1 writes, preserve data and roll forward.
- Next assumptions: H2 can derive structured note events separately without copying note content. I1-I3 retain fulfillment and settlement ownership; P2 AI requires explicit source consent and is not authorized by H1.


## Historical G3 checkpoint (reconciled 2026-10-16)

- G3/LH 042 implementation: COMPLETE in the preserved uncommitted working tree. Authoritative repository `F:\givegot\givegot-v2`, branch `feature/learning-hub-mvp`, HEAD `3e0cb6f8c2bf0d009195f0305f8979b7fccd516b` (D0e committed). This was the G3 checkpoint at that reconciliation; older checkpoint sections below retain their original temporal scope, counts, limitations, and outcomes.
- Automated implementation evidence (historical 2026-10-15): unit 118/118, integration 56/56 plus smoke, five legacy regressions, typecheck, targeted lint, production build, and diff checks PASS. Full lint retained unrelated 77 errors/32 warnings. Focused G2/G3 mock rerun on 2026-10-16: 18/18 PASS. These are separate historical results, not tests rerun or combined into a new total by this reconciliation.
- Real PostgreSQL evidence (2026-10-16): G3 concurrency VERIFIED; R1-R5 passed in seven controlled cases through the established Linux/disposable Supabase TEST environment, with independent overlapping real Prisma/PostgreSQL transactions where applicable, invariant/isolation assertions, and verified cleanup of all seven synthetic fixtures. The real PostgreSQL concurrency limitation is CLOSED for those schedules; no claim covers every theoretical interleaving. Detailed original run evidence follows below.
- Owner manual evidence: all G3-M01 through G3-M13 accepted as owner-reported PASS, as individually recorded below. No independent reproduction, screenshots/logs, Playwright execution, or automated E2E evidence is claimed. At that G3 reconciliation, this superseded earlier browser-unverified statements without changing the earlier reports.
- Task creator owns review authorization. REVIEWED completes LearningTask and sets Submission REVIEWED, not Booking completion/fulfillment or GP release. REVISION_REQUESTED reopens G2 editing through the dual REVISION_REQUESTED state. Duplicate/stale decisions return 409. Private feedback does not update public Review/Trust. No GP settlement, Booking fulfillment, notification, or cron change is implied; ADR 018 is unchanged.
- I1/I2/I3 and J1 remain pending. At this historical G3 checkpoint, H1 was the next safe task in the dependency registry (D1 complete), had NOT STARTED, and was not authorized by that documentation task. Unresolved GP/fulfillment/settlement/cron business risks remain open; no unrelated risk is closed.
- Documentation reconciliation only: F-01 current-state contradictions corrected; F-02 owner evidence and M08 scope recorded; F-03 regression checkpoint added; F-04 older current headings given historical scope. No tests/build/database verification were rerun and no production/test/schema/migration/config, WSL, database, or git staging/commit operation was performed.

### Owner-reported G3 manual browser evidence (recorded 2026-10-16)

OWNER-REPORTED MANUAL BROWSER SMOKE: 13/13 PASS — not independently reproduced or automated.

| Case ID | Owner-reported result |
| --- | --- |
| G3-M01 | PASS |
| G3-M02 | PASS |
| G3-M03 | PASS |
| G3-M04 | PASS |
| G3-M05 | PASS |
| G3-M06 | PASS |
| G3-M07 | PASS |
| G3-M08 | PASS — UI-level reviewer permission |
| G3-M09 | PASS |
| G3-M10 | PASS |
| G3-M11 | PASS |
| G3-M12 | PASS |
| G3-M13 | PASS |

G3-M08 verifies that the assignee cannot see feedback input or review actions on tasks created by the other participant. The assignee may still view authorized feedback and resubmit after a revision request. No separate review page or review URL is required. Backend authorization is supported by separate automated tests, not inferred from this UI check. Other case descriptions, screenshots, execution logs, or automation were not supplied by this reconciliation and are not invented.

## Historical G3 real PostgreSQL verification checkpoint (2026-10-16)

The following preserves the verification-only report before the later owner-manual reconciliation. Its browser-unverified statement describes that checkpoint, not the current owner-reported acceptance above.

- Verification-only status: PASS. G3 REAL POSTGRESQL CONCURRENCY: VERIFIED for the seven controlled cases below. This closes the real-PostgreSQL concurrency limitation recorded on 2026-10-15; it does not claim exhaustive schedules or browser smoke. Historical implementation/test results below remain intact. No production code, schema, migration, application DB, H1, I1, settlement, or notification work was changed or executed.
- Authoritative checkout: `F:\givegot\givegot-v2`, HEAD `3e0cb6f8c2bf0d009195f0305f8979b7fccd516b`, branch `feature/learning-hub-mvp`. All pre-existing uncommitted G3 source/test/docs changes were preserved. Added only the explicit PostgreSQL verifier `tests/learning-hub/postgres/learning-g3-race.test.ts` and evidence in IMPLEMENTATION_STATE, TEST_MATRIX, and CHANGELOG; risk classifications are unchanged.
- REAL POSTGRESQL environment: established Linux workspace `/home/huynguyenquoc/givegot-test-linux` via WSL; Node `22.23.3`, Prisma/client `5.22.0`, tsx `4.21.0`, dotenv `17.3.1`. Only Linux-local `.env` `DISPOSABLE_TEST_DATABASE_URL` was connected. Local guards verified URL inequality and different Supabase project identities versus both application DATABASE_URL and DIRECT_URL. Application URLs were compared locally, never connected or printed. No Windows connection troubleshooting, D0a verifier role, TLS override/approval, migration, reset, or provider was used.
- Source synchronization: copied exactly the verifier's 17-file manifest (G2/G3 and transitive auth/task/resource/Prisma dependencies, schema/config/lockfile, and relevant mock tests) from `/mnt/f/givegot/givegot-v2`. Existing Linux source copies were preserved in `/home/huynguyenquoc/givegot-test-linux/.g3-source-backup-OxueLj`; Linux .env and node_modules were not overwritten. Installed imported package versions matched the authoritative lockfile. Byte parity was asserted before and after execution; Linux-local .env hash was unchanged. The generated-client schema differed only in alignment whitespace; its whitespace-normalized data model matched exactly, so no generation/setup/migration was necessary.
- Execution manifest SHA-256: `bec6e6b5c40521c2bed8ade742c3b51a6b0d7f98163df874cef89dca6df95938`. Authoritative G3 SHA-256: `2538351901dd88561ac912dbc7698d79c7d81aed7d619326b333447e71ecd1e1`; G2: `dff8041e8797e0b5a900dab4d2ba452473560756df3c3ef6d3aecdd5a8d019fb`; Prisma schema: `afbbb66d00d483f118dbc951fa9e71bc3c64d5a50b520127a1d6016d268fa097`. The exact current implementation, rather than stale Linux G3 source, was exercised.
- Read-only preflight PASS: SELECT 1; two concurrently held READ ONLY transactions with distinct backend PIDs `1286726` and `1286725` in the execution run (the separate preflight also passed); current scalar columns/nullability for 13 prerequisite models; exact Task/Submission/review/space/member enums; unique Submission.taskId, SubmissionReview.submissionId, LearningActivity.eventKey indexes; validated RESTRICT review/submission/task ownership foreign keys. TEST schema had no missing prerequisite; no migrations were applied. The runner defaults to this read-only mode and requires `G3_POSTGRES_EXECUTE=1` to create fixtures.
- Real transaction method: actual G3/G2 service factories, injected immutable authenticated synthetic creator/assignee identities, and real membership/pair checks; independent Prisma clients limited to one connection each. The test configures a 30-second transaction timeout but does not replace/mock Prisma $transaction or operations. Test-only middleware pauses after the real Submission.findUnique returns inside each transaction. Both operations read revision 1; PostgreSQL pg_stat_activity independently observed two simultaneous `idle in transaction` backends (`1286728`/`1286729`) at the Submission read for every overlapping case. R2 deliberately releases/commits one before releasing the other; R1/R3 release both together. R4 is the requested stale sequential lifecycle check, not an overlap claim.

| Real case | Observed commit / rejected operation | Final Task / Submission | Revision / review rows / activities |
| --- | --- | --- | --- |
| R1 simultaneous REVIEWED | B committed REVIEWED; A rejected 409 | COMPLETED / REVIEWED | 1 / 1 / 2 |
| R2 REVIEWED wins | A committed REVIEWED; B revision request rejected 409 | COMPLETED / REVIEWED | 1 / 1 / 2 |
| R2 revision request wins | B committed REVISION_REQUESTED; A reviewed rejected 409 | REVISION_REQUESTED / REVISION_REQUESTED | 1 / 1 / 2 |
| R3 duplicate revision requests | B committed; A rejected 409; only B's deadline retained | REVISION_REQUESTED / REVISION_REQUESTED | 1 / 1 / 2 |
| R4 stale review after real G2 resubmit | Revision-1 request rejected 409 with exact DB snapshot unchanged; valid revision-2 review then committed using same review row | COMPLETED / REVIEWED | 2 / 1 / 4 |
| R5 from SUBMITTED | G3 revision request committed; overlapping G2 edit rejected 409, original content retained | REVISION_REQUESTED / REVISION_REQUESTED | 1 / 1 / 2 |
| R5 from REVISION_REQUESTED | G2 resubmit committed; overlapping G3 review of desired revision 2 rejected 409, previous review unchanged | SUBMITTED / SUBMITTED | 2 / 1 / 3 |

- R3 represents two independent requests by the same sole eligible task creator, not two distinct authorized reviewer roles. R5 has no simultaneously eligible edit/review transition from one committed state: G3 requires Task/Submission SUBMITTED, whereas G2 replacement requires both REVISION_REQUESTED. Both actual boundary attempts were overlapped and verified without manufacturing an invalid DB state. The retained R5 review describes revision 1 and is not feedback for the unreviewed new revision 2.
- PostgreSQL assertions checked actual Task version/status/deadline, Submission identity/content/status/revisionCount, single current review identity/content/outcome/reviewer, expected activity count/event keys/outcome metadata, and no duplicate activity. R2 revision winner retained only its deadline `2026-10-18T03:43:28.922Z`; R3 retained only winner B's `2026-10-18T03:43:36.788Z` (synthetic UTC test values). Each successful transition incremented Task.version exactly once. No loser partial writes or forbidden feedback/submission text in activity metadata remained. Snapshot counts and content digests for all TEST Booking, TransactionLog, TrustHistory, public Review, and MentorReview rows, unrelated User GP/Trust values, and each fixture pair's GP/Trust values remained unchanged for each case and after cleanup. No Booking fixture was needed.
- Run identity: `g3-pg-5e7b147c-c91b-4f31-affc-6a8743bd335c`; each fixture marker appends its case label. Synthetic emails use `example.invalid`. Exact synthetic space/task identities are listed below for reproducibility. Cleanup deleted only the run-owned activity/review/submission/task/membership/space/skill/user rows, in dependency order. All eight checked categories returned zero for each of seven fixtures; global unrelated snapshots matched the pre-run baseline and source/config parity rechecked successfully. Run exit 0, FINAL_PASS, seven cases, cleanup verified, zero application connections.

| Fixture suffix | LearningSpace ID | Task ID |
| --- | --- | --- |
| R1 | 32fee880-2352-4c65-b985-95951c3885f6 | b00f3ffb-d441-4543-b3a0-d8b1b52f8eaf |
| R2-reviewed-wins | dacf9dd5-74ab-47c9-bbef-45e01f929846 | cddbb280-c8f0-4c16-8df7-85af6c319358 |
| R2-revision-wins | 554de21b-d757-4758-a30a-0fe3a3f1d110 | f3dfa471-3185-4318-ac95-5efdb5229dce |
| R3 | d9705906-6af1-421f-afd7-fab41928f01d | ef9f363e-5fa5-4714-aed4-3b456c289be2 |
| R4 | 90f0ea8e-8c8c-4443-93f5-60c4b14f0b70 | 735eee3e-09e3-4dd6-b24c-b1993c192045 |
| R5-SUBMITTED | 796cec7b-9fd4-4e73-bbc2-20a619c4f88a | 2deba1f1-985a-4bf3-bf57-1dffeae1e80a |
| R5-REVISION_REQUESTED | 59291263-a448-4e9c-afb2-c0663a521f52 | 6940fe92-bdcc-4d98-a78e-d4711787ba32 |

- Exact Linux commands (after adding the existing Node v22.23.3 bin directory to PATH and entering `~/givegot-test-linux`): `npx --no-install tsx tests/learning-hub/postgres/learning-g3-race.test.ts` read-only preflight PASS; `G3_POSTGRES_EXECUTE=1 npx --no-install tsx tests/learning-hub/postgres/learning-g3-race.test.ts` seven real cases/cleanup PASS. STATIC/MOCK evidence, separate from PostgreSQL: `npx --no-install tsx --test tests/learning-hub/unit/learning-submission-review.test.ts tests/learning-hub/unit/learning-submission-service.test.ts tests/learning-hub/integration/learning-submission-review-routes.test.ts` 18/18 PASS; `npx --no-install eslint tests/learning-hub/postgres/learning-g3-race.test.ts` PASS; Windows `npm run typecheck` PASS. Historical full suites/build/lint were not rerun for this verification-only task.
- Next safe playbook task: H1 (depends on completed D1). This task does not authorize starting H1. G3 browser smoke remains unverified as a separate implementation limitation; there was no G3 production defect or suspected fix from these PostgreSQL cases.

## Historical G3 Submission review and revision checkpoint (2026-10-15)

- Starting checkout: clean on `feature/learning-hub-mvp`, HEAD `3e0cb6f8c2bf0d009195f0305f8979b7fccd516b` (`fix(learning-hub): protect current submission attachments (D0e)`). This supersedes the earlier uncommitted D0e/current-HEAD statements below, which describe their dated checkpoints. The owner explicitly authorized G3 in the implementation prompt.
- Status: PASS WITH KNOWN LIMITATION. LH 042 adds a session-backed private review service, GET/POST `/api/learning/spaces/[spaceId]/tasks/[taskId]/submission/review`, selected-task feedback display/form, service/route/render tests, and route smoke coverage.
- Task creator is the eligible counterpart, regardless of linked Booking mentor/mentee ordering. Active unsuspended membership and task pair, ACTIVE space, scoped Task/Submission, and linked Booking participant/status guards apply. CANCELLED, DISPUTED, and MISSED Bookings reject new reviews; existing authorized feedback remains readable.
- REVIEWED changes Submission to REVIEWED and Task to COMPLETED only. REVISION_REQUESTED changes both records to REVISION_REQUESTED to reopen G2 editing; optional future revisionDueAt uses Task.dueAt, omission preserves it, null clears it. See ADR 018. No Booking fulfillment mutation occurs.
- The client supplies the reviewed Submission ID/revision, never reviewer identity. A Serializable conditional Task version/status and Submission revision/status claim, current-review upsert, and revision-keyed safe activity commit together. Duplicate/stale reviews return 409; P2002/P2034 map to 409. G2 revision count/event semantics and D0e current attachment protection are untouched.
- Prior revision decisions remain in structured audit; prior private content is not snapshotted into activity. The single current review row is retained after resubmit and hidden for the new SUBMITTED revision until reviewed again. Feedback is plain text, member-only, no-store, and independent from public Review/Trust.
- No schema, migration, backfill, production/shared DB operation, real provider call, Booking/fulfillment, GP, wallet/ledger/settlement, Calendar/Meet, notification, or cron changes. Rollback is a source revert; retained review rows/activity remain compatible with the existing schema. Export review rows if downgrading product visibility is a concern; do not erase audit.
- Verification (exit 0 unless stated): `npm run typecheck`; `npx tsx --test tests/learning-hub/unit/learning-submission-review.test.ts tests/learning-hub/integration/learning-submission-review-routes.test.ts` (11/11); `npx tsx --test tests/learning-hub/unit/learning-submission-review-ui.test.ts` (3/3); `npm run test:learning-hub` (118/118); `npm run test:learning-hub:integration` (route smoke plus 56/56); `npm run test:regression` (all five scripts); targeted `npx eslint` across all G3 source/test files, changed task UI, and smoke script (0 errors/warnings); `npm run build` (35 static pages and the new dynamic review route; existing middleware deprecation warning); `git diff --check`. `npm run lint` exits 1 with the unchanged 77-error/32-warning legacy baseline and no G3 finding. The standard focused tsx command exits 1 before discovery with the documented Windows uv_os_get_passwd ENOMEM; the same tests pass with `NODE_OPTIONS=--require=F:/givegot/givegot-v2/.tmp-g3-host-preload.cjs` providing the documented getEUID workaround. The helper is removed after verification. One G3 test assertion initially expected lowercase datetime instead of React's emitted dateTime; it was corrected and the focused/full unit suites rerun successfully.
- Known limitations: browser smoke and real PostgreSQL G3 races have not run; concurrency/rollback tests use an explicitly serialized transactional mock, not a database schedule proof. UI tests exercise rendered controls/request behavior, not mounted browser timing. I1-I3 and J1 remain unimplemented and are not authorized by G3. No commit, stage, push, or deployment was performed.
- Changed-file inventory: `src/lib/learning-submission-review-service.ts` owns validation/auth/state/audit; `src/lib/learning-submission-review-route-handlers.ts` owns JSON/error/cache behavior; `src/app/api/learning/spaces/[spaceId]/tasks/[taskId]/submission/review/route.ts` exposes GET/POST; `src/components/learning/LearningSubmissionReview.tsx` provides private feedback/form controls; `src/components/learning/LearningSubmissions.tsx` mounts them in selected task detail.
- Verification files: `tests/learning-hub/helpers/submission-review-fixture.ts` supplies an isolated rollback-capable transactional mock; `tests/learning-hub/unit/learning-submission-review.test.ts` covers domain/security/state/side-effect invariants; `tests/learning-hub/unit/learning-submission-review-ui.test.ts` covers render/request behavior; `tests/learning-hub/integration/learning-submission-review-routes.test.ts` covers HTTP plus G2 round trip; `scripts/test-learning-hub-smoke.ts` imports the new route.
- Repository memory: `ARCHITECTURE_DECISIONS.md` records ADR 018; `IMPLEMENTATION_STATE.md`, `CONTEXT_PACKET.md`, `IMPLEMENTATION_PLAN.md`, `TEST_MATRIX.md`, `REGRESSION_CHECKLIST.md`, and `CHANGELOG.md` under `docs/learning-hub/` record scope, exact evidence, limitations, rollback, and next assumptions. MASTER_SPEC and RISK_REGISTER required no policy/risk change.

## Historical D0e FILE attachment deletion checkpoint (reconciled 2026-10-14)

D0e is implemented in F1 FILE deletion. The uploader's delete request rechecks ACTIVE membership and LearningSpace state, FILE ownership/state, and current `Submission.attachmentResourceId` references within one short Prisma Serializable transaction. A current reference returns privacy-safe HTTP 409; an unreferenced FILE is conditionally marked DELETED. Prisma `P2034` maps to 409, and provider removal starts only after commit. All FILE purposes receive the same protection. G2's existing Serializable submission transaction, F1 orphan cleanup, schema, migrations, and F2 LINK deletion remain unchanged.

Verification: focused F1 integration 22/22; Learning Hub unit 105/105; Learning Hub integration 53/53; and the real disposable PostgreSQL race suite 4/4 controlled scenarios (submit wins, delete wins, controlled overlap, revision A to B) passed. Typecheck, targeted ESLint, all five offline legacy regression scripts, and `git diff --check` passed. The backend independent audit was `PASS WITH FINDINGS`, with LOW-only documentation findings: already-DELETED legacy FILE rows are not restored; current Submissions that already reference unavailable/deleted legacy FILEs remain unavailable; orphan cleanup is unchanged; and the four real races do not cover every theoretical schedule. The audit reviewed the test source and evidence without independently rerunning database tests.

D0e-UI-001 now recognizes the specific current-Submission FILE conflict and keeps the confirmation open with the Vietnamese explanation and a Close action. D0e-UI-002 hides and guards FILE deletion in ARCHIVED LearningSpaces while preserving reads/downloads. The UI repair changed only `LearningResources.tsx` and its contract test: focused UI 19/19, relevant F1/F2 integration 28/28, typecheck, targeted ESLint, and diff check passed. The owner reports M01-M05 PASS, including M03 and M05 after the repair. No independent UI re-audit or D0e production build was run. D0e remains uncommitted; G3 is NOT STARTED and is not authorized by this checkpoint.

## Historical D0d pre-commit reconciliation (2026-10-13)

D0d, UX1, UX2, and D0d-F1 are implemented and remain uncommitted. D0d-F1 repaired parent-owned per-task upload settlement across task navigation and a per-task G2 pending lock. Its automated verification passed 14/14 focused submission UI tests, 105/105 Learning Hub unit tests, 24/24 relevant integrations, typecheck, targeted ESLint, and `git diff --check`. Production build was not rerun for F1; UX2's build PASS is earlier evidence.

At the UX2 checkpoint, automated checks passed but owner acceptance was blocked by the observed missing task content. The owner later established that affected legacy/test tasks were inserted directly into Supabase without complete content; a newly populated task showed its title, description, and acceptance criteria in the actual UI. This is owner-observed test-data provenance, not a backend or UI fix, and does not rewrite the historical UX2 result. The owner now reports PASS for all D0d browser smoke, including sections, task selection/pagination, draft retention, direct F1/G2, materials separation, existing-file picker, mobile, archived behavior, G2 blocked-request failure/retry, and private file download. The owner also reports PASS for P1-01 upload success after task navigation and upload failure/retry recovery, and P1-02 pending G2 editing lock, task navigation, failure recovery, and retry. These are owner-reported browser results, not independently reproduced automated results. D0e is NOT STARTED and requires owner approval; G3 is NOT STARTED. No next implementation task is selected.

## D0d-F1 two P1 async-state repairs (verified 2026-10-12)

- P1-01: the selected Form previously owned upload busy/error state and could unmount while F1 continued, leaving a remounted form with stale disabled retry/cancel controls. LearningSubmissions now owns per-task upload state and the in-flight guard. Completion or failure updates the mounted parent, retains the correct task draft/READY ID, and unlocks retry/cancel after failure. An already READY file is not re-uploaded.
- P1-02: text and HTTPS link inputs previously remained editable during G2, allowing edits after the sent snapshot to disappear when the form became read-only. LearningSubmissions now owns per-task submit state. Pending G2 disables text, link, file change/removal, picker selection, and submit across task changes; parent guards also reject stale draft updates and duplicate POSTs. Failure unlocks and preserves the draft/READY ID; success displays the returned current Submission. Other tasks remain usable.
- Verification: focused submission UI 14/14; Learning Hub unit 105/105; relevant resource/storage integration 24/24; typecheck; targeted ESLint; and git diff check PASS. Deferred-request state-transition tests cover failure after task switching, retry unlock, duplicate prevention, independent tasks, READY completion after navigation, pending G2 disabled markup, failure retention, and same-ID retry. The Windows tsx host preload was temporary and removed. Production build was not rerun because no route, import, configuration, dependency, or server boundary changed. No database or real provider was used.
- Owner visual review and primary D0d smoke were completed before this repair. Manual acceptance of the two new race scenarios remains pending. The existing harness has no mounted browser DOM; tests exercise request state transitions and server-rendered disabled controls, not browser event timing. D0e and G3 remain unstarted; no commit or push was made.

## D0d-UX2 content visibility and file-control repair (verified 2026-10-10)

- Automated verification: PASS; owner acceptance: BLOCKED on the unexplained running-page discrepancy. The owner rejected D0d-UX1's visual result because the observed page showed statuses but omitted task titles and requirements. Source tracing shows G1 requires title and acceptance criteria at creation, lists full Prisma task rows in createdAt-desc order, and the client reads those rows without a field remap. UX1 JSX already referenced task.title, description, and acceptanceCriteria, while hiding the optional text sections for null values. No stylesheet rule hiding titles was found. The precise cause of the owner's running-page discrepancy is unverified without inspecting that environment's authorized task response or build.
- UX2 renders title-first list rows and a persistent requirements block in the selected desktop/mobile detail. It displays an explicit invalid-title fallback, localized status badge, optional due date, Mô tả bài tập, and Yêu cầu hoàn thành with restrained empty states. The approved 35/65 desktop split, mobile list/detail/back flow, eight-row order-preserving pagination, archived reads, G2 edit gate, in-memory drafts, current Submission, and F1/G2 attachment flow remain. A styled, focusable label now contains the native file input without exposing its browser-default control.
- Verification: 33/33 focused LearningSpace/resource/submission UI tests, including actual server-rendered task and form fixtures; 102/102 Learning Hub unit tests; 24/24 relevant resource/storage integrations; typecheck; targeted ESLint; production build; and git diff check passed. The Windows tsx pre-discovery ENOMEM required the documented temporary preload, removed after tests. Render tests prove supplied fixture content appears in HTML; they do not prove the owner's browser receives the same data or establish screenshot-perfect visual acceptance. No database or real provider was used.
- DueAt remains optional in G1 and is rendered only when present. Whether the specific tasks in the owner's screenshot have a dueAt is unknown without their authorized runtime response. D0e and G3 remain unstarted.

## D0d-UX1 master/detail and submission-form repair (verified 2026-10-09)

- Automated status at the UX1 checkpoint: PASS WITH KNOWN LIMITATION as a bounded repair inside D0d. Owner visual acceptance was later rejected, prompting UX2. Desktop Công việc & bài nộp uses an approximately 35/65 master/detail layout in one viewport, with a compact task list on the left and the selected detail on the right. The list preserves server order and paginates locally at eight rows. Mobile opens on the list, switches to the chosen detail, and provides a focus-managed back-to-list action. Task and submission status enums are localized in the client; authoritative task titles and optional due dates come unchanged from G1.
- The selected detail contains the read-only current Submission and, only under the unchanged G2 edit gate, a separated Bài làm của bạn form for text, optional HTTPS link, and optional file. Direct file selection still initiates F1 with `SUBMISSION_ATTACHMENT`, uploads, finalizes, retains the READY ID, and submits that ID through G2. Upload/finalize/READY/G2 states and errors are presented separately. A G2 failure preserves the per-task draft and READY association; retry does not re-upload. Removing a draft association does not delete its LearningResource. The secondary picker remains closed by default and fetches fresh `view=ready-files` data with `no-store` on every open.
- Verification: 30/30 focused LearningSpace shell/resource/submission UI tests, 99/99 Learning Hub unit tests, 24/24 relevant resource/storage integration tests, typecheck, targeted ESLint, `git diff --check`, and production build passed. The standard Windows `tsx` runner failed before discovery with the documented ENOMEM; the unchanged commands then passed under the temporary host preload, which was removed after verification. Tests used mocks/in-memory boundaries; no shared database or real provider was used. The former render/loading attachment assertion was not restored; equivalent behavior is covered by explicit fresh metadata-fetch and click-only private-download assertions.
- Limitations remain the owning D0d limitations: drafts are in-memory only and current deleted attachments use the explicit unavailable state rather than historical metadata. D0e deletion protection remains recommended and unstarted; G3 remains unstarted.

## D0d four-section LearningSpace and submission flow (verified 2026-10-09)

- Status: PASS WITH KNOWN LIMITATION. Shared title/pair/skill/objective/definition/topics/Booking context remains above four responsive hash-linked sections. Tài liệu uses the server-side `materials` read and scoped refreshes after upload/link/delete. Its F1 file initiation sends `MATERIAL`; direct task uploads send `SUBMISSION_ATTACHMENT`.
- Công việc & bài nộp shows compact selectable rows and one full-width detail. The existing G2 edit gate remains assignee plus OPEN/IN_PROGRESS first submit or dual REVISION_REQUESTED state, excluding archived spaces. Per-task in-memory drafts retain content, HTTPS link, selected existing file, local selected file, and finalized READY ID across task/section changes. Direct upload auto-starts after file selection, finalizes, shows an attached card, and submits the same ID to G2; G2 failures keep the draft/ID for retry. The secondary picker fetches `view=ready-files` with `no-store` each time it opens. Current attachment metadata uses the same scoped view, independently of materials; unavailable/deleted attachment copy remains explicit.
- Verification: focused shell/resource/submission tests 27/27; Learning Hub unit suite 96/96; relevant D0c/F1 storage integration tests 24/24; typecheck; targeted ESLint (0 findings); `git diff --check`; production build (35 routes/pages) passed. Standard Windows `tsx` failed before discovery with documented ENOMEM, then unchanged tests passed under temporary host preload, removed afterward. No shared database or real provider was used. Manual owner smoke has not run. Offline legacy regression scripts and full repository lint were not rerun because shared legacy/domain logic did not change.
- Limitations: drafts are local to the mounted page and do not survive reload/cross-navigation; F2 LINK creation retains LEGACY_UNCLASSIFIED, which D0c intentionally includes in materials. Deleted current attachments display unavailable rather than historical metadata. D0e deletion protection remains recommended to prevent deleting a current submission attachment; D0e and G3 are unstarted. Next safe task: separately approve/implement D0e.

## D0c scoped resource reads (verified 2026-10-09)

- Status: PASS. `GET /api/learning/spaces/[spaceId]/resources` accepts omitted `view` for the unchanged all-purpose PENDING/READY/QUARANTINED list, `view=materials` for MATERIAL and LEGACY_UNCLASSIFIED in those statuses, and `view=ready-files` for READY, non-deleted FILE rows of every purpose. Unsupported values return the existing F2 JSON 400 validation response after member authorization. All views retain `createdAt desc`.
- Scope is a Prisma `findMany` predicate. The independent FILE PENDING/READY/QUARANTINED quota aggregate, response shape and private-field exclusions, archived-member reads, and one-argument page caller remain unchanged. No schema, migration, F1 lifecycle, F2 link write, G2 eligibility, LearningResources grouping/pagination, or UI change was made.
- Verification: 23/23 focused resource view and F2 unit tests, 24/24 resource view and F1 storage integration tests, route smoke, `npm run typecheck`, targeted ESLint, and `git diff --check` passed. Tests used an in-memory Prisma boundary and mocked storage; no shared database or provider was touched. The standard Windows `tsx` command hit the documented pre-discovery ENOMEM; the unchanged suites passed with the temporary preload, removed after testing. Full lint, production build, and offline legacy regressions were not rerun.
- At the D0c checkpoint, D0d was the next safe slice. D0d is complete now; D0e deletion protection and G3 SubmissionReview remain unstarted.

## D0b resource-purpose assignment (verified 2026-10-08)

- Status: PASS. `POST /api/learning/spaces/[spaceId]/files` accepts optional `purpose`. Explicit `MATERIAL` and `SUBMISSION_ATTACHMENT` are persisted on the new PENDING FILE row; omission is normalized and persisted as `LEGACY_UNCLASSIFIED`. Explicit `LEGACY_UNCLASSIFIED`, unknown strings, non-strings, null, arrays, and objects return the existing F1 400 validation style before reservation or provider access.
- Purpose is decided after server-session/member authorization and before provider bucket/signing access. It is included in the existing transaction-scoped advisory-lock reservation after the unchanged booking/topic checks and quota aggregate. No heuristic uses topic, Booking, filename, uploader, time, or Submission references.
- Finalize, READY, quarantine, provider failure, expiry/orphan cleanup, download, and soft delete do not write `purpose`. F1 identity, authorization, archive, ownership, MIME/extension, size, quota, lock, signed expiry, provider, random-key, finalize, cleanup, download, and deletion contracts are unchanged. G2 still accepts any READY, non-deleted, same-space FILE attachment and has no purpose predicate.
- Verification: focused F1 storage test PASS (18); complete Learning Hub integration PASS (43, including route smoke); complete Learning Hub unit PASS (97); `npm run typecheck` PASS; targeted ESLint PASS. The standard `tsx` command reproduced the documented Windows `uv_os_get_passwd` ENOMEM before discovery; the unchanged suites passed under the documented temporary preload, which was removed after verification. No shared database or real storage provider was used.
- At the 2026-10-08 D0b checkpoint, D0c scoped resource reads were next; D0d LearningSpace/UI/submission-flow redesign, D0e deletion protection, and G3 SubmissionReview were unstarted then.

## D0a resource-purpose schema foundation (verified 2026-10-07)

- Status: PASS. `LearningResourcePurpose` has `MATERIAL`, `SUBMISSION_ATTACHMENT`, and `LEGACY_UNCLASSIFIED`; `LearningResource.purpose` is non-null with a database default of `LEGACY_UNCLASSIFIED`. Manual migration 006 creates only that enum and column in a transaction. It does not infer or update old intent, alter relationships/storage keys, or touch Booking, Task, or Submission.
- The paired rollback takes an exclusive resource-table lock and aborts if any classified row exists; after classified writes, retain the additive column and prefer roll-forward unless an explicit preservation plan is approved. The approved disposable Supabase TEST rehearsal passed clean and representative legacy forward paths, old-writer defaults, explicit classifications, invalid-enum rejection, relationship preservation, classified-row rollback refusal, safe rollback, injected forward failure atomicity, and run-owned cleanup.
- The first live rehearsal exposed a verifier-only defect: JavaScript replacement-string processing collapsed the injected PostgreSQL `DO $$` guard to invalid `DO $` for transaction-bearing SQL. A replacement callback now preserves the dollar quotes, and a focused regression assertion covers them. Migration 006 and its rollback were unchanged.
- Verification: Prisma schema validation/generation, 21 focused D0a tests, `npm run typecheck`, targeted lint and schema-parity checks, and the complete rehearsal all passed. The Supabase intermediate `X509_STRICT` Key Usage result occurred only in an additional diagnostic after normal certificate-chain and hostname verification passed; it is not a D0a product or migration limitation, so the final status is plain `PASS`.
- No F1 initiation/finalize/download/delete, F2 service/API/UI, G1, G2, provider, quota, Booking, GP, settlement, or cron behavior changed during D0a. At the D0a checkpoint, D0b purpose assignment was next, with D0c scoped reads to follow. D0b and D0c are complete now; D0d owns the LearningSpace four-section and submission-flow redesign. G3 remains separate and unstarted. The historical G2 checkpoint below remains its original evidence.

## Task G2 completion (2026-09-28)

- Status: PASS. LH 041 adds one current Submission per task through a session-backed GET/POST task endpoint and a mobile LearningSpace submission form. No schema, migration, Booking, reviewer outcome, GivePoint, settlement, notification, or cron behavior changes.
- Only the task assignee may submit. Both task participants must remain active, unsuspended space members and the space must be active. Input cannot supply author identity. An attachment must reference a READY, non-deleted FILE LearningResource in the same space. Text is capped at 20,000 characters; external links use the F2 HTTPS normalization and are never server-fetched.
- Edit window: first submit is permitted when a task is OPEN or IN_PROGRESS and has no Submission. The submission then becomes read-only in SUBMITTED. Resubmission is permitted only when both task and current Submission are REVISION_REQUESTED, by the same session assignee. CANCELLED, COMPLETED, REVIEWED, archived, and inconsistent states reject writes. G3 will own transitions into REVISION_REQUESTED.
- The first submit sets submittedAt and revisionCount=1. Resubmission updates the same row, advances submittedAt, and increments revisionCount once. A conditional task version/status claim within a serializable transaction protects concurrent submits; one privacy-safe LearningActivity event per revision has a unique event key and no submitted content, URL, or storage key.
- The LearningSpace form lists tasks, offers mobile text, HTTPS URL, and READY file selection, shows loading/errors, blocks duplicate clicks, and retains draft fields after validation or request failure. A successful submit displays the current revision and removes editing until a revision request.
- Verification: typecheck, targeted ESLint, Learning Hub unit and integration suites, all five legacy regressions, and production build passed. The unit runner required the documented temporary Windows getEUID preload because the host's tsx temporary-directory initialization raises uv_os_get_passwd ENOMEM without it; the helper was removed after tests. The pre-repair full lint result was 77 errors/33 warnings; audit confirmed the extra `react-hooks/exhaustive-deps` warning in `LearningResources.tsx` pre-dated G2 and was unrelated. The follow-up micro-repair memoized `resourceGroups`, updated its dependency, and restored full lint to 77 errors/32 warnings. No G2 file has a lint finding.
- G3 may rely on the current Submission row and must set both task and Submission to REVISION_REQUESTED to reopen editing. It must preserve the G2 event-key/revision convention and keep private feedback separate from public Review/Trust.

## Task G1 completion (2026-09-28)

- Status: PASS. LH 040 is complete. The F2 resource-pagination blocker was an implementation-coupled source assertion; its test-only repair retained production pagination behavior.

- LH 040 task domain adds protected task list/create/update APIs under `/api/learning/spaces/[spaceId]/tasks`. The server session supplies creator/actor identity. Both task participants must be distinct active, unsuspended space members; optional Booking must belong to the space and contain both participants; optional topic must be active in the space. Archived spaces remain readable and reject task writes.
- Task fields are title, description, required acceptance criteria, independent optional future `dueAt`, optional Booking/topic, creator, assignee, status, timestamps, and an additive integer version. Creator may edit an OPEN task and request `CANCEL` for OPEN/IN_PROGRESS; assignee may request `START` for OPEN. The server maps those actions to states; client-supplied status is rejected. Submission, review, and completed states remain unavailable to G1 client mutations.
- Migration `005_learning_task_version.sql` adds only `LearningTask.version INTEGER NOT NULL DEFAULT 1` and does not backfill Booking. Forward and rollback rehearsals passed on the approved staging `DIRECT_URL`; forward SQL was reapplied after rollback, leaving staging in the post-G1 schema state. Existing Booking scheduling, AvailableSlot, Calendar/Meet, cron, fulfillment, settlement, GivePoint, and notifications are unchanged.
- Final verification: `npm run db:generate`, `npx prisma validate`, `npm run typecheck`, targeted ESLint, and production build passed. `npm run test:learning-hub` passed 62/62; `npm run test:learning-hub:integration` passed 39/39; all five legacy regression scripts passed. Migration 005 forward and rollback rehearsals passed.
- G2 may rely on G1 task ownership, active pair checks, status/version conditional updates, and independent dueAt, but must implement Submission transitions separately. No notification, submission, review, or settlement side effect exists in G1.

## Historical checkout checkpoint (2026-10-14)

- Recorded: 2026-10-14, Asia/Saigon.
- Branch: `feature/learning-hub-mvp`.
- Current HEAD: `43c0ced83281f5cd35a967929aba6d1061f7acf6` (`feat(learning-hub): complete D0d LearningSpace and submission UX`). D0e changes are uncommitted.
- Previously recorded D0c commit: `5cd35d49dbd91bda998d9caf41e002febd3a46d4` (`feat(learning-hub): add D0c scoped resource views`).
- Previously recorded G2 commit: `b9cf25172d6895d45589fbdd6abed42a489ba25c` (`fix(learning-hub): support direct file attachment in G2 submissions`).
- Current checkout checkpoint: G2, D0a-D0d (including UX1, UX2, and D0d-F1), and D0e are implemented. D0e backend audit is `PASS WITH FINDINGS` (LOW only); its controlled real PostgreSQL race evidence and later UI repair verification are recorded above. The owner reports D0e M01-M05 PASS. No independent UI re-audit or production build ran. G3 is NOT STARTED; D0e has no commit ID.
- Historical baseline before Task A1 authoring: `b2342f4c07430c2441ae4bcc2ec410fc27dfefb1`.
- Status: D0a-D0c PASS; D0d automated verification PASS with its recorded limitations and owner-reported manual acceptance PASS; D0e implementation and verification complete, backend audit `PASS WITH FINDINGS` (LOW only), UI repair verification PASS, and owner-reported M01-M05 PASS; no independent UI re-audit or production build. G3 NOT STARTED. Historical UX2 acceptance and prior D0d/G1/G2 evidence remain in their dated sections.
- Production behavior: a Booking started from a LearningSpace carries a server-authorized `learningSpaceId`, optional active `topicId`, selected LIVE/EXERCISE_REVIEW/HYBRID mode, objective/definition snapshots, and `NOT_STARTED` fulfillment state. LIVE and HYBRID now select a future unbooked mentor AvailableSlot and use the existing locked slot path; EXERCISE_REVIEW retains the E1 manual-time `createBooking` path. Legacy Booking creation remains valid with all Learning Hub fields null.
- Schema/migration behavior: ten Learning Hub models plus eight nullable Booking fields; additive migrations 004, 005, and 006 with paired rollback SQL/notes and no Booking backfill. Migration 005 adds only `LearningTask.version` with default 1. Migration 006 adds only `LearningResourcePurpose` and non-null `LearningResource.purpose` with database default `LEGACY_UNCLASSIFIED`; its rollback refuses classified rows.
- API behavior: F1 provides session-bound private file initiation, finalize, signed download, and soft-delete routes under `/api/learning/spaces/[spaceId]/files`, plus a secret-protected cleanup cron. F2 adds member-authorized resource collection/item routes under `/api/learning/spaces/[spaceId]/resources`. G1 adds protected task list/create and item-update routes under `/api/learning/spaces/[spaceId]/tasks`; G2 adds the session-backed current-submission route under `/api/learning/spaces/[spaceId]/tasks/[taskId]/submission`; `getLearningBookingContext` and E1 Booking guards remain intact.
- Learning Hub implementation: F2 uses F1's provider-agnostic storage-service/API abstraction and does not import or depend directly on the AWS SDK or S3. G1 provides task create/list/version-checked edit with active-pair, Booking/topic ownership, START/CANCEL transition, and independent dueAt rules. Resource lists and activity return no signed URL or storage key. G2 implements current Submission; review, fulfillment, settlement, and notes remain pending.
- D0b verification: 18/18 focused F1 storage tests, 43/43 Learning Hub integration tests, 97/97 Learning Hub unit tests, typecheck, targeted ESLint, and `git diff --check` passed. Production build, full repository lint, and the five legacy regression scripts were not rerun for D0b. Historical G2/F1 verification remains in its owning sections and is not D0b evidence; the 77-error/32-warning full-lint result is a historical repository baseline, not a fresh D0b lint run.
- D0c verification: 23/23 focused F2/D0c tests, 24/24 relevant integration tests, route smoke, typecheck, targeted ESLint, and `git diff --check` passed. Production build, full lint, and the five legacy regression scripts were not rerun for D0c.
- F2 Resource domain and UI completed on 2026-09-21. Active members can list, add, reopen, and delete their HTTPS links or F1 private files from LearningSpace. Resource metadata carries optional Booking/topic references; safe status, uploader, topic, time, and quota are displayed. Link/file deletion remains uploader-only and soft deletes preserve audit/provider cleanup. No server URL fetch, file parsing, raw video, Booking, fulfillment, or settlement behavior was added.
- At that checkpoint, D0d was next. D0d is complete now; D0e is complete and uncommitted. G3 remains separate and NOT STARTED.

### OWNER DECISION — EXERCISE_REVIEW scheduling semantics

For `EXERCISE_REVIEW` only, `Booking.startTime` and `Booking.endTime` remain unchanged legacy compatibility fields required by the current Booking path. They are not synchronous mentor availability, mandatory online attendance, `LearningTask.dueAt`, a submission or feedback deadline, fulfillment-completion evidence, a review-window start, or GivePoint-settlement eligibility. `LearningTask.dueAt` is an independent task deadline; `Submission.submittedAt`, `SubmissionReview.reviewedAt`, `Booking.deliveredAt`, and the later fulfillment lifecycle are the authoritative async workflow timestamps.

This documentation decision makes no production change: AvailableSlot semantics, legacy Booking scheduling, Calendar/Meet, auto-complete cron, settlement, and GivePoint pricing remain unchanged. Whether EXERCISE_REVIEW should stop consuming an AvailableSlot is deferred as a separate product/architecture decision. G1/G2/G3 must not alter those boundaries. I1/I2/I3 retain the existing responsibility to enforce that EXERCISE_REVIEW does not settle from `endTime`.

### OPEN PRODUCT DECISION — GivePoint quantity by learning mode

The GP quantity for EXERCISE_REVIEW and HYBRID remains intentionally unresolved. E1 preserves the existing integer one-GP Booking escrow and ledger semantics for every mode. It adds no mode-specific pricing, fractional GP, or time-based calculation from preparation, task, document, video, or feedback work. Wallet, settlement, TransactionLog, and cron behavior are unchanged. An owner decision is required before any future task changes GP quantity by mode.

## Task F1 private storage infrastructure

- Recorded: 2026-09-20, Asia/Saigon. Starting `git status --short --untracked-files=all` was clean; no pre-existing user change was present. Scope is the provider abstraction and signed file boundary only.
- Files: `src/lib/learning-storage-provider.ts` implements the S3 adapter; `learning-storage-service.ts` owns validation, session identity, member policy, quota, state and cleanup; `learning-storage-route-handlers.ts`/`learning-storage-runtime.ts` and four file API routes expose the boundary; the cleanup cron route and `vercel.json` schedule purge work; `infra/learning-storage.yaml` specifies a private bucket; `tests/learning-hub/integration/learning-storage.test.ts` uses mocked provider calls. `package.json`/lock add the AWS SDK signer/client packages. The F1 runbook, context, matrix, regression, risk, and changelog rows record behavior and operations.
- Session and authorization: `requireAuthenticatedUser()` provides the actor. ACTIVE membership is required before private resource lookup or signing. Upload, finalize, and deletion require an ACTIVE space; downloads also allow ARCHIVED spaces for their still-active members. Finalize and delete require the uploader. No client actor ID authorizes any action.
- Validation and quota: exact PDF/JPEG/PNG/TXT/Markdown extension/MIME pairs; unsafe path/control filename rejection; integer positive size with a 20 MiB file cap. The per-space 500 MiB quota counts READY, PENDING, and QUARANTINED reservations under the existing PostgreSQL LearningSpace advisory lock. Office and SVG files are excluded. S3 POST policy binds the key, MIME, size ceiling, and five-minute expiry.
- Lifecycle: a random pending key is reserved in the existing LearningResource table. After S3 HEAD confirms exact MIME and size, the adapter copies to the final random `spaces/...` key, verifies its metadata and PDF/JPEG/PNG signature or UTF-8 text prefix, then conditionally marks READY. Staging remains isolated from a reusable upload credential. Missing uploads remain PENDING; mismatches become QUARANTINED; either is purged after 15 minutes. Download credentials last ten minutes and force attachment/octet-stream. Soft deletion blocks new URLs before provider removal; failed removals remain retryable by the cron. S3's `pending/` one-day lifecycle is a crash backstop.
- Schema/migration/data: none. Existing B1 `LearningResource` fields and statuses are reused, with no old-row backfill or Booking change. No signed URL is persisted. No real bucket or shared database was written during F1 verification. Bucket deployment, server-only IAM credentials, and the exact app CORS origin are required before production use; see the runbook.
- Compatibility/rollback: legacy Booking, Calendar/Meet, cancellation, no-show, dispute, wallet/ledger, Review/Trust, chat, notifications, dashboard/history, and existing cron logic were not edited; all five offline regressions passed. Roll back the F1 routes, service, provider, schedule, bucket template, package additions, tests, and docs only. Before disabling a deployed F1 boundary, stop file writers and retain/export any new LearningResource rows and storage objects; do not delete the bucket or old rows automatically.
- Required evidence: unauthenticated/nonmember, wrong MIME/Office/SVG, oversize/quota, traversal, five/ten-minute expiry, archived member, deleted resource, missing and stale orphan finalize, a deletion/finalize race, provider failure, and successful member upload/download passed with provider mocks. `npm run typecheck`, both Learning Hub suites, `npm run test:regression`, targeted ESLint, and `npm run build` passed. The initial build found a route-context type mismatch; it was fixed and the production build passed. The standard `tsx` run fails before test discovery on this host with the documented `os.userInfo()` ENOMEM; a temporary compatibility preload made the unchanged suites pass and was removed. The 2026-09-21 isolated B2/C1 repair removed its 74 errors/two warnings and restored full lint to the unrelated 77-error/32-warning legacy baseline; F1 introduces zero findings.
- Next assumptions: F2 may use only these file APIs and existing rows; it must provide resource list/detail and safe HTTPS link/UI behavior, and retain member authorization on every private read. Do not begin F2, fulfillment, settlement, or AI automatically.

## Historical baseline note

The four memory files the Task 00 prompt required first did not exist at that baseline. Task 00 created the complete memory set from the supplied references, the tracked playbook at that HEAD, and repository evidence available then.

## Historical Task 00 pre-existing dirty state

Captured with `git status --short --untracked-files=all` before authoring. These entries are user-owned and were not restored, edited, staged, or deleted:

```text
 D "docs/GiveGot Learning Hub Codex Implementation Prompt Playbook.docx"
 D "docs/GiveGot Learning Hub Product and Technical Specification.docx"
?? "docs/learning-hub/Codex_GiveGot Learning Hub Product and Technical Specification.docx"
?? docs/learning-hub/GPT_GiveGot_Learning_Hub_MVP_Spec_v1.0.docx
```

Task 00 adds only the ten requested Markdown files under `docs/learning-hub/`.

## Historical application route inventory (pre-G3)

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

Current protected Learning Hub APIs are `POST /api/pusher/auth`, `/api/learning/spaces/*` including F1 file, F2 resource, G1 task, G2 submission, G3 review, and H1 Notes routes, and `/api/learning/invites/*`. The H1 collection/item routes are `/api/learning/spaces/[spaceId]/notes` and `/api/learning/spaces/[spaceId]/notes/[noteId]`. `/learning/[spaceId]` includes the Notes editor and optional recap affordance.

## Current schema

`prisma/schema.prisma` validates with 27 models: the 17 legacy models plus LearningSpace, LearningSpaceMember, LearningTopic, LearningInvite, LearningResource, LearningTask, Submission, SubmissionReview, LearningNote, and LearningActivity.

Booking keeps its legacy mentor/mentee, slot, schedule, BookingStatus, note, meeting, review, transaction, conversation, blind-review, absence, and report fields. B1 adds nullable `learningSpaceId`, `topicId`, `learningMode`, `objective`, `definitionOfDone`, `fulfillmentStatus`, `deliveredAt`, and `acceptedAt` fields.

BookingStatus remains exactly `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `MISSED`, and `DISPUTED`. FulfillmentStatus is a separate nullable lifecycle with `NOT_STARTED`, `IN_PROGRESS`, `DELIVERED`, `REVISION_REQUESTED`, `ACCEPTED`, and `SETTLED`.

`LearningResource.purpose` uses `LearningResourcePurpose` (`MATERIAL`, `SUBMISSION_ATTACHMENT`, `LEGACY_UNCLASSIFIED`), is non-null, and defaults at the database layer to `LEGACY_UNCLASSIFIED`. D0a supplies only this schema foundation; D0b assigns purpose on writes and D0c applies purpose-aware scoped reads. `LearningNote.type` uses `GENERAL`/`RECAP` with default `GENERAL`; nullable `deletedAt`/`deletedById` support audited soft deletion under ADR 019.

The data source is PostgreSQL with `DATABASE_URL`, `DIRECT_URL`, and the pgvector extension. The repository uses Prisma 5.22.0 and notes `prisma db push`; it has no standard `prisma/migrations` history.

## Current migrations

Only `prisma/migrations-manual/` exists:

- `001_skill_category_to_enum.sql`: converts legacy Skill category strings to SkillCategory; drops/renames columns after backfill.
- `002_skill_embedding_readiness.sql`: additive BR-11 readiness fields, audit backup, vector eligibility check; explicitly reviewed/manual.
- `003_withdrawal_rejection_atomic_refund.sql`: adds `REFUND_WITHDRAWAL_REJECTED` to TransactionType.

Migration 004 adds the B1 domain additively and has paired executable rollback SQL plus a production rollback note. Migration 005 adds `LearningTask.version INTEGER NOT NULL DEFAULT 1`, with `005_learning_task_version.rollback.sql` and its rollback note. Migration 006 adds `LearningResourcePurpose` and non-null `LearningResource.purpose` with `LEGACY_UNCLASSIFIED` as the database default; its guarded rollback refuses classified rows. The full clean, legacy, rollback, and atomic-failure rehearsal passed on the disposable Supabase TEST project on 2026-10-07. No ambiguous historical row is inferred or reclassified. Migration 007 adds `LearningNoteType`, the `GENERAL` default, audited soft-delete columns, and an active-list index; disposable TEST forward/rollback/refusal/cleanup and owner-authorized STAGING forward/schema/Prisma checks passed. No PRODUCTION migration ran.

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

## Historical Task 00 baseline command evidence

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
- Later correction (2026-09-20): preserve that checkpoint record, but classify the then-current 151-error/34-warning repository result as 77/32 unrelated legacy debt plus 46 errors/one warning from B2 and 28 errors/one warning from C1. The isolated B2/C1 repair completed on 2026-09-21 before F2.
- Compatibility/rollback: no schema/data migration or backfill; legacy Bookings with null Learning Hub fields remain unchanged/readable. Rollback is file-level reversion of B2 routes, services, tests, realtime authorizer wiring, and docs.

## Task C1 completion

- Recorded: 2026-09-16, Asia/Saigon.
- Status: PASS.
- Added a session-bound LearningInvite backend: a 256-bit raw token is returned only on creation, while PostgreSQL receives only its SHA-256 hash. Invites retain inviter, primary skill, initial objective, expiry, one-use pair limit, acceptance/revocation timestamps, and optional resulting LearningSpace.
- Acceptance holds transaction-scoped advisory locks for the invite and any selected space. It is idempotent only for the original recipient and rejects self acceptance, revoked/expired/exhausted state, a different-user replay, primary-skill mismatch, and a reuse choice that would create a third active member.
- A recipient may explicitly attach the accepted invite to an existing active matching pair space or omit that choice to create another space for the same pair. No pair-plus-skill uniqueness was introduced.
- Logged-out preview preserves the raw token only as an AES-GCM encrypted, ten-minute, HttpOnly, SameSite=Lax cookie. The cookie is cleared after acceptance; token hashes and raw tokens are never logged or returned in previews.
- Verification: `npm run typecheck`; 23 Learning Hub unit tests; route smoke plus 13 integration tests; all five legacy regressions; targeted ESLint; and production build. The Windows runner initially failed before test discovery because `tsx` calls `os.userInfo()` on this host; the test command passed without changing source after a one-command `NODE_OPTIONS` compatibility preload supplying the unavailable Windows `geteuid` path. The temporary preload was deleted.
- Later correction (2026-09-20): C1 accounts for 28 errors/one warning within the later-classified 74 errors/two warnings of B2/C1 Learning Hub lint debt; the remaining B2 share is 46 errors/one warning. All 74 errors are `@typescript-eslint/no-explicit-any`, and the warnings are known unused variables.
- Later resolution (2026-09-21): the isolated seven-file typing repair removed all 74 B2/C1 errors and both warnings without changing intended runtime behavior. Targeted ESLint is 0/0 and full lint is the unrelated 77-error/32-warning legacy baseline.
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
- Verification: `npm run typecheck` PASS; `npm run test:learning-hub` PASS (37); `npm run test:learning-hub:integration` PASS (23 after route smoke); `npm run test:regression` PASS (all five scripts); targeted ESLint PASS; `npm run build` PASS (34 generated pages, existing middleware deprecation warning only). At the E1 checkpoint, full `npm run lint` recorded 151 errors and 34 warnings, with no finding in an E1 TypeScript file. Later reconciliation attributes 74 errors/2 warnings to B2/C1, retains 77 errors/32 warnings as unrelated legacy debt, and confirms no lint scope or configuration change. The standard `tsx` invocation reproduced the known Windows `os.userInfo()` ENOMEM host issue before discovery; the same commands passed with the previously documented temporary preload, which was removed.
- Rollback: revert only the E1 source, test, and documentation changes. No schema or data rollback is required. Existing linked rows remain compatible because every E1 Booking field was introduced as nullable in B1.
- Next assumptions: F1 may add private storage without changing E1 mode or GP contracts. G1 may use the EXERCISE_REVIEW/HYBRID artifact requirements after E1. I1-I3 still own fulfillment mutations, settlement enforcement, and mode-aware cron; do not infer settlement eligibility from this read-only evaluator alone.

## E1 narrow AvailableSlot repair

- Recorded: 2026-09-18, Asia/Saigon. Status: PASS WITH KNOWN LIMITATION.
- Root cause confirmed: the LearningSpace CTA opened the legacy manual `/book/[mentorId]` form, and E1 passed linked LIVE/HYBRID selections to `createBooking`, which created arbitrary client-timed Bookings without `slotId`. The already-integrated `bookAvailableSlot` path was not exposed by that page.
- LIVE/HYBRID now load only future unbooked slots from `getAvailableSlots`, render a required slot selector, submit the selected slot plus the complete LearningSpace selection to `bookAvailableSlot`, and refresh availability after a failed/stale attempt. Empty availability has no manual fallback.
- `createBooking` now rejects linked LIVE/HYBRID immediately after server authentication, before time/review gates, Prisma transaction entry, GP debit, Booking/TransactionLog creation, notifications, or email. EXERCISE_REVIEW and unlinked legacy bookings keep their prior manual-time path.
- The locked slot remains authoritative for mentor, start/end time, and `slotId`; `FOR UPDATE`, the post-lock `isBooked` check, one GP debit, one Booking create, and the slot update remain ordered in the existing transaction. The mentor-profile calendar component was not changed.
- No schema, migration, BookingStatus, FulfillmentStatus, GP quantity, wallet/escrow, settlement, TransactionLog semantics, cron, provider integration, artifact, or fulfillment-state-machine change was made. F1 remains unstarted and next in registry order.
- Verification: `npm run typecheck` PASS; `npm run test:learning-hub` PASS (41); route smoke plus `npm run test:learning-hub:integration` PASS (25); `npm run test:regression` PASS (all five scripts); targeted ESLint PASS; `npm run build` PASS (34 pages, existing middleware deprecation warning only). Standard `tsx` failed before discovery with the documented Windows `os.userInfo()` ENOMEM; both suites passed unchanged under the temporary compatibility preload, which was removed.

## Historical repository-memory and B2 realtime reconciliation

- Recorded: 2026-09-16, Asia/Saigon. Status: PASS.
- Reconciled the stale pre-B2 integration assertion with the actual B2 authorizer. Private LearningSpace channels require a server session and ACTIVE membership; nonmembers and LEFT/REMOVED memberships are denied. An archived LearningSpace remains readable, so its active members remain authorized.
- Verification: `npm run typecheck`; 23 Learning Hub unit tests; route smoke plus 17 integration tests; and all five legacy regressions. No production behavior, schema, API, or UI changed.
- Historical reconciliation only: B2, C1, D1, C2, and E1 are complete; F1 is next in registry order.
