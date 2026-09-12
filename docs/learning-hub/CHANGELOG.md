# Learning Hub Changelog

## 2026-09-11 Task 00 Control plane and baseline

### Added

- Created the ten-file Learning Hub repository memory set.
- Consolidated LH 001 through LH 100, P0-P3, out-of-scope boundaries, accepted architecture decisions, implementation sequence, test placeholders, legacy regressions, risks, and operational guidance.
- Recorded branch/commit, exact pre-existing dirty files, current routes, schema/models, scripts, environment variable names without values, manual migrations, and high-risk paths.
- Verified current client-controlled identity behavior in conversations/messages and current `CONFIRMED` plus `endTime` 72-hour auto-complete behavior.
- Recorded command exits and exact offline regression results.

### Not changed

- No application, API, component, action, library, configuration, package, schema, database row, migration, or DOCX file was changed.
- No Learning Hub feature was implemented.
- Pre-existing DOCX deletions and untracked reference DOCX files were preserved.

### Baseline

- PASS: Prisma validate, TypeScript no-emit, Next.js build, five offline regression scripts.
- FAIL, pre-existing/unfixed: Prisma generate Windows EPERM on locked query-engine DLL.
- FAIL, pre-existing/unfixed: lint with 78 errors and 32 warnings.
- Warning: Next.js reports deprecated `middleware` file convention.
- Documentation limitation: DOCX paragraph/table extraction completed; visual rendering could not start because bundled LibreOffice was unavailable.

### Compatibility and rollback

Production behavior and data compatibility are unchanged. Rollback consists only of removing the ten new Markdown files; do not touch the user-owned DOCX changes.
