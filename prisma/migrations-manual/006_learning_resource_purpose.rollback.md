# D0a resource-purpose migration rollback

Migration 006 adds a non-null `LearningResource.purpose` enum with the database default `LEGACY_UNCLASSIFIED`. Existing rows receive that value without guessing whether they were learning materials or submission attachments. No Booking, Task, Submission, relation, storage key, or provider object is changed.

## Before applying

- Back up the database and record resource row counts and current references. Rehearse forward and rollback SQL on a clean disposable database and a representative legacy copy after migrations 004 and 005. Do not use `prisma db push` on shared data.
- Pause resource writers for the shared migration window and verify the deployed schema. The forward SQL is transactional; an error before `COMMIT` leaves neither the enum nor the column.

## Rollback

Prefer rolling application code forward while retaining this additive column after purpose-classified writes begin. The paired rollback SQL locks `LearningResource` and refuses to drop the column when any `MATERIAL` or `SUBMISSION_ATTACHMENT` row exists. A failed guard aborts the transaction and leaves the enum, column, and rows intact.

If a physical rollback is required, stop all resource writers, export resource IDs and purpose values under the normal encrypted backup policy, and obtain an explicit preservation/recovery plan for classified rows. Do not relabel or delete them merely to pass the guard. Only run the paired SQL when it is safe to lose the all-legacy purpose column, then verify resource counts, Submission attachment references, legacy Booking queries, and the absence of the D0a column and enum. Roll back application code that reads `purpose` before dropping the column. Do not log private filenames, storage keys, or content.
