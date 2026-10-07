-- D0a: record resource intent without inferring the purpose of existing rows.
-- The database default also preserves writes from clients deployed before D0b.
BEGIN;

CREATE TYPE "LearningResourcePurpose" AS ENUM ('MATERIAL', 'SUBMISSION_ATTACHMENT', 'LEGACY_UNCLASSIFIED');

ALTER TABLE "LearningResource"
  ADD COLUMN "purpose" "LearningResourcePurpose" NOT NULL DEFAULT 'LEGACY_UNCLASSIFIED';

COMMIT;
