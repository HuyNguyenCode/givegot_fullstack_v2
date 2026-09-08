// Offline BR-11 regression tests: real TS modules, mocked DB/AI/auth/email.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
function load(file, mocks, extra = '') {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8') + extra, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  vm.runInNewContext(output, {
    module, exports: module.exports,
    require: id => { if (!(id in mocks)) throw Error('Unexpected dependency: ' + id); return mocks[id] },
    console: { log() {}, error() {}, warn() {} },
  }, { filename: file })
  return module.exports
}
const plain = value => JSON.parse(JSON.stringify(value))
async function main() {
  const enums = require('@prisma/client')
  const publication = load('src/lib/skill-publication.ts', {})
  let skill, calls, ai, admin = true, notifications = 0, stale = false, preserveAiOnCreate = false
  function reset(status = 'PENDING', state = 'NOT_STARTED') {
    skill = { id: 's', name: 'Skill', slug: 'skill', status, category: 'OTHER',
      embeddingStatus: state, embeddingVersion: 0, embeddingAttempts: 0,
      embeddingToken: null, embeddingStartedAt: null, embeddingError: null }
    calls = []; stale = false
    ai = async () => Array(768).fill(0.2)
  }
  reset()
  const match = where => Object.entries(where).every(([k, v]) => skill?.[k] === v)
  const update = data => {
    for (const [k,v] of Object.entries(data)) {
      skill[k] = v && typeof v === 'object' && 'increment' in v ? skill[k] + v.increment : v
    }
  }
  const db = {
    skill: {
      findUnique: async () => skill ? { ...skill } : null,
      findFirst: async ({ where }) => where.id && match(where) ? { ...skill } : null,
      findMany: async ({ where }) => {
        assert.equal(where.status, 'APPROVED'); assert.equal(where.embeddingStatus, 'READY')
        return [{ id: 'a', name: 'Approved A' }]
      },
      updateMany: async ({ where, data }) => {
        if (!match(where)) return { count: 0 }
        update(data); calls.push('moderate'); return { count: 1 }
      },
      create: async ({ data }) => {
        const configuredAi = ai
        reset()
        if (preserveAiOnCreate) ai = configuredAi
        update(data)
        return { ...skill }
      },
    },
    userSkill: { findMany: async () => [{ userId: 'learner' }], count: async () => 1 },
    user: { findMany: async () => [] },
    $executeRaw: async (strings, ...v) => {
      const sql = strings.join('?')
      if (sql.includes('"embeddingAttempts" + 1')) {
        const [token,id,version,name] = v
        assert.match(sql, /"embeddingAttempts" < 3/)
        assert.match(sql, /INTERVAL '5 minutes'/)
        if (skill.id !== id || skill.status !== 'APPROVED' || skill.embeddingVersion !== version
          || skill.name !== name || skill.embeddingAttempts >= 3
          || !(['NOT_STARTED','FAILED'].includes(skill.embeddingStatus) || (skill.embeddingStatus === 'PROCESSING' && stale))) return 0
        skill.embeddingStatus = 'PROCESSING'; skill.embeddingToken = token; skill.embeddingAttempts++
        calls.push('claim'); return 1
      }
      if (sql.includes("SET embedding =") && sql.includes("::vector")) {
        const [encoded,id,name,version,token] = v
        assert.match(sql, /"embeddingStatus" = 'PROCESSING'/)
        if (skill.id !== id || skill.status !== 'APPROVED' || skill.name !== name
          || skill.embeddingVersion !== version || skill.embeddingToken !== token
          || skill.embeddingStatus !== 'PROCESSING') return 0
        assert.equal(JSON.parse(encoded).length, 768)
        skill.embeddingStatus = 'READY'; skill.embeddingToken = null
        calls.push('publish'); return 1
      }
      assert.match(sql, /SET embedding = NULL/)
      calls.push('invalidate'); return 1
    },
    $transaction: async fn => fn(db),
  }
  const helper = load('src/lib/skill-embedding.ts', {
    'node:crypto': require('node:crypto'), './prisma': { prisma: db },
    './skill-publication': publication,
    './gemini': { generateSkillEmbedding: async names => {
      assert.equal(skill.status, 'APPROVED'); calls.push('AI'); return ai(names)
    } },
  })
  const actions = load('src/actions/admin.ts', {
    '@/lib/prisma': { prisma: db }, '@prisma/client': enums, 'next/cache': { revalidatePath() {} },
    './notifications': { createNotification: async () => { notifications++; assert.equal(skill.embeddingStatus, 'READY') } },
    '@/lib/google-meet': {}, '@/lib/admin': { isAdmin: async () => admin },
    '@/lib/skill-embedding': helper, '@/lib/email': { getAppUrl: () => 'http://test' },
    '@/emails/NewMatchEmail': {}, '@/emails/ReportResolutionEmail': {},
  })

  for (const status of ['PENDING','REJECTED']) {
    reset(status)
    assert.equal((await helper.refreshApprovedSkillEmbedding('s')).ready, false)
    assert.equal(calls.length, 0)
  }
  reset('APPROVED','READY')
  assert.deepEqual(plain(await helper.refreshApprovedSkillEmbedding('s')), { ready:true, published:false, name:'Skill' })
  assert.equal(calls.length,0)
  reset()
  assert.equal((await actions.approveSkill('s')).success,true)
  assert.deepEqual(calls,['moderate','invalidate','claim','AI','publish'])
  assert.equal(notifications,1)
  assert.equal((await actions.approveSkill('s')).success,false)
  assert.equal(notifications,1)
  assert.equal((await actions.updateSkill('s',{category:'DESIGN'})).success,true)
  assert.equal(notifications,1) // category edit does not regenerate/re-notify

  // Embedding failure happens after the approval transaction. The response
  // must preserve that durable truth and expose publication as incomplete.
  reset(); ai=async()=>{throw Error('network')}
  const partialApproval=await actions.approveSkill('s')
  assert.equal(partialApproval.success,true)
  assert.equal(partialApproval.persisted,true)
  assert.equal(partialApproval.publicationOutcome,'SAVED_NOT_PUBLISHED')
  assert.equal(skill.status,'APPROVED')
  assert.equal(skill.embeddingStatus,'FAILED')

  // The same contract applies when an approved master skill was durably
  // created before its post-commit embedding attempt failed.
  preserveAiOnCreate=true; ai=async()=>{throw Error('network')}
  const partialCreate=await actions.createSkill({name:'Admin Skill',category:'OTHER',status:'APPROVED'})
  preserveAiOnCreate=false
  assert.equal(partialCreate.success,true)
  assert.equal(partialCreate.persisted,true)
  assert.equal(partialCreate.publicationOutcome,'SAVED_NOT_PUBLISHED')
  assert.equal(skill.status,'APPROVED')
  assert.equal(skill.embeddingStatus,'FAILED')

  for(const bad of [[],[1],Array(768).fill(NaN),Array(768).fill(0)]) {
    reset('APPROVED'); ai=async()=>bad
    assert.equal((await helper.refreshApprovedSkillEmbedding('s')).ready,false)
    assert.equal(skill.embeddingStatus,'FAILED')
    assert.ok(!calls.includes('publish'))
  }
  reset('APPROVED'); ai=async()=>{throw Error('network')}
  for(let i=0;i<4;i++) await helper.refreshApprovedSkillEmbedding('s')
  assert.equal(skill.embeddingAttempts,3)
  assert.equal(calls.filter(c=>c==='AI').length,3)
  assert.equal(skill.embeddingStatus,'FAILED')
  reset('APPROVED'); ai=async()=>[]
  const before=notifications
  await actions.retrySkillEmbedding('s')
  assert.equal(notifications,before)
  ai=async()=>Array(768).fill(0.4)
  await actions.retrySkillEmbedding('s')
  assert.equal(skill.embeddingStatus,'READY')
  assert.equal(notifications,before+1)
  for(const status of ['PENDING','REJECTED','APPROVED']) {
    calls=[]
    await actions.createSkill({name:'Admin Skill',category:'OTHER',status})
    assert.equal(calls.includes('AI'),status==='APPROVED')
  }
  reset('APPROVED','READY')
  await actions.updateSkill('s',{name:'Normalized'})
  assert.equal(skill.embeddingVersion,1)
  assert.ok(calls.indexOf('invalidate')<calls.indexOf('AI'))
  assert.equal(skill.embeddingStatus,'READY')
  await actions.rejectSkill('s')
  assert.equal(skill.status,'REJECTED')
  assert.equal(skill.embeddingStatus,'NOT_STARTED')
  assert.equal(skill.embeddingVersion,2)
  const staleForm = await actions.updateSkill('s', { name: 'Stale edit' }, 0)
  assert.equal(staleForm.success, false)
  assert.equal(skill.name, 'Normalized')

  // Simultaneous retries: only one claim calls AI.
  reset('APPROVED')
  let release, started
  const start = new Promise(resolve=>{started=resolve})
  ai=()=>{started();return new Promise(resolve=>{release=resolve})}
  const worker=helper.refreshApprovedSkillEmbedding('s')
  await start
  assert.equal((await helper.refreshApprovedSkillEmbedding('s')).ready,false)
  assert.equal(calls.filter(c=>c==='AI').length,1)
  // Reject while AI is in flight: obsolete result must never publish.
  await actions.rejectSkill('s')
  release(Array(768).fill(0.5))
  assert.equal((await worker).ready,false)
  assert.equal(skill.status,'REJECTED')
  assert.ok(!calls.includes('publish'))

  // Expired worker lease: a newer token wins, older response cannot overwrite it.
  reset('APPROVED')
  let oldRelease, oldStarted
  const oldStart=new Promise(resolve=>{oldStarted=resolve})
  ai=()=>{oldStarted();return new Promise(resolve=>{oldRelease=resolve})}
  const oldWorker=helper.refreshApprovedSkillEmbedding('s')
  await oldStart
  stale=true; ai=async()=>Array(768).fill(0.6)
  assert.equal((await helper.refreshApprovedSkillEmbedding('s')).published,true)
  oldRelease(Array(768).fill(0.7))
  assert.equal((await oldWorker).published,false)
  assert.equal(calls.filter(c=>c==='publish').length,1)

  admin=false;reset()
  assert.equal((await actions.approveSkill('s')).success,false)
  assert.equal((await actions.updateSkill('s',{})).success,false)
  assert.equal((await actions.retrySkillEmbedding('s')).success,false)
  assert.equal((await actions.rejectSkill('s')).success,false)
  assert.equal((await actions.createSkill({name:'X',category:'OTHER'})).success,false)
  assert.equal(calls.length,0)
  admin=true
  assert.deepEqual(Array.from(await helper.getPublishedSkillNames(['pending','a'])),['Approved A'])
  assert.deepEqual(Array.from(await helper.getApprovedSkillNames(['pending','a'])),['Approved A'])
  console.log('PASS: moderation/readiness, vector validation, bounded retries, notifications, category preservation, rename/rejection, concurrent claims, stale workers and admin authorization.')

  let links=[],generated=[],writes=[]
  const skills=[
    {id:'a',name:'Approved A',status:'APPROVED',embeddingStatus:'READY'},
    {id:'p',name:'Pending P',status:'PENDING',embeddingStatus:'NOT_STARTED'},
    {id:'f',name:'Approved Failed',status:'APPROVED',embeddingStatus:'FAILED'},
    {id:'q',name:'Approved Processing',status:'APPROVED',embeddingStatus:'PROCESSING'},
    {id:'r',name:'Rejected R',status:'REJECTED',embeddingStatus:'NOT_STARTED'},
  ]
  const profileDb={
    skill:{
      findFirst:async({where})=>skills.find(s=>s.name.toLowerCase()===where.name.equals.toLowerCase())||null,
      findUnique:async()=>null,
      create:async({data})=>{const s={id:'new',embeddingStatus:'NOT_STARTED',...data};skills.push(s);return s},
      findMany:async({where})=>skills.filter(s=>where.id.in.includes(s.id)&&s.status===where.status&&s.embeddingStatus===where.embeddingStatus),
    },
    userSkill:{
      findMany:async()=>links.map(l=>({...l})),
      deleteMany:async({where})=>{links=links.filter(l=>l.type!==where.type||where.skillId.notIn.includes(l.skillId))},
      createMany:async({data})=>{links.push(...data)},
    },
    user:{update:async()=>{},findUnique:async()=>null},
    $executeRaw:async(sql,...v)=>{writes.push(v);return 1},
  }
  const profileAI={generateSkillEmbedding:async names=>{generated.push(Array.from(names));return Array(768).fill(0.1)}}
  const ph=load('src/lib/skill-embedding.ts',{
    'node:crypto':require('node:crypto'),'./prisma':{prisma:profileDb},'./gemini':profileAI,'./skill-publication':publication,
  })
  let viewer='u'
  const user=load('src/actions/user.ts',{
    '@/lib/prisma':{prisma:profileDb},'@prisma/client':enums,'next/cache':{revalidatePath(){}},
    '@/lib/gemini':profileAI,'@/lib/skill-embedding':ph,'@/lib/skill-publication':publication,
    '@/lib/auth':{auth:async()=>({user:{id:viewer}})},'@/lib/admin':{isAdmin:async()=>false},
    '@/lib/email':{},'@/emails/NewMatchEmail':{},
  },'\nexport { ensureSkillExists as testEnsureSkillExists }')
  const allowed=new Set()
  assert.equal(await user.testEnsureSkillExists('New Skill',allowed),'new')
  assert.equal(await user.testEnsureSkillExists('New Skill',allowed),'new')
  assert.equal(generated.length,0)
  const retained={id:'stable',userId:'u',skillId:'a',type:'GIVE',isVerified:true}
  const roadmap={id:'roadmap',userId:'u',skillId:'p',type:'WANT',roadmap:{saved:true}}
  links=[retained,roadmap,{id:'pending',userId:'u',skillId:'p',type:'GIVE'}]
  assert.equal((await user.updateUserProfile('u',{teachingSkills:['Pending P','Approved A'],learningGoals:['Pending P']})).success,true)
  assert.deepEqual(generated,[['Approved A']])
  assert.ok(links.includes(retained))
  assert.ok(links.includes(roadmap))
  assert.equal(retained.isVerified,true)
  assert.deepEqual(roadmap.roadmap,{saved:true})
  assert.equal(writes[1][0],null)
  profileAI.generateSkillEmbedding = async () => []
  writes = []
  assert.equal((await user.updateUserProfile('u', { teachingSkills: ['Approved A', 'Pending P'] })).success, true)
  assert.equal(writes[0][0], null)
  assert.ok(links.includes(retained))
  const saved=JSON.stringify(links)
  assert.equal((await user.updateUserProfile('u',{teachingSkills:['Rejected R']})).success,false)
  assert.equal(JSON.stringify(links),saved)
  const failedSkillResult=await user.updateUserProfile('u',{teachingSkills:['Approved Failed']})
  assert.equal(failedSkillResult.success,false)
  assert.match(failedSkillResult.message,/đã được Admin duyệt/)
  assert.match(failedSkillResult.message,/Admin cần kiểm tra/)
  const processingSkillResult=await user.updateUserProfile('u',{teachingSkills:['Approved Processing']})
  assert.equal(processingSkillResult.success,false)
  assert.match(processingSkillResult.message,/đã được Admin duyệt/)
  assert.match(processingSkillResult.message,/đang chuẩn bị/)
  assert.equal(JSON.stringify(links),saved)
  generated=[];writes=[]
  assert.equal((await user.updateUserProfile('u',{teachingSkills:[],learningGoals:[]})).success,true)
  assert.equal(links.length,0);assert.equal(generated.length,0);assert.equal(writes.length,2)
  let seenWhere
  profileDb.userSkill.findMany=async({where})=>{seenWhere=where;return []}
  viewer='outsider';await user.getUserTeachingSkills('u')
  assert.deepEqual(plain(seenWhere.skill),{status:'APPROVED',embeddingStatus:'READY'})
  viewer='u';await user.getUserTeachingSkills('u')
  assert.equal(seenWhere.skill,undefined)
  console.log('PASS: new/reused pending skills, private/public filters, mixed GIVE/WANT, retained quiz/roadmap IDs, validation-before-delete, empty-profile clearing.')

  // Source checks supplement (not replace) runtime tests for query coverage.
  const mentor=fs.readFileSync('src/actions/mentor.ts','utf8')
  assert.ok(mentor.startsWith("'use server'"))
  assert.ok(!mentor.includes("where: { type: SkillType.GIVE }"))
  assert.ok(!mentor.includes("status: 'APPROVED'"))
  const publicUser=fs.readFileSync('src/actions/user.ts','utf8')
  assert.ok(publicUser.includes('where: PUBLISHED_SKILL_WHERE'))
  for(const alias of ['s_give','s']) assert.ok(mentor.includes(alias+'."embeddingStatus" = \'READY\''))
  const backfill=fs.readFileSync('prisma/backfill-skill-embeddings.ts','utf8')
  assert.ok(backfill.includes('refreshApprovedSkillEmbedding'))
  assert.ok(!backfill.includes('generateSkillEmbedding'))
  const migration=fs.readFileSync('prisma/migrations-manual/002_skill_embedding_readiness.sql','utf8')
  assert.ok(migration.includes('_BR11SkillEmbeddingBackup'))
  assert.ok(migration.includes('Skill_ready_requires_approved_vector'))
  assert.ok(!/DROP\s|DELETE\s/i.test(migration))
  console.log('PASS: search/backfill visibility guards and additive migration source checks (SQL not executed).')
}
main().catch(error=>{console.error(error);process.exitCode=1})
