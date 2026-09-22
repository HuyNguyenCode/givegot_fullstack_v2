# GiveGot Learning Hub — Micro Repair Contract

Use this contract only for narrowly scoped bug fixes and UX repairs.

## Core rule

Make the smallest coherent change required to fix the reported issue.

Repository state is the source of truth.

## Before editing

- Inspect git status.
- Preserve all pre-existing user changes.
- Inspect only the files directly relevant to the defect first.
- Read CONTEXT_PACKET.md and IMPLEMENTATION_STATE.md.
- Read MASTER_SPEC / ADR / risk docs only if the repair touches their contract.

## Never do unless explicitly required by the repair

- schema or migration changes
- API contract changes
- service-layer redesign
- auth/session changes
- storage/provider changes
- Booking lifecycle changes
- GivePoint / wallet / ledger changes
- fulfillment / settlement changes
- cron changes
- notification architecture changes
- new dependencies
- unrelated refactoring
- future playbook tasks
- roadmap changes

## Compatibility

Preserve:
- existing F1/F2 behavior
- legacy Booking flows
- private artifact boundaries
- old rows
- future G1+ interfaces

If the repair requires crossing one of these boundaries:
STOP and report the conflict.

## Diff budget

Expected production diff:
- normally 1–2 implementation files
- normally 1 targeted test file
- no docs unless contract/state actually changes

Do not perform cleanup "while here".

## Verification

For a pure UI/component repair:

Mandatory:
- targeted test
- typecheck
- targeted ESLint
- git diff --check
- final git diff review

Escalate to broader tests only when the changed code can affect those layers.

Do not run a second Next.js build while another build process or `.next/lock`
is active.

## Completion

Report:
- root cause
- exact files changed
- tests run
- any skipped broader verification and why it was unnecessary
- final git status
- confirmation that future playbook task remains unchanged

Do not commit or push.
Stop after the repair.