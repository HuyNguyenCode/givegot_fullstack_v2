# Migration 009 rollback

Migration 009 makes the Space skill optional and adds a nullable creation origin without a default or backfill. Existing skill references and indexes stay in place.

Before a shared rollout, verify the target schema and rehearse the forward and rollback SQL on a disposable PostgreSQL database in T3-B.2. Apply forward SQL before deploying the matching Prisma Client and application. Drain older instances before enabling skill-free writes.

For physical rollback, stop Space writers and retire application instances using the new column before running the paired SQL. The rollback locks the Space table and refuses if any row has a null skill or a recorded origin. Both checks run in the same transaction as the DDL, so a refusal leaves the expanded schema and rows intact. Preserve existing data and use a compatible application fix or roll forward after either kind of write. Older application versions with null-unsafe reads are unsafe once null-skill rows exist.
