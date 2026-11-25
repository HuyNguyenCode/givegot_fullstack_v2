BEGIN;

CREATE TYPE "LearningSpaceCreationOrigin" AS ENUM (
  'USER_INITIATED',
  'BOOKING_CONFIRMATION'
);

ALTER TABLE "LearningSpace"
  ALTER COLUMN "primarySkillId" DROP NOT NULL,
  ADD COLUMN "creationOrigin" "LearningSpaceCreationOrigin";

COMMIT;
