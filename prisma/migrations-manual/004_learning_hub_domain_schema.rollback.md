# Task B1 rollback note

`004_learning_hub_domain_schema.rollback.sql` is the reviewed structural rollback for `004_learning_hub_domain_schema.sql`.

## Preconditions

- Pause all application and job writers.
- Confirm the deployed migration is exactly `004_learning_hub_domain_schema.sql` and no later migration depends on its objects.
- Export the ten Learning Hub tables and the eight nullable Learning Hub columns on `Booking`. The rollback deletes those new-domain records and fields; it must not be used after production writes without an owner-approved recovery or archival plan.
- Record row counts and retain the export under the normal encrypted backup policy. Do not copy private note, submission, resource, or activity content into logs.

## Procedure

1. Run the rollback SQL through a direct PostgreSQL connection inside a maintenance window.
2. Verify all legacy `Booking` rows and the six existing `BookingStatus` labels remain unchanged.
3. Run legacy Booking queries, `npm run test:regression`, and `npm run build` before resuming writers.

The forward migration has no backfill, no `BookingStatus` change, and only nullable additions to `Booking`, so structural rollback does not need to reinterpret any legacy row. Roll-forward is preferred once Learning Hub data exists: restore the exported new-domain data into a freshly reapplied B1 schema rather than attempting an unreviewed partial downgrade.
