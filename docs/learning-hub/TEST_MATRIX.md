# Learning Hub Test Matrix

## Status vocabulary

- `BASELINE PASS` or `BASELINE FAIL`: command executed during Task 00.
- `PLACEHOLDER`: coverage required by a future task; no executable test exists yet.
- `PARTIAL PASS`: part of the requirement has executable passing evidence, while explicitly assigned coverage remains pending in a later task.
- `PASS` or `FAIL`: reserved for an implemented, executed test with recorded evidence.

## Current checkpoint and historical-count rule

The current checkout checkpoint is 00, 01, A1, A2, B1, B2, C1, D1, and C2 PASS, with E1 PASS WITH KNOWN LIMITATION; F1 is next. Except where this section explicitly states a current observation, suite counts and command results below are historical evidence from their named task checkpoints, not cumulative current totals. The current observed full-lint result is 151 errors and 34 warnings; its delta from the Task 00 baseline remains unclassified.

## Test ladder

| Level | Coverage | When required |
| --- | --- | --- |
| T0 | Prisma generate and validate | Schema/client changes |
| T1 | Typecheck and targeted unit/state tests | Every code task |
| T2 | Service/route integration with mocks or disposable DB | Domain, authorization, storage, settlement |
| T3 | Standalone legacy regressions | Any task touching an existing flow |
| T4 | Lint and production build | UI/API/cross-module task end |
| T5 | Full suite, migration matrix, E2E, reconciliation | End of block, pre-pilot, release |

## P0 requirement coverage

Every P0 LH requirement maps to implementation tasks and explicit placeholders below.

| Requirement | Task(s) | Unit/state placeholder | Integration/security/compatibility placeholder | Regression placeholder | Status |
| --- | --- | --- | --- | --- | --- |
| LH 001 | C1 | `LH001-U` token entropy/hash, expiry, usage | `LH001-I` create; `LH001-S` session/self/third-member auth | Invite delivery/provider failure preserves state | C1 PASS; no delivery/provider coupling added |
| LH 002 | C1, C2 | `LH002-U` token state transitions | `LH002-I` preview/accept; `LH002-C` concurrent/idempotent accept | Signup return and existing-space behavior | PASS: C2 covers Vietnamese creator/recipient UI, encrypted logged-out continuation, idempotent server acceptance, stale-state privacy, back navigation, mobile/focus labels, and first Booking action |
| LH 010 | B1, B2, D1 | `LH010-U` create/reuse decision | `LH010-I` pair membership; `LH010-L` old Booking/null compatibility | Discover/Booking creation still works | B1/B2 PASS; D1 PASS for authorized persistent-space shell and Booking context; C2 PASS for Bring Your Pair creation/onboarding UI and first-Booking action |
| LH 011 | B1, B2, D1 | `LH011-U` normalize/rename/archive/map | `LH011-I` member auth; `LH011-L` topic/history provenance | Skill moderation/public catalog unchanged | B1/B2 PASS; D1 PASS for authorized topic display, empty/archived read states, and long-content UI; topic mutations remain B2 API scope |
| LH 012 | B2, D1 | `LH012-U` objective/DoD validation/version | `LH012-I` member auth; `LH012-C` optimistic-lock conflict | Booking note and UI long-text behavior | B2 PASS; D1 PASS for objective/definition display, empty and long-Vietnamese UI; detail mutations remain B2 API scope |
| LH 020 | E1, I1 | `LH020-U` mode/checklist rules | `LH020-I` Booking integration and immutable-after-delivery guard | `LH020-R` legacy Live/Calendar/Meet/cancellation | E1 PASS: three evidence/timing contracts, member-pair linkage, stable snapshots, null-mode compatibility, pre-delivery mode-change guard, and legacy provider/lifecycle regression; I1 fulfillment transitions remain pending |
| LH 030 | F2 | `LH030-U` HTTPS normalization/validation | `LH030-I` member CRUD; `LH030-S` XSS/SSRF/no-fetch | Safe external navigation and deleted link | PLACEHOLDER |
| LH 031 | F1, F2 | `LH031-U` MIME/extension/size/key/quota | `LH031-I` signed upload/finalize; `LH031-S` spoof/path/expiry | Orphan cleanup and provider failure | PLACEHOLDER |
| LH 032 | F1, F2 | `LH032-U` TTL/deleted-state rules | `LH032-I` download issuance; `LH032-S` non-member/IDOR | Archived member and expired URL | PLACEHOLDER |
| LH 040 | G1 | `LH040-U` role/deadline/criteria | `LH040-I` create/update; `LH040-S` member/assignee auth | Notification and archived-space behavior | PLACEHOLDER |
| LH 041 | G2 | `LH041-U` current Submission/revision rules | `LH041-I` text/link/file flow; `LH041-C` concurrent resubmit | Task status and attachment authorization | PLACEHOLDER |
| LH 042 | G3 | `LH042-U` reviewed/revision outcomes | `LH042-I` reviewer auth and state; private content guard | `LH042-R` public Review/Trust unchanged | PLACEHOLDER |
| LH 050 | H1 | `LH050-U` scope/visibility/version | `LH050-I` note CRUD/member auth; `LH050-C` lost update | Archived read, XSS, long Vietnamese | PLACEHOLDER |
| LH 060 | H2 | `LH060-U` event shape/dedupe/redaction | `LH060-I` ordered authorized activity query | `LH060-R` chat remains separate | PLACEHOLDER |
| LH 070 | I1, I2, I3 | `LH070-U` transition/mode eligibility | `LH070-I` deliver/accept/revise/dispute; `LH070-X` concurrent retry/reconciliation | `LH070-R` cancellation/no-show/ledger | PLACEHOLDER |
| LH 080 | K1 | `LH080-U` derived grouping/filter/rebook | `LH080-I` participant history; `LH080-L` legacy null rows | Dashboard/history/profile rendering | PLACEHOLDER |
| LH 090 | J1 | `LH090-U` event/deep-link/dedupe rules | `LH090-I` recipient/auth/retry | `LH090-R` legacy read state/provider failure | PLACEHOLDER |
| LH 100 | A1, M1 | `LH100-U` support permission/audit fields | `LH100-I` report flow; `LH100-S` no bulk private access | Admin role and dispute resolution | PARTIAL PASS: A1 has executable server-session and database-backed admin authorization coverage. M1 support-permission/audit, no-bulk-private-access, and dispute-resolution coverage remain pending. |

## Required cross-cutting suites

| Suite | Cases | Owner | Status |
| --- | --- | --- | --- |
| Authorization | Unauthenticated, suspended, spoofed actor, non-member IDOR, archived member, admin reason/audit | A1, A2, B2, M1 | A1 PASS for server session/chat/admin; A2 PASS for private conversation/user authorization; B2 PASS for active LearningSpace membership, including readable archived spaces, while nonmembers/inactive memberships are denied; M1 cases remain |
| Migration | Clean DB, representative legacy rows, nullable Booking fields, rollback, no row loss | B1 | PASS: isolated clean/legacy/rollback execution; six BookingStatus rows retained; no backfill |
| Mode transitions | All allowed/forbidden transitions for LIVE, EXERCISE_REVIEW, HYBRID | E1, I1 | E1 PASS for selection contracts and mode immutability after delivery; I1 transition mutations remain pending |
| Settlement | Double click, concurrent request/cron, dispute, rollback, ledger reconciliation | I2, I3 | PLACEHOLDER |
| Storage | MIME/extension mismatch, size/quota, orphan, expiry, delete, filename/path, provider failure | F1, F2 | PLACEHOLDER |
| UI/accessibility | Empty/loading/error, mobile, keyboard/focus/labels/contrast, long Vietnamese | C2, D1, F2, G2, K1 | C2/D1 PASS: route-local states; responsive/focus-visible shell and onboarding; Vietnamese labels, optional-objective form, back navigation, and unavailable-artifact actions hidden. Remaining task coverage pending |
| Analytics/privacy | Event definitions, dedupe, raw counts, no private content | L1, M1 | PLACEHOLDER |

## Historical B2 realtime reconciliation

`tests/learning-hub/integration/realtime-authorization.test.ts` now covers unauthenticated LearningSpace-channel denial before provider access, nonmember denial, active-member authorization, inactive-member denial, and active-member authorization for readable archived spaces. The post-C1 suite result is 23 unit tests, 17 integration tests, and five legacy regressions passing.

## Historical Task 00 baseline evidence

| Command/test | Result |
| --- | --- |
| `npm run db:generate` | BASELINE FAIL: Windows EPERM replacing Prisma query-engine DLL |
| `npx prisma validate` | BASELINE PASS |
| `npm run lint` | BASELINE FAIL: 78 errors and 32 warnings |
| `npx tsc --noEmit` | BASELINE PASS |
| `npm run build` | BASELINE PASS; middleware deprecation warning |
| Five `scripts/test-*.cjs` offline regressions | BASELINE PASS; exact results in `IMPLEMENTATION_STATE.md` |

## Canonical commands

Task 01 created and self-tested the core commands. B1 adds `npm run test:learning-hub:migration`, which requires a local explicit `DISPOSABLE_TEST_DATABASE_URL`, refuses shared/remote endpoints, and never prints secrets. The credential-free B1 execution used isolated in-memory PostgreSQL and removed its temporary runtime afterward.

## Historical Task 01 canonical commands

Run these exact commands from the repository root:

- `npm run typecheck`
- `npm run test:learning-hub`
- `npm run test:learning-hub:integration`
- `npm run test:regression`

The unit suite uses `node:test` via the existing `tsx` dependency. The integration command first runs `scripts/test-learning-hub-smoke.ts`, which imports legacy routes and prints prerequisite names only. It does not load dotenv, connect to Prisma, call providers, or write data. Future database-writing tests require an explicit `DISPOSABLE_TEST_DATABASE_URL`; they must reject production/shared URLs and never print secrets.

## Historical Task A1 evidence

| Test/command | Result |
| --- | --- |
| `tests/learning-hub/unit/server-authorization.test.ts` | PASS: 401 missing session; participant 403/404; admin USER/suspended denial and ADMIN success; future membership lookup uses session ID |
| `tests/learning-hub/integration/chat-authorization.test.ts` | PASS: spoofed conversation query blocked; nonparticipant cannot list/read/mark-read; sender/read viewer from session; legitimate list/read/send; Booking-to-chat association |
| `npm run test:learning-hub` | PASS: 7 tests |
| `npm run test:learning-hub:integration` | PASS: import smoke plus 6 tests |
| `npm run test:regression` | PASS: all five legacy regression scripts |
| `npm run typecheck` | PASS |
| Targeted ESLint on changed production/A1 test TypeScript | PASS |
| `npm run lint` | KNOWN PRE-EXISTING LIMITATION: 77 errors, 32 warnings; no changed production/A1 test TypeScript finding |
| `npm run build` | PASS; existing middleware deprecation warning |

## Historical Task A2 evidence

| Test/command | Result |
| --- | --- |
| `tests/learning-hub/unit/realtime-cron-security.test.ts` | PASS: private-only names; missing/invalid/valid cron secret; production bypass denial; explicit non-production test path; no security-boundary logging |
| `tests/learning-hub/integration/realtime-authorization.test.ts` | PASS: unauthenticated denial; guessed conversation/user denial; participant success; user-channel ownership; public/unknown denial; LearningSpace deny-by-default |
| `tests/learning-hub/integration/cron-route-security.test.ts` | PASS: missing/invalid auto-complete authentication stops before data access; valid request preserves empty-batch response |
| Chat/notification realtime regressions | PASS: chat publishes the existing message payload on a private conversation channel; cancellation publishes existing payloads on private user channels without note/file/task/resource/secret fields |
| `npm run test:learning-hub` | PASS: 11 tests |
| `npm run test:learning-hub:integration` | PASS: route smoke plus 12 tests |
| `npm run test:regression` | PASS: all five legacy regression scripts |
| `npm run typecheck` | PASS |
| Targeted ESLint on changed TypeScript | PASS with 0 errors and one pre-existing chat hook warning |
| `npm run lint` | KNOWN PRE-EXISTING LIMITATION: unchanged 77 errors and 32 warnings |
| `npm run build` | PASS: 30 routes including `/api/pusher/auth`; existing middleware deprecation warning |

## Historical Task B1 evidence

| Test/command | Result |
| --- | --- |
| `npm run db:generate` | PASS with Prisma 5.22.0 binary engine; avoided the DLL held by the running dev server |
| `npx prisma validate` | PASS |
| Prisma HEAD-to-working-schema diff | PASS: generated DDL and reviewed migration 004 contain the same enums, columns, tables, indexes, and foreign keys |
| `tests/learning-hub/unit/learning-hub-schema-contract.test.ts` | PASS: ten models, exact mode/fulfillment enums, nullable Booking fields, no member role/pair-skill unique, explicit delete behavior, no Booking update/status alteration |
| Clean disposable migration | PASS: empty pre-B1 schema upgraded to ten Learning Hub tables and eight nullable Booking columns |
| Representative legacy migration | PASS: all six legacy status rows and legacy query payloads retained; every new Booking field remained null |
| Domain invariants on disposable DB | PASS: same pair/primary skill inserted into two spaces; archived space/topic remained readable; free-form topic created no Skill |
| Rollback rehearsal | PASS: new tables/columns/types removed; legacy BookingStatus labels retained |
| `npm run typecheck` | PASS |
| `npm run test:learning-hub:integration` | PASS: route smoke plus 12 tests |
| `npm run test:regression` | PASS: all five legacy scripts |
| `npm run build` | PASS: 30 routes; existing middleware deprecation warning only |
| Full `npm run lint` | KNOWN PRE-EXISTING LIMITATION: 77 errors and 32 warnings baseline; not weakened or hidden |

## Historical Task B2 evidence

- PASS: tests/learning-hub/unit/learning-space-service.test.ts covers two-member capacity, repeated-pair spaces, non-forced reuse, session-bound non-member denial, 409 optimistic conflict, topic-reference preservation, primary-skill audit, and null legacy Booking compatibility.
- PASS: npm run typecheck, npm run test:learning-hub (17), npm run test:learning-hub:integration (12), npm run test:regression (five scripts), and production build.

## Historical Task E1 evidence

- `tests/learning-hub/unit/learning-mode-contracts.test.ts` PASS: exact LIVE, EXERCISE_REVIEW, and HYBRID artifact sets; delivery/review timing; dispute blocking; null legacy mode; and post-delivery mode immutability.
- `tests/learning-hub/integration/learning-booking-integration.test.ts` PASS: server-session-shaped pair authorization, outsider/mismatched-pair/topic denial, advisory lock, stable topic/objective snapshots, all three initial modes, legacy null-mode no-op, AvailableSlot lock ordering, Meet/Calendar acceptance source, cancellation/dispute reachability, fixed one-GP escrow, and unchanged cron source.
- PASS: `npm run typecheck`; `npm run test:learning-hub` (37); `npm run test:learning-hub:integration` (23 after smoke); `npm run test:regression` (five scripts); targeted ESLint; and production build (34 pages).
- Historical E1 result: full `npm run lint` reported 151 errors and 34 warnings, with no finding in E1 TypeScript files and no weakened assertion or lint scope. The current delta classification remains open.
