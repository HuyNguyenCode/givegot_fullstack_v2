# H1 migration rollback

Back up the database and pause note writers before applying migration 007. Rehearse the forward SQL against a disposable clean database and a representative legacy copy before shared deployment; verify existing notes read as GENERAL with their original content and version.

The paired rollback SQL takes an exclusive LearningNote lock and refuses to drop H1 columns if any recap or soft-deleted note exists. After H1 writes, retain the columns and roll forward. Do not use `prisma db push` on a shared database.
