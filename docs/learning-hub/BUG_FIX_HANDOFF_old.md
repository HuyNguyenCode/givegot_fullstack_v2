# GiveGot Learning Hub — Durable Bug-Fix Handoff

## Purpose

THIS FILE IS DURABLE REPAIR CONTEXT, NOT CURRENT PROJECT STATE.

Use this file to carry forward stable bug-fixing knowledge across ChatGPT/Codex conversations without relying on old chat history.

Do **not** use this file to determine:
- the current implementation phase;
- the current open task;
- the current next playbook task;
- whether a previously observed bug is still present;
- whether a previous repair is pending or already completed.

Resolve current state from the repository, especially:
- `docs/learning-hub/IMPLEMENTATION_STATE.md`
- `docs/learning-hub/IMPLEMENTATION_PLAN.md`
- `docs/learning-hub/CONTEXT_PACKET.md`
- `docs/learning-hub/TEST_MATRIX.md`
- current code/tests
- `git status --short`

If anything in this handoff conflicts with current repository evidence, **current repository evidence wins**.

---

## 1. What belongs in this file

This file should contain only durable knowledge such as:
- stable repair principles;
- recurring regression risks;
- known tooling quirks;
- reusable manual-test lessons;
- architectural/product invariants that remain relevant across milestones;
- prior decisions that are still contractually important.

Do **not** append:
- every bug ever found;
- every repair result;
- current milestone status;
- current next task;
- temporary screenshots/logs;
- transient implementation details;
- one-off file names unless they represent a durable boundary.

If a repair creates no reusable lesson, this file does not need to change.

---

## 2. Repository authority and repair discipline

For every repair:
1. Treat repository state as source of truth.
2. Inspect `git status --short` first.
3. Preserve all pre-existing user changes.
4. Fix the smallest coherent defect.
5. Do not refactor unrelated code.
6. Do not perform cleanup "while here".
7. Do not begin the next playbook task during a repair.
8. Do not commit or push unless explicitly requested.
9. After Codex completes, review the diff and manually retest the reported behavior before committing.

If the smallest safe repair requires crossing an unexpected architecture/API/schema/auth/storage/business-rule boundary, stop and reclassify/escalate instead of silently broadening scope.

---

## 3. Bug classes and proportional verification

### Class A — micro UI / cosmetic
Typical examples:
- copy;
- spacing;
- hover/focus;
- clickable affordance;
- small responsive/layout change;
- simple presentation behavior.

Default model guidance:
- GPT-5.6 Terra
- Light

Typical verification:
- targeted test;
- typecheck;
- targeted ESLint;
- `git diff --check`;
- final diff review.

Do not run full integration/regression/build by default.

### Class B — local component behavior
Typical examples:
- local state updates;
- form behavior;
- delete UX;
- list filtering;
- button state;
- local mutation/refetch behavior;
- presentation/grouping using existing contracts.

Default model guidance:
- GPT-5.6 Terra
- Medium

Typical verification:
- targeted tests;
- relevant Learning Hub unit tests;
- typecheck;
- targeted ESLint;
- `git diff --check`;
- integration only if an API/service boundary is actually crossed.

### Class C — cross-boundary / high-risk
Typical examples:
- API/service;
- storage/provider;
- auth/session;
- schema/migration;
- Booking/domain lifecycle;
- GivePoint/wallet/ledger;
- settlement;
- cron;
- concurrency;
- security/privacy.

Default model guidance:
- GPT-5.6 Sol
- Medium or High according to blast radius.

Typical verification:
- targeted reproduction;
- relevant unit/integration tests;
- typecheck;
- targeted ESLint;
- broader regression/build checks only when the changed boundary warrants them.

Use Extra High only for genuinely high-risk architecture, migration, security, settlement, concurrency, or irreversible-data work.

Safety comes from narrow scope, correct contracts, stop conditions, targeted tests, and diff review—not simply from using the largest model.

---

## 4. Read-first principle

Do not make every repair read every repo document.

Minimum durable repair context normally comes from:
- `docs/learning-hub/MICRO_REPAIR_CONTRACT.md`
- `docs/learning-hub/CONTEXT_PACKET.md`
- `docs/learning-hub/IMPLEMENTATION_STATE.md`
- this file: `docs/learning-hub/BUG_FIX_HANDOFF.md`
- relevant implementation files;
- relevant targeted tests.

Escalate reading according to blast radius.

For local UI/component repairs, read only directly relevant contracts/tests.

For API/service/storage/auth/schema/security/high-risk repairs, also inspect the directly relevant:
- `MASTER_SPEC.md`
- `ARCHITECTURE_DECISIONS.md`
- `TEST_MATRIX.md`
- `REGRESSION_CHECKLIST.md`
- `RISK_REGISTER.md`
- current service/provider/auth/domain paths and integration tests.

Do not omit an authoritative contract for a high-risk repair merely to save tokens.

---

## 5. Stable Learning Hub repair invariants

These are durable guardrails, but current repository evidence still has final authority.

### Identity / authorization
- Server session owns actor identity.
- Authorization must be enforced server-side.
- Private metadata/artifacts must not be exposed before authorization succeeds.
- Do not weaken membership/ownership checks for convenience.

### Storage / private artifacts
- Preserve the provider abstraction rather than coupling feature code directly to one storage provider.
- Private files remain private-by-default.
- Signed download credentials should be created on demand after explicit authorized user action, not eagerly while rendering/listing resources.
- Resource list/activity payloads must not expose signed URLs, storage keys, bucket paths, provider credentials, or equivalent private object identifiers.
- Internal randomized object keys must not leak into the user-facing filename merely because storage uses them internally.
- Configuration/provider failures should be diagnosed as configuration/provider failures rather than hidden by rewriting application logic.

### Resource deletion
- A soft-delete contract must not be converted into hard-delete merely to make the UI cleaner.
- UI may hide deleted resources from the normal active list while retaining backend audit/cleanup semantics.
- Destructive actions should not accidentally trigger unrelated navigation/reload behavior.
- Destructive UI should avoid accidental duplicate submissions.

### External links
- Generic learning-resource links and synchronous session/meeting links are separate product concepts unless the current repo explicitly changes that contract.
- Avoid server-side fetching of arbitrary user-supplied URLs unless a current authoritative contract explicitly introduces and secures such behavior.
- When a card contains destructive actions, avoid making the whole card an indiscriminate navigation target.

### Current-contract rule
Do not mechanically preserve an old milestone-specific behavior merely because it appears here.
Before mutation, verify the invariant against current code/tests/docs.

---

## 6. Manual-testing lessons

When testing browser behavior:
- clear DevTools Network before checking whether a request is eager or on-demand;
- distinguish page-load/list requests from requests triggered by explicit user action;
- inspect response status/body and server logs for 4xx/5xx before assuming root cause;
- distinguish app defects from environment/provider/tooling failures;
- manually retest the exact reported path after automated verification passes.

For private download behavior:
- verify no signed-download credential/request is created merely by loading the list;
- then trigger download explicitly and verify signing/download happens only at that point;
- verify the resulting file is usable and has a sensible user-facing filename.

For delete/mutation behavior:
- verify cancel/confirm/error/success separately where applicable;
- verify success updates only the necessary UI;
- verify failure leaves authoritative visible state intact;
- verify no full-page navigation/reload occurs unless it is intentionally part of the current product contract.

---

## 7. Batch repair strategy

For multiple small repairs within a feature/milestone:

repair
→ targeted verification
→ ChatGPT/diff review
→ manual retest
→ exact-file checkpoint/commit if desired
→ next repair

At the end of the repair batch:
- run the appropriate broader Learning Hub unit suite;
- run relevant integration tests;
- run required legacy regressions;
- run production build when it is part of the milestone/final gate;
- reconcile docs only if needed;
- confirm the current milestone is actually closed before moving to the next playbook task.

Do not pay full-suite verification cost for every tiny UI repair.

A Class C/shared high-risk repair may require broader verification immediately.

---

## 8. Windows / tooling knowledge

Known Windows `tsx` host failure may include:
- `uv_os_get_passwd`;
- `os.userInfo()`;
- `ENOMEM`.

If encountered:
- use only the already documented temporary compatibility workaround;
- do not add a permanent dependency just to bypass the host issue;
- remove temporary helper/preload files afterward;
- distinguish host/tooling failure from product regression.

Build-lock rule:
- never start a second `npm run build` while another build may still be active or `.next/lock` exists;
- inspect/wait for the existing process instead;
- do not create repeated build-lock loops.

---

## 9. Prompt-writing principles

A repair prompt should be as small as safely possible and explicitly state:
- exact defect/current behavior;
- expected behavior;
- risk-appropriate `READ FIRST`;
- strict scope;
- protected boundaries;
- diagnose-first requirement when root cause is uncertain;
- targeted test requirements;
- proportional verification;
- stop condition for unexpected scope expansion;
- final diff/status safety check;
- do not commit/push;
- stop after the repair.

Avoid vague tasks such as:
- "fix storage";
- "fix download";
- "improve resources".

Prefer behavior-specific instructions such as:
- preserve existing signing semantics and repair only the user-facing filename;
- preserve backend soft-delete semantics while changing active-list presentation;
- diagnose the exact source of a 500 before changing code.

Prompt length should scale with blast radius, not with habit.

---

## 10. Handoff maintenance rule

This file should change rarely.

Update it only when a repair teaches a durable lesson, for example:
- a newly discovered recurring tooling failure;
- a new cross-milestone invariant;
- a regression pattern likely to recur;
- a permanent product/architecture decision that future repairs must preserve.

Do not update it for:
- one-off cosmetic fixes;
- ordinary bug completion;
- temporary bug status;
- current task/next task;
- routine test results.

If this file becomes long or starts describing old milestone state, prune stale history instead of appending more.

The desired role of this file is:

`durable repair knowledge`

not:

`current project status`.

---

## 11. New-conversation usage

In a new ChatGPT/Codex bug-fix conversation:

1. Use this file as durable repair knowledge.
2. Resolve current phase/task/state from current repository docs and code.
3. Verify any handoff invariant that materially affects the repair.
4. Classify the bug and blast radius.
5. Choose model/effort proportionally.
6. Generate a narrow Codex prompt with explicit `READ FIRST`.
7. Run targeted verification appropriate to the actual diff.
8. Review Codex output rather than auto-trusting `PASS`.
9. Manually retest.
10. Commit exact intended files only after the repair is actually accepted.
