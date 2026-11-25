BEGIN;

LOCK TABLE "LearningSpace" IN ACCESS EXCLUSIVE MODE;

DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM "LearningSpace" WHERE "primarySkillId" IS NULL) THEN
    RAISE EXCEPTION 'LearningSpace rollback refused: spaces without a primary skill exist';
  END IF;

  IF EXISTS (SELECT 1 FROM "LearningSpace" WHERE "creationOrigin" IS NOT NULL) THEN
    RAISE EXCEPTION 'LearningSpace rollback refused: spaces with recorded origin exist';
  END IF;
END
$guard$;

ALTER TABLE "LearningSpace"
  ALTER COLUMN "primarySkillId" SET NOT NULL,
  DROP COLUMN "creationOrigin";

DROP TYPE "LearningSpaceCreationOrigin";

COMMIT;
