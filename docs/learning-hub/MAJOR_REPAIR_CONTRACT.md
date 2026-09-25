# GiveGot Learning Hub — Major Repair Contract

## Purpose

Use this contract for Class D — Major / Cross-Domain / Incident defects.

A Class D defect is not a normal micro repair.

Typical triggers:
- multiple architectural boundaries are involved;
- root cause is uncertain across several subsystems;
- repair may change schema, API contracts, architecture, or data semantics;
- real data, GivePoint/money-like state, settlement, concurrency, or security is at meaningful risk;
- compatibility/migration/rollback planning is required;
- one bounded Class C repair is not sufficient.

Repository state is the source of truth.

---

## 1. Default mode: diagnose before implementation

Do NOT immediately implement a Class D repair by default.

Run two phases:

### Phase 1 — Diagnosis / Impact Analysis
Goal:
- establish root cause;
- map affected boundaries;
- identify data/security/compatibility risk;
- propose the smallest safe repair plan;
- define verification and rollback strategy.

Implementation changes are not allowed in Phase 1 except:
- narrowly scoped diagnostic tests;
- temporary instrumentation;
- minimal reproduction harnesses;

and only when necessary to establish evidence.

Any temporary diagnostic artifact must be removed unless explicitly promoted into a permanent test.

### Phase 2 — Major Repair Implementation
Start only after Phase 1 diagnosis is reviewed and accepted.

Implement only the approved repair plan.

If new evidence contradicts the diagnosis or requires a broader architecture/data-contract change:
STOP and return to diagnosis instead of improvising.

---

## 2. Read first

Before diagnosis:
- inspect current working-tree state (for CLI Codex, `git status --short` is the normal default);
- preserve all pre-existing user changes;
- read:
  - `docs/learning-hub/CONTEXT_PACKET.md`
  - `docs/learning-hub/IMPLEMENTATION_STATE.md`
  - `docs/learning-hub/IMPLEMENTATION_PLAN.md`
  - `docs/learning-hub/MASTER_SPEC.md`
  - `docs/learning-hub/ARCHITECTURE_DECISIONS.md`
  - relevant `TEST_MATRIX.md`
  - relevant `REGRESSION_CHECKLIST.md`
  - relevant `RISK_REGISTER.md`
  - current schema/migrations if relevant
  - directly affected APIs/services/auth/storage/domain code
  - relevant unit/integration/regression tests

Read additional authoritative docs only when directly relevant.

Do not perform a broad repo tour without a concrete reason.

---

## 3. Phase 1 required diagnosis output

Phase 1 must determine:

1. Exact observed failure.
2. Reliable reproduction path.
3. Exact root cause or the narrowest proven root-cause boundary.
4. Affected components/services/domains.
5. Data model impact.
6. API/contract impact.
7. Backward compatibility impact.
8. Old-row/data migration impact.
9. Security/privacy impact.
10. Concurrency/transaction/idempotency impact.
11. Provider/runtime/config impact.
12. Regression surface.
13. Smallest safe repair strategy.
14. Alternatives considered and why they are rejected.
15. Verification plan.
16. Rollback/containment plan when applicable.
17. Expected files/boundaries likely to change in Phase 2.

If root cause remains uncertain:
DIAGNOSIS STATUS must be BLOCKED or PASS WITH KNOWN LIMITATION.
Do not authorize implementation based on guesswork.

---

## 4. Architecture and data safety

Do not:
- change architecture merely to make the bug disappear;
- silently redefine product semantics;
- rewrite unrelated modules;
- normalize old data without an explicit migration/compatibility plan;
- change idempotency/transaction semantics casually;
- weaken authorization/privacy boundaries;
- couple previously abstracted provider code to one concrete provider without an approved architecture reason;
- introduce hidden breaking changes.

When schema/data changes are necessary:
- define forward migration;
- define old-row compatibility;
- define backfill requirements;
- define failure/partial-migration behavior;
- define rollback or compensating strategy where practical.

When transaction/concurrency is involved:
- identify atomicity boundary;
- identify retry/idempotency behavior;
- identify duplicate/partial-success risk;
- test at least the meaningful race/failure paths.

When security/privacy is involved:
- prefer deny-by-default;
- verify authorization before private metadata/action;
- avoid leakage through logs/activity/list payloads/error messages;
- add regression tests for the exposed boundary.

---

## 5. Phase 2 implementation rules

Phase 2 must:
- follow the approved diagnosis;
- change only the necessary boundaries;
- preserve unrelated completed contracts;
- preserve future playbook compatibility;
- keep diffs coherent and reviewable;
- avoid opportunistic cleanup;
- avoid unrelated refactors;
- avoid dependency additions unless explicitly justified.

If a new dependency, schema redesign, or architecture change becomes necessary unexpectedly:
STOP and report before proceeding.

Do not begin future playbook tasks.

Do not commit or push unless explicitly requested.

---

## 6. Verification requirements

Verification must match the actual blast radius.

Minimum Class D verification typically includes:
- targeted reproduction test;
- directly relevant unit tests;
- directly relevant integration tests;
- regression tests across affected boundaries;
- typecheck;
- targeted ESLint;
- `git diff --check`;
- final diff/status review.

Add when applicable:
- migration validation;
- old-row/backward-compatibility tests;
- data-integrity tests;
- retry/idempotency tests;
- concurrency/race tests;
- auth/security/privacy regression tests;
- storage/provider failure-path tests;
- production build;
- manual multi-user/end-to-end scenario;
- rollback/containment validation.

Do not run unrelated suites merely for ceremony.
Do not skip directly relevant high-risk verification to save usage.

---

## 7. Stop conditions

STOP and report if:
- root cause cannot be established with sufficient confidence;
- required product semantics are unresolved;
- repair requires an unapproved architecture change;
- repair requires an unapproved schema/data migration;
- repair would break an existing public/internal contract;
- repair requires destructive data handling without a safe plan;
- security or privacy implications are unresolved;
- observed repo state contradicts the diagnosis;
- tooling/environment failure prevents trustworthy verification.

Do not mask blockers with speculative code.

---

## 8. Final report format

At the end of Phase 1 report:
1. Reproduction
2. Root cause
3. Affected boundaries
4. Data/schema impact
5. API/contract impact
6. Security/privacy impact
7. Concurrency/idempotency impact
8. Regression surface
9. Proposed repair plan
10. Verification plan
11. Rollback/containment plan
12. Risks / unresolved questions

End with:
`DIAGNOSIS STATUS: READY FOR IMPLEMENTATION / PASS WITH KNOWN LIMITATION / BLOCKED`

At the end of Phase 2 report:
1. Approved repair implemented
2. Exact files changed
3. Contract/schema/data changes
4. Compatibility/migration handling
5. Tests added/updated
6. Verification results
7. Known limitations
8. Confirmation unrelated contracts remain intact
9. Current next safe task resolved from repository state

End with:
`TASK STATUS: PASS / PASS WITH KNOWN LIMITATION / BLOCKED`

Stop after the approved repair.
