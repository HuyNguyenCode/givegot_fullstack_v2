import { PrismaClient, SkillType } from '@prisma/client'
import { GoogleGenerativeAI } from '@google/generative-ai'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    return new Array(768).fill(0)
  }

  try {
    console.log(`   🤖 Generating embedding for: "${text.substring(0, 60)}..."`)
    
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const result = await model.embedContent(text)
    
    const embedding = result.embedding.values.slice(0, 768)

    return embedding
  } catch (error) {
    console.error('   ❌ Error generating embedding:', error)
    throw error
  }
}

async function main() {
  console.log('🌟 Starting Embedding Backfill Process...\n')

  // Get all users
  const users = await prisma.user.findMany({
    include: {
      skills: {
        include: {
          skill: true,
        },
      },
    },
  })

  console.log(`📊 Found ${users.length} users to process\n`)

  let processed = 0
  let skipped = 0
  let errors = 0

  for (const user of users) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`Processing: ${user.name || user.email} (${user.id})`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      // Get teaching skills (GIVE)
      const teachingSkills = user.skills
        .filter(us => us.type === SkillType.GIVE)
        .map(us => us.skill.name)

      // Get learning goals (WANT)
      const learningGoals = user.skills
        .filter(us => us.type === SkillType.WANT)
        .map(us => us.skill.name)

      console.log(`🎓 Teaching Skills: [${teachingSkills.join(', ') || 'None'}]`)
      console.log(`📚 Learning Goals: [${learningGoals.join(', ') || 'None'}]`)

      let teachingUpdated = false
      let learningUpdated = false

      // Generate and save teaching embedding
      if (teachingSkills.length > 0) {
        const teachingText = teachingSkills.join(', ')
        const teachingEmbedding = await generateEmbedding(teachingText)
        const vectorString = `[${teachingEmbedding.join(',')}]`
        
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "teachingEmbedding" = ${vectorString}::vector 
          WHERE id = ${user.id}
        `
        
        console.log(`   ✅ Teaching embedding saved (768 dimensions)`)
        teachingUpdated = true
      } else {
        console.log(`   ⏭️  No teaching skills - skipping teaching embedding`)
      }

      // Generate and save learning embedding
      if (learningGoals.length > 0) {
        const learningText = learningGoals.join(', ')
        const learningEmbedding = await generateEmbedding(learningText)
        const vectorString = `[${learningEmbedding.join(',')}]`
        
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "learningEmbedding" = ${vectorString}::vector 
          WHERE id = ${user.id}
        `
        
        console.log(`   ✅ Learning embedding saved (768 dimensions)`)
        learningUpdated = true
      } else {
        console.log(`   ⏭️  No learning goals - skipping learning embedding`)
      }

      if (teachingUpdated || learningUpdated) {
        processed++
      } else {
        skipped++
      }

      // Rate limiting: Wait 1 second between API calls to avoid quota issues
      await new Promise(resolve => setTimeout(resolve, 1000))

    } catch (error) {
      console.error(`   ❌ Failed to process ${user.name}:`, error)
      errors++
    }
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 Embedding Backfill Complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`\n📊 Summary:`)
  console.log(`   ✅ Processed: ${processed} users`)
  console.log(`   ⏭️ Skipped: ${skipped} users (no skills)`)
  console.log(`   ❌ Errors: ${errors} users`)
  console.log(`\n🚀 Your database now has AI-powered embeddings!`)
  console.log(`\n💡 Next: Restart your dev server and test the auto-match feature.`)
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('❌ Fatal error during backfill:', e)
    await prisma.$disconnect()
    process.exit(1)
  })