# Learning Hub Implementation Plan

## Execution rules

- Run tasks sequentially from the latest documented checkpoint. Do not begin the next task automatically.
- Before coding, record affected files, invariants, data impact, rollback, and tests.
- Prefer additive changes. Stop for owner review before changing GivePoint policy, privacy, or an irreversible migration.
- Do not combine two high-risk areas such as authorization and settlement, migration and UI, or storage and AI.
- Stage explicit paths only; never clean, reset, or absorb unrelated user changes.

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
