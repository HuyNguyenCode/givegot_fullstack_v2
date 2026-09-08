// Offline regression tests for Option 1 quiz publication gating.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(file, mocks) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module,
    exports: module.exports,
    require: id => {
      if (!(id in mocks)) throw Error('Unexpected dependency: ' + id)
      return mocks[id]
    },
    console: { log() {}, error() {}, warn() {} },
  }, { filename: file })
  return module.exports
}

async function main() {
  const enums = require('@prisma/client')
  let sessionUserId = 'owner'
  let eligible = true
  let updateCount = 1
  let generated = 0
  let findFirstCalls = []
  let updateManyCalls = []
  let revalidated = []

  const db = {
    userSkill: {
      findFirst: async args => {
        findFirstCalls.push(args)
        if (!eligible) return null
        return args.select ? { id: 'us-1' } : { id: 'us-1', userId: 'owner', skill: { name: 'NodeJS' } }
      },
      updateMany: async args => {
        updateManyCalls.push(args)
        return { count: updateCount }
      },
    },
  }

  const actions = load('src/actions/quiz.ts', {
    '@/lib/prisma': { prisma: db },
    '@/lib/gemini': {
      generateSkillQuiz: async () => {
        generated++
        return [{ question: 'Q', options: ['A'], correctAnswer: 0 }]
      },
    },
    'next/cache': { revalidatePath: path => revalidated.push(path) },
    '@prisma/client': enums,
    '@/lib/auth': { auth: async () => sessionUserId ? { user: { id: sessionUserId } } : null },
    '@/lib/skill-publication': { PUBLISHED_SKILL_WHERE: { status: 'APPROVED', embeddingStatus: 'READY' } },
  })

  sessionUserId = null
  assert.equal((await actions.getQuizForSkill('NodeJS')).success, false)
  assert.equal(generated, 0)

  sessionUserId = 'owner'
  eligible = false
  assert.equal((await actions.getQuizForSkill('NodeJS')).success, false)
  assert.equal(generated, 0)

  eligible = true
  assert.equal((await actions.getQuizForSkill('NodeJS')).success, true)
  assert.equal(generated, 1)
  const quizWhere = findFirstCalls.at(-1).where
  assert.equal(quizWhere.userId, 'owner')
  assert.equal(quizWhere.type, enums.SkillType.GIVE)
  assert.equal(quizWhere.skill.status, 'APPROVED')
  assert.equal(quizWhere.skill.embeddingStatus, 'READY')

  sessionUserId = null
  assert.equal((await actions.verifyUserSkill('us-1')).success, false)
  assert.equal(updateManyCalls.length, 0)

  sessionUserId = 'owner'
  updateCount = 0
  assert.equal((await actions.verifyUserSkill('us-other-or-unpublished')).success, false)
  assert.equal(revalidated.length, 0)

  updateCount = 1
  assert.equal((await actions.verifyUserSkill('us-1')).success, true)
  const verifyWhere = updateManyCalls.at(-1).where
  assert.equal(verifyWhere.id, 'us-1')
  assert.equal(verifyWhere.userId, 'owner')
  assert.equal(verifyWhere.type, enums.SkillType.GIVE)
  assert.equal(verifyWhere.skill.status, 'APPROVED')
  assert.equal(verifyWhere.skill.embeddingStatus, 'READY')
  assert.deepEqual(revalidated, ['/profile', '/'])

  sessionUserId = 'attacker'
  assert.equal(await actions.getUserSkillDetails('owner', 'NodeJS', 'GIVE'), null)
  const callsBeforeOwnerLookup = findFirstCalls.length
  sessionUserId = 'owner'
  assert.equal((await actions.getUserSkillDetails('owner', 'NodeJS', 'GIVE')).id, 'us-1')
  assert.equal(findFirstCalls.length, callsBeforeOwnerLookup + 1)

  console.log('PASS: quiz generation and verification require owner + GIVE + APPROVED + READY; private lookup is owner-only.')
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
