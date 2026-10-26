# I1 rollback

Pause fulfillment writers and export Booking fulfillment fields and LearningActivity before rollback. PostgreSQL enum labels cannot be removed safely while rows may use them. Prefer rolling application code forward. Removing `fulfillmentVersion` would discard concurrency history; do so only after proving no I1 writes and retaining an export. I1 does not apply this migration to any shared database automatically.
