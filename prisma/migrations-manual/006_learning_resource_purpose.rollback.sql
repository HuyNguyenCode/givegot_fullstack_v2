-- Stop resource writers before rollback. Keep the guard and DDL in one transaction.
BEGIN;

LOCK TABLE "LearningResource" IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "LearningResource"
    WHERE "purpose" IN ('MATERIAL', 'SUBMISSION_ATTACHMENT')
  ) THEN
    RAISE EXCEPTION 'Resource purpose rollback refused: classified rows require an explicit preservation plan';
  END IF;
END
$guard$;

ALTER TABLE "LearningResource" DROP COLUMN "purpose";
DROP TYPE "LearningResourcePurpose";

COMMIT;
