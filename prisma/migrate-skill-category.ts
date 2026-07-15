/**
 * One-time data migration: Skill.category  String -> SkillCategory (enum)
 *
 * Run this BEFORE changing `category` to `SkillCategory` in schema.prisma and
 * BEFORE `prisma db push` (this project has no `prisma/migrations` history —
 * see package.json `db:push` script — so the enum conversion has to be done
 * by hand first; `db push` cannot infer how to cast arbitrary free-text
 * values onto a brand new fixed-label enum type).
 *
 * Equivalent SQL (for reference / manual execution via Supabase's SQL editor):
 *   prisma/migrations-manual/001_skill_category_to_enum.sql
 *
 * Usage: npm run db:migrate-skill-category
 */
import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config()

const prisma = new PrismaClient()

// Legacy free-text value (lower-cased) -> new SkillCategory enum label.
// Anything not listed here falls back to OTHER (no row is ever lost/orphaned).
const CATEGORY_MAP: Record<string, string> = {
  development: 'DEVELOPMENT',
  it: 'DEVELOPMENT',
  'data science': 'DEVELOPMENT',
  'devops & cloud': 'DEVELOPMENT',
  programming: 'DEVELOPMENT',
  design: 'DESIGN',
  business: 'BUSINESS',
  marketing: 'BUSINESS',
  writing: 'BUSINESS',
  language: 'LANGUAGE',
  languages: 'LANGUAGE',
  health: 'HEALTH',
}

async function main() {
  console.log('Starting Skill.category -> SkillCategory enum migration...\n')

  const already = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'Skill' AND column_name = 'category' AND udt_name = 'SkillCategory'
    ) as "exists"
  `
  if (already[0]?.exists) {
    console.log('"Skill.category" is already the SkillCategory enum type. Nothing to do.')
    return
  }

  const before = await prisma.skill.groupBy({ by: ['category'], _count: { category: true } })
  console.log('Current distinct category values:')
  console.table(before.map((r) => ({ category: r.category, count: r._count.category })))

  console.log('\n1. Creating "SkillCategory" enum type (if missing)...')
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkillCategory') THEN
        CREATE TYPE "SkillCategory" AS ENUM ('DEVELOPMENT', 'DESIGN', 'BUSINESS', 'LANGUAGE', 'HEALTH', 'ACADEMIC', 'OTHER');
      END IF;
    END $$;
  `)

  console.log('2. Adding temporary "category_new" column...')
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "category_new" "SkillCategory" NOT NULL DEFAULT 'OTHER';
  `)

  console.log('3. Backfilling values from legacy "category" text column...')
  let mapped = 0
  let fellBackToOther = 0
  for (const row of before) {
    const target = CATEGORY_MAP[row.category.toLowerCase()] ?? 'OTHER'
    if (CATEGORY_MAP[row.category.toLowerCase()]) {
      mapped += row._count.category
    } else {
      fellBackToOther += row._count.category
    }
    await prisma.$executeRawUnsafe(
      `UPDATE "Skill" SET "category_new" = $1::"SkillCategory" WHERE "category" = $2`,
      target,
      row.category
    )
    console.log(`   "${row.category}" (${row._count.category}) -> ${target}`)
  }

  console.log('4. Dropping legacy "category" column and promoting "category_new"...')
  await prisma.$executeRawUnsafe(`ALTER TABLE "Skill" DROP COLUMN "category";`)
  await prisma.$executeRawUnsafe(`ALTER TABLE "Skill" RENAME COLUMN "category_new" TO "category";`)

  const after = await prisma.$queryRaw<{ category: string; count: bigint }[]>`
    SELECT "category"::text as category, COUNT(*) as count FROM "Skill" GROUP BY "category" ORDER BY "category"
  `
  console.log('\nMigration complete. New distribution:')
  console.table(after.map((r) => ({ category: r.category, count: Number(r.count) })))
  console.log(`\nMapped explicitly: ${mapped} rows. Fell back to OTHER: ${fellBackToOther} rows.`)
  console.log('\nNext steps: update prisma/schema.prisma (category: SkillCategory @default(OTHER)), then run `npm run db:push` and `npm run db:generate`.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Fatal error during migration:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
