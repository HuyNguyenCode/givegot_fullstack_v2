# G1 migration rollback

Migration 005 adds `LearningTask.version INTEGER NOT NULL DEFAULT 1`. It does not alter Booking or historical task content. Apply the forward SQL only after backing up the database, checking representative old Booking and LearningTask rows, and testing on a disposable clean database and a legacy copy. Do not use `prisma db push` on shared data.

To roll back, stop task writers, export LearningTask rows and versions, run `005_learning_task_version.rollback.sql`, then verify task row counts and legacy Booking queries. Dropping the column loses edit-version history. Prefer roll-forward after production task writes. No rollback was executed for G1 because no disposable database URL was available and no shared database was changed.
