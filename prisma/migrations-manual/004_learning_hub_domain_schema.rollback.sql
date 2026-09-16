-- Task B1 rollback rehearsal script.
-- WARNING: This removes every Learning Hub row. Before production rollback,
-- stop writers and export all ten Learning Hub tables plus the eight new
-- Booking columns. Do not run after Learning Hub writes without that recovery
-- artifact and an owner-approved data disposition.
-- Legacy BookingStatus values and legacy Booking columns are never changed.
BEGIN;

ALTER TABLE "Booking" DROP CONSTRAINT "Booking_learningSpaceId_fkey";
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_topicId_fkey";

ALTER TABLE "Booking"
  DROP COLUMN "learningSpaceId",
  DROP COLUMN "topicId",
  DROP COLUMN "learningMode",
  DROP COLUMN "objective",
  DROP COLUMN "definitionOfDone",
  DROP COLUMN "fulfillmentStatus",
  DROP COLUMN "deliveredAt",
  DROP COLUMN "acceptedAt";

DROP TABLE "LearningActivity";
DROP TABLE "LearningNote";
DROP TABLE "SubmissionReview";
DROP TABLE "Submission";
DROP TABLE "LearningTask";
DROP TABLE "LearningResource";
DROP TABLE "LearningInvite";
DROP TABLE "LearningTopic";
DROP TABLE "LearningSpaceMember";
DROP TABLE "LearningSpace";

DROP TYPE "LearningNoteVisibility";
DROP TYPE "SubmissionReviewOutcome";
DROP TYPE "SubmissionStatus";
DROP TYPE "LearningTaskStatus";
DROP TYPE "LearningResourceStatus";
DROP TYPE "LearningResourceKind";
DROP TYPE "LearningInviteStatus";
DROP TYPE "LearningTopicStatus";
DROP TYPE "LearningSpaceMemberStatus";
DROP TYPE "LearningSpaceStatus";
DROP TYPE "FulfillmentStatus";
DROP TYPE "LearningMode";

COMMIT;
