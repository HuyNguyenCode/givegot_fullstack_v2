# Learning Hub Implementation Plan

## Current post-I1 checkpoint (2026-10-26)

I1 mode-aware fulfillment is implemented under ADR 020. Migration 008 passed disposable TEST and was applied to STAGING on 2026-10-21 with precheck/postcheck PASS and 102 historical Booking rows preserved; production remains unmigrated. The 11-case automated gap audit and owner-reported 2026-10-26 localhost/STAGING browser-session smoke are recorded at distinct evidence levels in IMPLEMENTATION_STATE and TEST_MATRIX. Unauthenticated GET redirected to sign-in and returned HTML after fetch followed it, rather than the expected 401 JSON; this LOW-priority API contract deviation awaits a client-compatibility/contract decision. I2 linked settlement is NEXT, NOT STARTED; I3 cron/deadline policy remains pending.

## Historical H2 checkpoint (2026-10-16)

H2/LH 060 is implemented with the 2026-10-19 PASS WITH KNOWN LIMITATION audit-repair checkpoint and the privacy/fulfillment limitations recorded in IMPLEMENTATION_STATE. I1 remains separately owner-authorized; optional I0 is audit-only and may precede it. Do not start I1/I2/I3 or J1 automatically. No migration or settlement action was part of H2.

## Historical H1/LH 050 plan checkpoint (reconciled 2026-10-16)

H1 implementation is COMPLETE. Migration 007 passed disposable TEST forward/rollback/refusal/cleanup and STAGING forward/schema/Prisma checks; no PRODUCTION migration. Initial full suites passed 123/123 unit and 58/58 integration; latest H1-11 focused suites passed 9/9 Notes unit and 2/2 route. Owner-reported H1-01–H1-20 browser cases passed 20/20, including H1-09/11/15 retests; no independent browser automation was run. This is historical H1 evidence. H2/LH 060 is implemented with the 2026-10-19 PASS WITH KNOWN LIMITATION audit-repair checkpoint; I1/I2/I3 and J1 remain pending. The dated G3/D0 checkpoints below remain historical.

### Deferred product and UX backlog

- H1-UX-01 (P2, not an H2 blocker): long or numerous notes create excessive vertical scrolling. Consider collapsed previews with bounded pagination or load-more.
- H1-UX-02 (P2, not an H2 blocker): editing a note near the bottom requires scrolling to the editor at the top. Consider inline editing.
- Group Learning / Multi-learner Slots (Post-MVP): the current MVP permits two active space members, so `BOOKING_PARTICIPANTS` and `SPACE_MEMBERS` commonly resolve to the same two people today. Preserve both visibility semantics. Future contributors may choose learner capacity per slot/session; group Booking, membership, attendance, privacy, and GivePoint economics require separate design before implementation.

## Historical G3 implementation checkpoint (2026-10-15)

G3 LH 042 is implemented from clean committed D0e HEAD `3e0cb6f8c2bf0d009195f0305f8979b7fccd516b`, under the owner's explicit G3 prompt. Status PASS WITH KNOWN LIMITATION: 118 unit tests, 56 integration tests plus route smoke, five legacy regressions, typecheck, targeted lint, build, and diff check passed. Full lint retains 77 errors/32 warnings in legacy files. Browser smoke and real PostgreSQL G3 races have not run; service concurrency/rollback coverage uses a transactional mock. ADR 018 records eligible task-creator review, task-only REVIEWED/revision transitions, optional independent deadline, and current-content/content-free audit boundaries. I1-I3 and J1 remain pending and no next task is authorized. Earlier D0e/D0d checkpoint statements below are historical.

## Historical D0e checkpoint (reconciled 2026-10-14)

D0e FILE deletion protection is implemented and verified. The F1 Serializable reference check and conditional soft delete preserve G2's existing Serializable transaction and provider cleanup after commit. No schema, migration, advisory lock, orphan-cleanup, F2 LINK, or G3 work changed. The later bounded UI repair adds precise current-Submission conflict messaging and removes actionable FILE deletion in ARCHIVED spaces; it changes no backend behavior. Focused F1 22/22, Learning Hub unit 105/105, Learning Hub integration 53/53, four controlled real PostgreSQL race scenarios, typecheck, targeted lint, five offline legacy regressions, and diff check passed. The backend independent audit was `PASS WITH FINDINGS` with LOW-only documentation findings; it reviewed source/evidence and did not rerun the database tests. The owner reports D0e M01-M05 PASS. Focused UI 19/19 and relevant F1/F2 integration 28/28 passed after the UI repair. No independent UI re-audit or production build was run. D0e is uncommitted; G3 is NOT STARTED and is not authorized by this checkpoint.

## Historical D0 dependency note (updated 2026-10-13)

D0a, D0b, and D0c are COMPLETE: purpose schema, F1 purpose assignment, and scoped F2 resource reads passed their required verification. D0d, UX1, UX2, and D0d-F1 are implemented and uncommitted. F1's automated checks passed; the owner reports all D0d browser smoke and P1 regression scenarios PASS, including G2 blocked-request failure/retry, private file download, P1-01 navigation/upload success and failure recovery, and P1-02 pending-edit lock/navigation/failure recovery/retry. These are owner-reported browser results, not independently reproduced automated results. No next implementation task is selected. D0e current-attachment deletion protection is NOT STARTED and needs owner approval; G3 private SubmissionReview is NOT STARTED.

Deferred work, not D0d fixes: BUG-033 (excessively long G2 text and submission presentation); GG-LH-UI-002 (existing-file picker expands into a long inline list instead of a height-limited dropdown); GG-LH-F1-001 (DOCX upload/download support, a P1 enhancement before pilot; current F1 does not support DOCX).

### Deferred F2 LINK purpose question

F2 link creation still relies on the `LEGACY_UNCLASSIFIED` database default, and D0c intentionally left that write path unchanged. D0d intentionally preserves this write path because D0c includes LEGACY_UNCLASSIFIED links in materials. Explicit server-side MATERIAL stamping for new links remains a separate bounded decision; D0d did not approve or implement it.

The registry and historical task evidence below retain their original sequence.

## Execution rules

- Run tasks sequentially from the latest documented checkpoint. Do not begin the next task automatically.
- Before coding, record affected files, invariants, data impact, rollback, and tests.
- Prefer additive changes. Stop for owner review before changing GivePoint policy, privacy, or an irreversible migration.
- Do not combine two high-risk areas such as authorization and settlement, migration and UI, or storage and AI.
- Stage explicit paths only; never clean, reset, or absorb unrelated user changes.
- Use the current post-I1 checkpoint (2026-10-26): H1, H2, and I1 are implemented; migration 008 is on TEST and STAGING, not production. I2 linked settlement is NEXT, NOT STARTED; I3 and J1 remain pending. R-004, R-010, and R-017 retain their release gates. Dated older checkpoint statements are historical.

## Task registry

| Task | Scope | Depends on | Outcome |
| --- | --- | --- | --- |
| 00 | Control plane and baseline | None | Repository memory and factual baseline; no production behavior change |
| 01 | Minimal test harness | 00 | Canonical repeatable unit, integration, and regression commands |
| A1 | Server identity and authorization | 01 | Session identity closes spoofing and object access gaps |
| A2 | Realtime and cron security | A1 | Private channel authorization and enforced production `CRON_SECRET` |
| B1 | Learning Hub schema migration | A1 | Reviewed additive models, nullable Booking fields, legacy fixtures, rollback |
| B2 | LearningSpace services | B1 | Pair membership, mutable primarySkill, topics, objective, reuse suggestion |
| C1 | Invite backend | B2 | Secure idempotent create/accept invite |
| C2 | Invite onboarding UI | C1, D1 | Bring Your Pair journey and first-value prompt |
| D1 | LearningSpace shell | B2 | Authorized persistent pair workspace |
| E1 | Booking and mode integration | B2 | LIVE, EXERCISE_REVIEW, HYBRID contracts without legacy regression |
| F1 | Private storage infrastructure | B2 | Signed upload/download, quota, finalize, orphan handling |
| F2 | Resource domain and UI | F1, D1 | Safe links/files and lifecycle |
| G1 | Task domain | B2, E1 | Assignment and acceptance criteria |
| G2 | Submission workflow | G1, F2 | Current Submission and revisions |
| G3 | Submission review | G2 | Private feedback and revision requests |
| H1 | Manual notes and recap | D1 | Private versioned notes |
| H2 | Structured activity feed | F2, G3, H1 | Deduplicated structured events |
| I1 | Fulfillment state machine | E1, G3 | Mode-aware transition eligibility |
| I2 | GivePoint settlement | I1 | Atomic idempotent ledger release |
| I3 | Mode-aware cron | I2 | No premature async/Hybrid settlement |
| J1 | Learning notifications | G3, I2 | Dedupe, retry, deep links, private payload policy |
| K1 | History and rebook | H2, I3 | Persistent relationship history with legacy rows |
| K2 | Contribution evidence | K1 | Derived privacy-safe aggregates |
| L1 | Feature flags and analytics | C2, K1 | Pilot measurement and server-enforced kill switch |
| M1 | Pre-pilot audit | L1 | Independent security, privacy, migration, settlement review |
| N1 | Release audit | M1 | Evidence-based release decision |
| P1A | VIDEO link mode | Pilot gate | Conditional P1 mode |
| P1B | DOCUMENT mode | Pilot gate | Conditional P1 mode |
| P1C | ASYNC_Q_AND_A mode | Pilot gate | Conditional P1 mode |
| P2A | AI source and consent boundary | AI gate | Explicit source selection and provenance |
| P2B | AI draft recap | P2A | Editable reviewed draft only |
| P3A | Managed video provider | Video gate | Direct upload, webhook, signed playback |
| P3B | Meet artifact consent | Consent gate | OAuth scopes, organizer rights, disclosure |
| P3C | Transcript processing | P3B | Async processing, retention, deletion |

Critical P0 path: `00 -> 01 -> A1 -> B1 -> B2`. Tasks touching shared schema or Booking remain sequential. Artifact workflows F/G/H precede fulfillment I. L, M, and N gate pilot expansion.

## P0 requirement traceability

Every P0 requirement has an implementation owner and named test placeholders. Definitions live in `TEST_MATRIX.md`; none may be marked PASS before executable coverage exists.

| Requirement | Implementation task(s) | Test placeholders |
| --- | --- | --- |
| LH 001 | C1 | LH001-U, LH001-I, LH001-S |
| LH 002 | C1, C2 | LH002-U, LH002-I, LH002-C |
| LH 010 | B1, B2, D1 | LH010-U, LH010-I, LH010-L |
| LH 011 | B1, B2, D1 | LH011-U, LH011-I, LH011-L |
| LH 012 | B2, D1 | LH012-U, LH012-I, LH012-C |
| LH 020 | E1, I1 | LH020-U, LH020-I, LH020-R |
| LH 030 | F2 | LH030-U, LH030-I, LH030-S |
| LH 031 | F1, F2 | LH031-U, LH031-I, LH031-S |
| LH 032 | F1, F2 | LH032-U, LH032-I, LH032-S |
| LH 040 | G1 | LH040-U, LH040-I, LH040-S |
| LH 041 | G2 | LH041-U, LH041-I, LH041-C |
| LH 042 | G3 | LH042-U, LH042-I, LH042-R |
| LH 050 | H1 | LH050-U, LH050-I, LH050-C |
| LH 060 | H2 | LH060-U, LH060-I, LH060-R |
| LH 070 | I1, I2, I3 | LH070-U, LH070-I, LH070-X, LH070-R |
| LH 080 | K1 | LH080-U, LH080-I, LH080-L |
| LH 090 | J1 | LH090-U, LH090-I, LH090-R |
| LH 100 | A1, M1 | LH100-U, LH100-I, LH100-S |

Legend: U unit/state rules; I service/route integration; S security/authorization; C concurrency; L legacy-data compatibility; R legacy regression; X settlement/reconciliation.

## Release gates

| Gate | Required evidence |
| --- | --- |
| Security | No critical/high object authorization, secret, private-file, or public-realtime finding |
| Settlement | Reconciliation zero; retry/concurrent cron cannot duplicate credit |
| Migration | Clean and representative legacy databases migrate; rollback rehearsed |
| Product | 5-10 pairs onboard; at least five complete learning loops |
| Differentiation | Exercise Review or Hybrid used for real work, not only LIVE |
| Reliability | No unresolved stuck fulfillment without runbook; provider failure preserves domain state |
| Measurement | Activation, loop completion, rebook, week-2, week-4 definitions fixed |
