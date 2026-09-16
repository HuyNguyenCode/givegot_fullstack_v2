import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = process.cwd()
const schema = readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8')
const migration = readFileSync(
  path.join(root, 'prisma', 'migrations-manual', '004_learning_hub_domain_schema.sql'),
  'utf8',
)
const rollback = readFileSync(
  path.join(root, 'prisma', 'migrations-manual', '004_learning_hub_domain_schema.rollback.sql'),
  'utf8',
)

function modelBlock(name: string): string {
  const match = schema.match(new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`))
  assert.ok(match, `missing Prisma model ${name}`)
  return match[1]
}

test('B1 schema contains the approved domain and separate Booking lifecycle', () => {
  for (const name of [
    'LearningSpace',
    'LearningSpaceMember',
    'LearningTopic',
    'LearningInvite',
    'LearningResource',
    'LearningTask',
    'Submission',
    'SubmissionReview',
    'LearningNote',
    'LearningActivity',
  ]) {
    assert.match(schema, new RegExp(`model ${name} \\{`))
  }

  assert.match(schema, /enum LearningMode \{\s+LIVE\s+EXERCISE_REVIEW\s+HYBRID\s+\}/)
  assert.match(
    schema,
    /enum FulfillmentStatus \{\s+NOT_STARTED\s+IN_PROGRESS\s+DELIVERED\s+REVISION_REQUESTED\s+ACCEPTED\s+SETTLED\s+\}/,
  )

  const booking = modelBlock('Booking')
  for (const field of [
    'learningSpaceId',
    'topicId',
    'learningMode',
    'objective',
    'definitionOfDone',
    'fulfillmentStatus',
    'deliveredAt',
    'acceptedAt',
  ]) {
    assert.match(booking, new RegExp(`\\b${field}\\s+\\w+\\?`), `${field} must remain nullable`)
  }
})

test('B1 schema permits multiple spaces for the same pair and carries no permanent exchange role', () => {
  const member = modelBlock('LearningSpaceMember')
  const space = modelBlock('LearningSpace')

  assert.match(member, /@@id\(\[learningSpaceId, userId\]\)/)
  assert.doesNotMatch(member, /\b(role|mentor|learner)\b/i)
  assert.doesNotMatch(space, /@@unique/)
  assert.doesNotMatch(schema, /@@unique\(\[[^\]]*primarySkillId[^\]]*\]\)/)
  assert.match(space, /primarySkillId\s+String\s*$/m)
})

test('B1 relations declare deletion behavior and preserve archived/history-capable records', () => {
  const learningDomain = schema.slice(schema.indexOf('model LearningSpace {'))
  const owningRelations = learningDomain.match(/^\s+\w+\s+[^\n]*@relation\(fields:[^\n]+$/gm) ?? []
  assert.ok(owningRelations.length > 20)
  for (const relation of owningRelations) {
    assert.match(relation, /onDelete: (Restrict|SetNull)/, `missing history-safe onDelete: ${relation.trim()}`)
  }

  assert.match(modelBlock('LearningSpace'), /state\s+LearningSpaceStatus\s+@default\(ACTIVE\)/)
  assert.match(modelBlock('LearningTopic'), /state\s+LearningTopicStatus\s+@default\(ACTIVE\)/)
  assert.match(modelBlock('LearningResource'), /deletedAt\s+DateTime\?/)
  assert.match(modelBlock('LearningActivity'), /eventKey\s+String\s+@unique/)
})

test('B1 migration is additive for Booking and leaves BookingStatus and legacy rows uninterpreted', () => {
  assert.match(migration, /ALTER TABLE "Booking"/)
  assert.doesNotMatch(migration, /ALTER TYPE "BookingStatus"/)
  assert.doesNotMatch(migration, /UPDATE\s+"Booking"/i)
  assert.doesNotMatch(migration, /ADD COLUMN "(?:learningSpaceId|topicId|learningMode|objective|definitionOfDone|fulfillmentStatus|deliveredAt|acceptedAt)"[^,;]*NOT NULL/)
  assert.doesNotMatch(migration, /UNIQUE[^;]*(?:primarySkillId|learningSpaceId)[^;]*(?:userId|primarySkillId)/i)
  assert.match(rollback, /DROP COLUMN "learningSpaceId"/)
  assert.doesNotMatch(rollback, /ALTER TYPE "BookingStatus"/)
})
