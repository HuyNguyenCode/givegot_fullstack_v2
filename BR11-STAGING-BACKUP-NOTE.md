# BR-11 staging backup — 2026-09-04

- User confirmed staging is separate from production and stopped the app; authorized downloading tools and exporting staging.
- Portable PostgreSQL 17.11 tools from EDB: `F:/givegot-staging-backups/tools/pgsql/bin`. Only pg_dump, pg_restore, psql and supporting DLLs extracted. No server installed/started or PATH changes. ZIP retained outside Git.
- Used configured DIRECT_URL, session pooler port 5432, TLS required and read-only session option. Credentials passed in child-process environment, not logs or command arguments.
- Source PostgreSQL 17.6; reported database size 14 MB.
- Backup: `F:/givegot-staging-backups/staging-before-br11-2026-09-04T09-56-52-664Z.dump`
- Size: 1,461,073 bytes; pg_dump custom format, no schema/table exclusions; exit 0.
- SHA256: `A68AEC42F51DFCFCEB9DCA6649903E064A2833DAC813BD46A4B6AF65853F683C`
- Verified pg_restore list (771 entries), TABLE DATA entries for Skill/UserSkill/Booking/Review/TransactionLog, and full archive decode to NUL (exit 0, no DB connection).
- NOT yet restore-tested. Restore into a separate disposable DB and check data before considering recovery verified. Do not restore blindly over staging/production.
- Logical database backup is not a complete Supabase project backup: excludes Storage file contents, project configuration, Edge Function source and cluster-global roles. Managed schemas may need an adapted restore procedure.
- File contains sensitive data and was not encrypted by this workflow. Keep private; do not commit/upload/share it.
- No migration/restore or application source changes in this step; only this note added. Database unchanged. Earlier Prisma Client generation succeeded after stopping app.

## Staging migration — 2026-09-08

- User approved running BR-11 migration on the isolated staging database.
- Preflight: readiness schema absent; 59 skills and 54 legacy vectors.
- Applied `prisma/migrations-manual/002_skill_embedding_readiness.sql` with `ON_ERROR_STOP=1`; transaction committed.
- Result: 51 APPROVED/READY, 5 APPROVED/NOT_STARTED and 3 PENDING/NOT_STARTED. Eight ineligible/invalid vectors cleared.
- Verified: zero invalid READY skills, zero unapproved vectors, snapshot has 59 skills, and constraint exists.
- Counts preserved: Skill 59, UserSkill 428, Booking 85, Review 35, TransactionLog 181.
- Prisma Client generation, all three offline BR-11 test groups and TypeScript no-emit check passed.
- Staging only; no production or restore operation.

Sources: https://www.postgresql.org/download/windows/ ; https://www.enterprisedb.com/download-postgresql-binaries ; https://supabase.com/docs/guides/platform/backups
