/**
 * Migration Script: Approve All Existing Skills
 * 
 * This script ensures that all existing skills in the database are set to APPROVED status.
 * Run this ONCE after updating the schema to prevent breaking existing functionality.
 * 
 * Usage: npx tsx prisma/approve-existing-skills.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting migration: Approve all existing skills...\n')

  // Update all skills that don't have a status or have PENDING status to APPROVED
  const result = await prisma.skill.updateMany({
    where: {
      OR: [
        { status: 'PENDING' },
        // In case some were already set
      ]
    },
    data: {
      status: 'APPROVED'
    }
  })

  console.log(`Updated ${result.count} skills to APPROVED status`)
  
  // Show summary
  const statusCounts = await prisma.skill.groupBy({
    by: ['status'],
    _count: true
  })

  console.log('\nCurrent skill status breakdown:')
  statusCounts.forEach(stat => {
    console.log(`   - ${stat.status}: ${stat._count} skills`)
  })

  console.log('\nMigration complete! All existing skills are now approved.')
  console.log('   New skills added by users will require admin approval.\n')
}

main()
  .catch((error) => {
    console.error('Migration failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
