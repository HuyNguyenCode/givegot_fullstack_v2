-- H1: additive defaults preserve existing LearningNote rows.
BEGIN;
CREATE TYPE "LearningNoteType" AS ENUM ('GENERAL', 'RECAP');
ALTER TABLE "LearningNote" ADD COLUMN "type" "LearningNoteType" NOT NULL DEFAULT 'GENERAL';
ALTER TABLE "LearningNote" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "LearningNote" ADD COLUMN "deletedById" TEXT;
CREATE INDEX "LearningNote_learningSpaceId_deletedAt_createdAt_idx" ON "LearningNote"("learningSpaceId", "deletedAt", "createdAt");
COMMIT;
