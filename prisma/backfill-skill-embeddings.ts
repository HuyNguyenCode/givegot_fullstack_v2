import { PrismaClient } from '@prisma/client'
import { generateSkillEmbedding } from '../src/lib/gemini'

const prisma = new PrismaClient()

async function backfillSkillEmbeddings() {
  console.log('🚀 Starting skill embedding backfill...')

  try {
    // Get all skills from database
    const skills = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
    })

    console.log(`📚 Found ${skills.length} skills in database`)

    let updated = 0
    let skipped = 0
    let errors = 0

    for (const skill of skills) {
      try {
        // Check if skill already has an embedding
        const hasEmbedding = await prisma.$queryRaw<Array<{ hasEmbedding: boolean }>>`
          SELECT CASE WHEN embedding IS NOT NULL THEN true ELSE false END as "hasEmbedding"
          FROM "Skill"
          WHERE id = ${skill.id}
        `

        if (hasEmbedding[0]?.hasEmbedding) {
          console.log(`⏭️  Skipping "${skill.name}" (already has embedding)`)
          skipped++
          continue
        }

        // Generate embedding for this skill
        console.log(`🤖 Generating embedding for: "${skill.name}"`)
        const embedding = await generateSkillEmbedding([skill.name])
        const vectorString = `[${embedding.join(',')}]`

        // Save embedding to database
        await prisma.$executeRaw`
          UPDATE "Skill"
          SET embedding = ${vectorString}::vector
          WHERE id = ${skill.id}
        `

        console.log(`✅ Updated "${skill.name}" with embedding`)
        updated++

        // Add delay to avoid rate limiting (adjust based on your Gemini API quota)
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (skillError) {
        console.error(`❌ Error processing skill "${skill.name}":`, skillError)
        errors++
      }
    }

    console.log('\n📊 Backfill Summary:')
    console.log(`   ✅ Updated: ${updated} skills`)
    console.log(`   ⏭️  Skipped: ${skipped} skills (already had embeddings)`)
    console.log(`   ❌ Errors: ${errors} skills`)
    console.log('\n🎉 Skill embedding backfill complete!')
  } catch (error) {
    console.error('❌ Fatal error during backfill:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the backfill
backfillSkillEmbeddings()
  .then(() => {
    console.log('✅ Script completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
