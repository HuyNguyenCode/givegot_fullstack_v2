-- Task B1: additive Learning Hub domain schema.
-- REVIEW/BACKUP FIRST. Apply through a direct PostgreSQL connection; never use
-- prisma db push against shared data. This migration intentionally performs no
-- historical backfill and does not alter BookingStatus or settlement behavior.
-- The two-active-member limit and same-pair space reuse policy are enforced by
-- a future server-session-backed application service, not an unsafe DB unique.
BEGIN;

CREATE TYPE "LearningMode" AS ENUM ('LIVE', 'EXERCISE_REVIEW', 'HYBRID');
CREATE TYPE "FulfillmentStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'DELIVERED', 'REVISION_REQUESTED', 'ACCEPTED', 'SETTLED');
CREATE TYPE "LearningSpaceStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "LearningSpaceMemberStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');
CREATE TYPE "LearningTopicStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "LearningInviteStatus" AS ENUM ('ACTIVE', 'ACCEPTED', 'REVOKED', 'EXPIRED');
CREATE TYPE "LearningResourceKind" AS ENUM ('LINK', 'FILE');
CREATE TYPE "LearningResourceStatus" AS ENUM ('PENDING', 'READY', 'QUARANTINED', 'DELETED');
CREATE TYPE "LearningTaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'REVISION_REQUESTED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'REVISION_REQUESTED', 'REVIEWED');
CREATE TYPE "SubmissionReviewOutcome" AS ENUM ('REVIEWED', 'REVISION_REQUESTED');
CREATE TYPE "LearningNoteVisibility" AS ENUM ('SPACE_MEMBERS', 'BOOKING_PARTICIPANTS', 'AUTHOR_ONLY');

ALTER TABLE "Booking"
  ADD COLUMN "learningSpaceId" TEXT,
  ADD COLUMN "topicId" TEXT,
  ADD COLUMN "learningMode" "LearningMode",
  ADD COLUMN "objective" TEXT,
  ADD COLUMN "definitionOfDone" TEXT,
  ADD COLUMN "fulfillmentStatus" "FulfillmentStatus",
  ADD COLUMN "deliveredAt" TIMESTAMP(3),
  ADD COLUMN "acceptedAt" TIMESTAMP(3);

CREATE TABLE "LearningSpace" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "primarySkillId" TEXT NOT NULL,
  "state" "LearningSpaceStatus" NOT NULL DEFAULT 'ACTIVE',
  "objective" TEXT,
  "definitionOfDone" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningSpace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningSpaceMember" (
  "learningSpaceId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" "LearningSpaceMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leftAt" TIMESTAMP(3),
  CONSTRAINT "LearningSpaceMember_pkey" PRIMARY KEY ("learningSpaceId", "userId")
);

CREATE TABLE "LearningTopic" (
  "id" TEXT NOT NULL,
  "learningSpaceId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "normalizedLabel" TEXT NOT NULL,
  "skillId" TEXT,
  "state" "LearningTopicStatus" NOT NULL DEFAULT 'ACTIVE',
  "creatorId" TEXT NOT NULL,
  "provenance" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningInvite" (
  "id" TEXT NOT NULL,
  "learningSpaceId" TEXT,
  "inviterId" TEXT NOT NULL,
  "acceptedById" TEXT,
  "tokenHash" TEXT NOT NULL,
  "primarySkillId" TEXT NOT NULL,
  "objective" TEXT,
  "status" "LearningInviteStatus" NOT NULL DEFAULT 'ACTIVE',
  "maxUses" INTEGER NOT NULL DEFAULT 1,
  "useCount" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "acceptedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningInvite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningResource" (
  "id" TEXT NOT NULL,
  "learningSpaceId" TEXT NOT NULL,
  "bookingId" TEXT,
  "topicId" TEXT,
  "uploaderId" TEXT NOT NULL,
  "kind" "LearningResourceKind" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "storageKey" TEXT,
  "externalUrl" TEXT,
  "mimeType" TEXT,
  "sizeBytes" BIGINT,
  "status" "LearningResourceStatus" NOT NULL DEFAULT 'PENDING',
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningTask" (
  "id" TEXT NOT NULL,
  "learningSpaceId" TEXT NOT NULL,
  "bookingId" TEXT,
  "topicId" TEXT,
  "creatorId" TEXT NOT NULL,
  "assigneeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "acceptanceCriteria" TEXT,
  "dueAt" TIMESTAMP(3),
  "status" "LearningTaskStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Submission" (
  "id" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "content" TEXT,
  "linkUrl" TEXT,
  "attachmentResourceId" TEXT,
  "revisionCount" INTEGER NOT NULL DEFAULT 1,
  "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubmissionReview" (
  "id" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "reviewerId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "outcome" "SubmissionReviewOutcome" NOT NULL,
  "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SubmissionReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningNote" (
  "id" TEXT NOT NULL,
  "learningSpaceId" TEXT NOT NULL,
  "bookingId" TEXT,
  "topicId" TEXT,
  "authorId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "visibility" "LearningNoteVisibility" NOT NULL DEFAULT 'SPACE_MEMBERS',
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LearningActivity" (
  "id" TEXT NOT NULL,
  "learningSpaceId" TEXT NOT NULL,
  "bookingId" TEXT,
  "actorId" TEXT,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "eventKey" TEXT NOT NULL,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LearningInvite_tokenHash_key" ON "LearningInvite"("tokenHash");
CREATE UNIQUE INDEX "LearningResource_storageKey_key" ON "LearningResource"("storageKey");
CREATE UNIQUE INDEX "Submission_taskId_key" ON "Submission"("taskId");
CREATE UNIQUE INDEX "SubmissionReview_submissionId_key" ON "SubmissionReview"("submissionId");
CREATE UNIQUE INDEX "LearningActivity_eventKey_key" ON "LearningActivity"("eventKey");

CREATE INDEX "Booking_learningSpaceId_createdAt_idx" ON "Booking"("learningSpaceId", "createdAt");
CREATE INDEX "Booking_topicId_idx" ON "Booking"("topicId");
CREATE INDEX "Booking_fulfillmentStatus_deliveredAt_idx" ON "Booking"("fulfillmentStatus", "deliveredAt");
CREATE INDEX "LearningSpace_primarySkillId_state_idx" ON "LearningSpace"("primarySkillId", "state");
CREATE INDEX "LearningSpace_state_updatedAt_idx" ON "LearningSpace"("state", "updatedAt");
CREATE INDEX "LearningSpaceMember_learningSpaceId_status_idx" ON "LearningSpaceMember"("learningSpaceId", "status");
CREATE INDEX "LearningSpaceMember_userId_status_idx" ON "LearningSpaceMember"("userId", "status");
CREATE INDEX "LearningTopic_learningSpaceId_state_normalizedLabel_idx" ON "LearningTopic"("learningSpaceId", "state", "normalizedLabel");
CREATE INDEX "LearningTopic_skillId_idx" ON "LearningTopic"("skillId");
CREATE INDEX "LearningTopic_creatorId_idx" ON "LearningTopic"("creatorId");
CREATE INDEX "LearningInvite_learningSpaceId_status_idx" ON "LearningInvite"("learningSpaceId", "status");
CREATE INDEX "LearningInvite_inviterId_status_idx" ON "LearningInvite"("inviterId", "status");
CREATE INDEX "LearningInvite_primarySkillId_idx" ON "LearningInvite"("primarySkillId");
CREATE INDEX "LearningInvite_status_expiresAt_idx" ON "LearningInvite"("status", "expiresAt");
CREATE INDEX "LearningResource_learningSpaceId_status_createdAt_idx" ON "LearningResource"("learningSpaceId", "status", "createdAt");
CREATE INDEX "LearningResource_bookingId_idx" ON "LearningResource"("bookingId");
CREATE INDEX "LearningResource_topicId_idx" ON "LearningResource"("topicId");
CREATE INDEX "LearningResource_uploaderId_idx" ON "LearningResource"("uploaderId");
CREATE INDEX "LearningTask_learningSpaceId_status_dueAt_idx" ON "LearningTask"("learningSpaceId", "status", "dueAt");
CREATE INDEX "LearningTask_bookingId_idx" ON "LearningTask"("bookingId");
CREATE INDEX "LearningTask_topicId_idx" ON "LearningTask"("topicId");
CREATE INDEX "LearningTask_assigneeId_status_dueAt_idx" ON "LearningTask"("assigneeId", "status", "dueAt");
CREATE INDEX "Submission_authorId_submittedAt_idx" ON "Submission"("authorId", "submittedAt");
CREATE INDEX "Submission_attachmentResourceId_idx" ON "Submission"("attachmentResourceId");
CREATE INDEX "Submission_status_submittedAt_idx" ON "Submission"("status", "submittedAt");
CREATE INDEX "SubmissionReview_reviewerId_reviewedAt_idx" ON "SubmissionReview"("reviewerId", "reviewedAt");
CREATE INDEX "SubmissionReview_outcome_reviewedAt_idx" ON "SubmissionReview"("outcome", "reviewedAt");
CREATE INDEX "LearningNote_learningSpaceId_createdAt_idx" ON "LearningNote"("learningSpaceId", "createdAt");
CREATE INDEX "LearningNote_bookingId_idx" ON "LearningNote"("bookingId");
CREATE INDEX "LearningNote_topicId_idx" ON "LearningNote"("topicId");
CREATE INDEX "LearningNote_authorId_updatedAt_idx" ON "LearningNote"("authorId", "updatedAt");
CREATE INDEX "LearningActivity_learningSpaceId_occurredAt_idx" ON "LearningActivity"("learningSpaceId", "occurredAt");
CREATE INDEX "LearningActivity_bookingId_occurredAt_idx" ON "LearningActivity"("bookingId", "occurredAt");
CREATE INDEX "LearningActivity_actorId_occurredAt_idx" ON "LearningActivity"("actorId", "occurredAt");
CREATE INDEX "LearningActivity_entityType_entityId_idx" ON "LearningActivity"("entityType", "entityId");

ALTER TABLE "Booking" ADD CONSTRAINT "Booking_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "LearningTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningSpace" ADD CONSTRAINT "LearningSpace_primarySkillId_fkey" FOREIGN KEY ("primarySkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSpace" ADD CONSTRAINT "LearningSpace_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSpace" ADD CONSTRAINT "LearningSpace_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningSpaceMember" ADD CONSTRAINT "LearningSpaceMember_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningSpaceMember" ADD CONSTRAINT "LearningSpaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningTopic" ADD CONSTRAINT "LearningTopic_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningTopic" ADD CONSTRAINT "LearningTopic_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningTopic" ADD CONSTRAINT "LearningTopic_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningInvite" ADD CONSTRAINT "LearningInvite_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningInvite" ADD CONSTRAINT "LearningInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningInvite" ADD CONSTRAINT "LearningInvite_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningInvite" ADD CONSTRAINT "LearningInvite_primarySkillId_fkey" FOREIGN KEY ("primarySkillId") REFERENCES "Skill"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "LearningTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningResource" ADD CONSTRAINT "LearningResource_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "LearningTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningTask" ADD CONSTRAINT "LearningTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "LearningTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_attachmentResourceId_fkey" FOREIGN KEY ("attachmentResourceId") REFERENCES "LearningResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubmissionReview" ADD CONSTRAINT "SubmissionReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "LearningTopic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningNote" ADD CONSTRAINT "LearningNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_learningSpaceId_fkey" FOREIGN KEY ("learningSpaceId") REFERENCES "LearningSpace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LearningActivity" ADD CONSTRAINT "LearningActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
