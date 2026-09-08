-- BR-11 additive migration. REVIEW/BACKUP FIRST. Do not use db push instead.
-- Run once using a reviewed direct PostgreSQL connection, with app writers paused.
BEGIN;
CREATE TYPE "SkillEmbeddingStatus" AS ENUM ('NOT_STARTED','PROCESSING','READY','FAILED');
ALTER TABLE "Skill"
  ADD COLUMN "embeddingStatus" "SkillEmbeddingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  ADD COLUMN "embeddingVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "embeddingAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "embeddingToken" TEXT,
  ADD COLUMN "embeddingStartedAt" TIMESTAMP(3),
  ADD COLUMN "embeddingError" TEXT;
-- Retain an audit/rollback snapshot before changing any legacy vector.
CREATE SCHEMA IF NOT EXISTS br11_audit;
REVOKE ALL ON SCHEMA br11_audit FROM PUBLIC;
CREATE TABLE br11_audit."_BR11SkillEmbeddingBackup" AS
  SELECT id, name, status, embedding, NOW() AS "snapshotAt" FROM "Skill";
-- Keep previously approved, usable vectors available without regeneration.
UPDATE "Skill" SET "embeddingStatus" = 'READY'
WHERE status = 'APPROVED' AND embedding IS NOT NULL
  AND vector_dims(embedding) = 768 AND (embedding <#> embedding) < 0;
-- Pending/rejected and invalid vectors are not eligible for publication.
UPDATE "Skill" SET embedding = NULL WHERE "embeddingStatus" <> 'READY';
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_ready_requires_approved_vector"
CHECK ("embeddingStatus" <> 'READY' OR
  (status = 'APPROVED' AND embedding IS NOT NULL
   AND vector_dims(embedding) = 768 AND (embedding <#> embedding) < 0));
COMMIT;
