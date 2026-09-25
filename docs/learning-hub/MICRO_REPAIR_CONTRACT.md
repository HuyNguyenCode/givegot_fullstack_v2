# GiveGot Learning Hub — Micro Repair Contract

## Scope

Use this contract for:
- Class A — micro UI/cosmetic;
- Class B — local component behavior;
- Class C — bounded cross-boundary/high-risk repairs that still have a clear, limited blast radius.

Do NOT use this as the primary contract for Class D — Major / Cross-Domain / Incident defects.

If inspection shows the repair spans multiple architectural boundaries, requires a broad schema/contract redesign,
or carries meaningful data/security/concurrency/migration risk beyond a bounded repair:
STOP and reclassify to Class D.
Use `docs/learning-hub/MAJOR_REPAIR_CONTRACT.md`.

## Core rule

Make the smallest coherent change required to fix the reported defect.

Repository state is the source of truth.

## Before editing

- Inspect current working-tree state (for CLI Codex, `git status --short` is the normal default).
- Preserve all pre-existing user changes.
- Inspect only files directly relevant to the defect first.
- Read:
  - `docs/learning-hub/CONTEXT_PACKET.md`
  - `docs/learning-hub/IMPLEMENTATION_STATE.md`
- Read MASTER_SPEC / ADR / TEST_MATRIX / REGRESSION_CHECKLIST / RISK docs only when the repair touches those contracts.

## Never do unless explicitly required

- unrelated schema or migration changes;
- API contract changes;
- service-layer redesign;
- auth/session redesign;
- storage/provider redesign;
- Booking lifecycle redesign;
- GivePoint / wallet / ledger redesign;
- fulfillment / settlement redesign;
- cron redesign;
- notification architecture changes;
- new dependencies;
- unrelated refactoring;
- future playbook tasks;
- roadmap changes;
- cleanup "while here".

If the repair requires an unexpected protected-boundary change:
STOP and report before broadening scope.

If the blast radius is no longer bounded:
reclassify to Class D.

## Compatibility

Preserve:
- completed/current contracts outside the defect;
- legacy flows;
- private artifact boundaries;
- old-row compatibility;
- current API/schema contracts unless the diagnosed defect specifically requires a contract repair;
- future playbook interfaces.

## Diff budget

Expected for micro/bounded repair:
- normally 1–2 implementation files;
- normally 1 targeted test file;
- documentation changes normally zero.

Class C may legitimately exceed this when one bounded cross-layer path is involved,
but the repair must remain coherent and reviewable.

## Verification ladder

### Class A
Mandatory:
- targeted test;
- `npm run typecheck`;
- targeted ESLint;
- `git diff --check`;
- final diff inspection.

### Class B
Mandatory:
- targeted tests;
- relevant Learning Hub unit tests;
- `npm run typecheck`;
- targeted ESLint;
- `git diff --check`.

Integration only if the repair actually crosses an API/service boundary.

### Class C
Run:
- targeted reproduction;
- relevant unit/integration tests;
- typecheck;
- targeted ESLint;
- broader tests only when shared logic changed.

Run production build only when route/import/config/dependency/build boundaries changed
or when it materially adds confidence.

If the necessary verification becomes architecture-wide or migration/security/concurrency heavy,
reclassify to Class D.

## Windows/tooling

If the documented Windows `tsx` ENOMEM / `os.userInfo()` issue appears:
- use only the documented temporary preload workaround;
- do not add a permanent dependency;
- remove the helper afterward.

Never invoke a second `npm run build` while:
- another build may still be active; or
- `.next/lock` exists.

Wait for/inspect the existing process instead.

## Completion

Report:
- bug class/severity;
- root cause;
- exact files changed;
- tests run/results;
- broader verification intentionally skipped and why;
- final diff/status safety result;
- confirmation that no unrelated contract changed;
- current next safe task as resolved from repository state.

Do not commit or push unless explicitly asked.
Do not begin the next playbook task.
Stop after the repair.
