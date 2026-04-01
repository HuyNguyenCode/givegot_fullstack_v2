require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { execSync } = require('child_process')

console.log('GiveGot Database Setup Script\n')

async function setupDatabase() {
  console.log('Step 1: Testing connection...')
  const prisma = new PrismaClient()
  
  try {
    await prisma.$connect()
    console.log('Connected to Supabase!\n')
    await prisma.$disconnect()
  } catch (error) {
    console.log('Connection failed:', error.message)
    console.log('\nPlease update your .env file with correct Supabase credentials.')
    console.log('See: GET-SUPABASE-CREDENTIALS.md\n')
    process.exit(1)
  }

  console.log('Step 2: Pushing schema to database...')
  try {
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' })
    console.log('Schema pushed!\n')
  } catch (error) {
    console.log('Schema push failed\n')
    process.exit(1)
  }

  console.log('Step 3: Generating Prisma Client...')
  try {
    execSync('npx prisma generate', { stdio: 'inherit' })
    console.log('Client generated!\n')
  } catch (error) {
    console.log('Client generation failed\n')
    process.exit(1)
  }

  console.log('Step 4: Seeding database...')
  try {
    execSync('npm run db:seed', { stdio: 'inherit' })
    console.log('Database seeded!\n')
  } catch (error) {
    console.log('Seeding failed\n')
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log('DATABASE SETUP COMPLETE!')
  console.log('='.repeat(60))
  console.log('\nNext steps:')
  console.log('1. Update .env: Set USE_MOCK_DATA="false"')
  console.log('2. Restart dev server: npm run dev')
  console.log('3. Open: http://localhost:3000\n')
}

setupDatabase()
