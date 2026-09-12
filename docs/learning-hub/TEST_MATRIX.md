# Learning Hub Test Matrix

## Status vocabulary

- `BASELINE PASS` or `BASELINE FAIL`: command executed during Task 00.
- `PLACEHOLDER`: coverage required by a future task; no executable test exists yet.
- `PASS` or `FAIL`: reserved for an implemented, executed test with recorded evidence.

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
| LH 001 | C1 | `LH001-U` token entropy/hash, expiry, usage | `LH001-I` create; `LH001-S` session/self/third-member auth | Invite delivery/provider failure preserves state | PLACEHOLDER |
| LH 002 | C1, C2 | `LH002-U` token state transitions | `LH002-I` preview/accept; `LH002-C` concurrent/idempotent accept | Signup return and existing-space behavior | PLACEHOLDER |
| LH 010 | B1, B2, D1 | `LH010-U` create/reuse decision | `LH010-I` pair membership; `LH010-L` old Booking/null compatibility | Discover/Booking creation still works | PLACEHOLDER |
| LH 011 | B1, B2, D1 | `LH011-U` normalize/rename/archive/map | `LH011-I` member auth; `LH011-L` topic/history provenance | Skill moderation/public catalog unchanged | PLACEHOLDER |
| LH 012 | B2, D1 | `LH012-U` objective/DoD validation/version | `LH012-I` member auth; `LH012-C` optimistic-lock conflict | Booking note and UI long-text behavior | PLACEHOLDER |
| LH 020 | E1, I1 | `LH020-U` mode/checklist rules | `LH020-I` Booking integration and immutable-after-delivery guard | `LH020-R` legacy Live/Calendar/Meet/cancellation | PLACEHOLDER |
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
| LH 100 | A1, M1 | `LH100-U` support permission/audit fields | `LH100-I` report flow; `LH100-S` no bulk private access | Admin role and dispute resolution | PLACEHOLDER |

## Required cross-cutting suites

| Suite | Cases | Owner | Status |
| --- | --- | --- | --- |
| Authorization | Unauthenticated, suspended, spoofed actor, non-member IDOR, archived member, admin reason/audit | A1, A2, M1 | PLACEHOLDER |
| Migration | Clean DB, representative legacy rows, nullable Booking fields, rollback, no row loss | B1 | PLACEHOLDER |
| Mode transitions | All allowed/forbidden transitions for LIVE, EXERCISE_REVIEW, HYBRID | E1, I1 | PLACEHOLDER |
| Settlement | Double click, concurrent request/cron, dispute, rollback, ledger reconciliation | I2, I3 | PLACEHOLDER |
| Storage | MIME/extension mismatch, size/quota, orphan, expiry, delete, filename/path, provider failure | F1, F2 | PLACEHOLDER |
| UI/accessibility | Empty/loading/error, mobile, keyboard/focus/labels/contrast, long Vietnamese | C2, D1, F2, G2, K1 | PLACEHOLDER |
| Analytics/privacy | Event definitions, dedupe, raw counts, no private content | L1, M1 | PLACEHOLDER |

## Task 00 baseline evidence

| Command/test | Result |
| --- | --- |
| `npm run db:generate` | BASELINE FAIL: Windows EPERM replacing Prisma query-engine DLL |
| `npx prisma validate` | BASELINE PASS |
| `npm run lint` | BASELINE FAIL: 78 errors and 32 warnings |
| `npx tsc --noEmit` | BASELINE PASS |
| `npm run build` | BASELINE PASS; middleware deprecation warning |
| Five `scripts/test-*.cjs` offline regressions | BASELINE PASS; exact results in `IMPLEMENTATION_STATE.md` |

## Future canonical commands

Task 01 must create and self-test these package scripts before later tasks rely on them: `npm run typecheck`, `npm run test:learning-hub`, `npm run test:learning-hub:integration`, and `npm run test:regression`. Database-writing tests require an explicit disposable database URL and must never print secrets.
