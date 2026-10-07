import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const schema = readFileSync(path.join(root, 'prisma/schema.prisma'), 'utf8')
const forward = readFileSync(path.join(root, 'prisma/migrations-manual/006_learning_resource_purpose.sql'), 'utf8')
const rollback = readFileSync(path.join(root, 'prisma/migrations-manual/006_learning_resource_purpose.rollback.sql'), 'utf8')

test('D0a schema and manual SQL define the same non-null purpose with a legacy default', () => {
  assert.match(schema, /enum LearningResourcePurpose \{\s+MATERIAL\s+SUBMISSION_ATTACHMENT\s+LEGACY_UNCLASSIFIED\s+\}/)
  assert.match(schema, /model LearningResource \{[\s\S]*?purpose\s+LearningResourcePurpose\s+@default\(LEGACY_UNCLASSIFIED\)/)
  assert.match(forward, /CREATE TYPE "LearningResourcePurpose" AS ENUM \('MATERIAL', 'SUBMISSION_ATTACHMENT', 'LEGACY_UNCLASSIFIED'\)/)
  assert.match(forward, /ALTER TABLE "LearningResource"\s+ADD COLUMN "purpose" "LearningResourcePurpose" NOT NULL DEFAULT 'LEGACY_UNCLASSIFIED'/)
  assert.match(forward, /BEGIN;[\s\S]*COMMIT;/)
  assert.doesNotMatch(forward, /\b(?:UPDATE|DELETE|DROP|CREATE INDEX)\b/i)
  assert.doesNotMatch(forward, /ALTER TABLE "(?:Booking|LearningTask|Submission)"/)
})

test('D0a rollback guards classified rows and is atomic', () => {
  assert.match(rollback, /BEGIN;[\s\S]*LOCK TABLE "LearningResource" IN ACCESS EXCLUSIVE MODE;[\s\S]*COMMIT;/)
  assert.match(rollback, /IF EXISTS \([\s\S]*"purpose" IN \('MATERIAL', 'SUBMISSION_ATTACHMENT'\)[\s\S]*\) THEN[\s\S]*RAISE EXCEPTION/)
  assert.ok(rollback.indexOf('RAISE EXCEPTION') < rollback.indexOf('DROP COLUMN'))
  assert.match(rollback, /ALTER TABLE "LearningResource" DROP COLUMN "purpose";\s*DROP TYPE "LearningResourcePurpose";/)
  assert.doesNotMatch(rollback, /\b(?:UPDATE|DELETE|DROP TABLE)\b/i)
})

test('D0a leaves existing resource relationships and status fields in place', () => {
  const resource = schema.match(/model LearningResource \{([\s\S]*?)\n\}/)?.[1]
  const submission = schema.match(/model Submission \{([\s\S]*?)\n\}/)?.[1]
  assert.ok(resource && submission)
  for (const field of ['learningSpaceId', 'bookingId', 'topicId', 'uploaderId', 'storageKey', 'status', 'deletedAt']) {
    assert.match(resource, new RegExp(`\\b${field}\\b`))
  }
  assert.match(resource, /@@index\(\[learningSpaceId, status, createdAt\]\)/)
  assert.match(submission, /attachmentResourceId\s+String\?/)
  assert.match(submission, /attachment LearningResource\? @relation\("SubmissionAttachment", fields: \[attachmentResourceId\], references: \[id\], onDelete: SetNull\)/)
})
