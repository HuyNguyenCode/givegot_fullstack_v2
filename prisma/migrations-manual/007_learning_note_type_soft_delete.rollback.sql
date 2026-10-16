-- Refuse destructive rollback once H1 data exists. Preserve rows and roll forward.
BEGIN;
LOCK TABLE "LearningNote" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "LearningNote" WHERE "type" = 'RECAP' OR "deletedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'H1 note data exists; export and roll forward instead';
  END IF;
END $$;
DROP INDEX "LearningNote_learningSpaceId_deletedAt_createdAt_idx";
ALTER TABLE "LearningNote" DROP COLUMN "deletedById", DROP COLUMN "deletedAt", DROP COLUMN "type";
DROP TYPE "LearningNoteType";
COMMIT;
