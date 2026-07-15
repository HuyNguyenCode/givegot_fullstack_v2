-- Migration: Skill.category  String -> SkillCategory (enum)
--
-- This project uses `prisma db push` (no `prisma/migrations` history), so a plain
-- schema-only change would fail: Postgres cannot silently cast the existing
-- free-text values ("Development", "Data Science", "DevOps & Cloud", "IT",
-- "Languages", "Music", "Lifestyle", ...) onto a brand new enum type with a
-- fixed set of labels. This script performs the conversion by hand, WITHOUT
-- losing any rows or any other column, then leaves the table in the exact
-- shape `prisma db push` expects afterwards (so the following push is a no-op
-- for this column).
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / guarded).
--
-- Run this BEFORE updating prisma/schema.prisma and BEFORE `prisma db push`.
-- (Or just run `npm run db:migrate-skill-category`, which runs the equivalent
-- statements through Prisma's client — see prisma/migrate-skill-category.ts.)

-- 1. Create the new enum type (matches `enum SkillCategory` in schema.prisma)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SkillCategory') THEN
    CREATE TYPE "SkillCategory" AS ENUM ('DEVELOPMENT', 'DESIGN', 'BUSINESS', 'LANGUAGE', 'HEALTH', 'ACADEMIC', 'OTHER');
  END IF;
END $$;

-- 2. Add a temporary column of the new enum type, defaulting to OTHER
ALTER TABLE "Skill" ADD COLUMN IF NOT EXISTS "category_new" "SkillCategory" NOT NULL DEFAULT 'OTHER';

-- 3. Backfill from the legacy free-text `category` column. Mapping below
--    covers every distinct value observed in this database's seed/admin data
--    (Development, IT, Data Science, DevOps & Cloud -> DEVELOPMENT; Design ->
--    DESIGN; Business -> BUSINESS; Language/Languages -> LANGUAGE; Health ->
--    HEALTH). Anything unrecognized (Music, Lifestyle, Other, future typos)
--    safely falls back to OTHER via the column default — no row is ever lost.
UPDATE "Skill" SET "category_new" = CASE LOWER("category")
  WHEN 'development' THEN 'DEVELOPMENT'
  WHEN 'it'           THEN 'DEVELOPMENT'
  WHEN 'data science' THEN 'DEVELOPMENT'
  WHEN 'devops & cloud' THEN 'DEVELOPMENT'
  WHEN 'programming'  THEN 'DEVELOPMENT'
  WHEN 'design'       THEN 'DESIGN'
  WHEN 'business'     THEN 'BUSINESS'
  WHEN 'marketing'    THEN 'BUSINESS'
  WHEN 'writing'      THEN 'BUSINESS'
  WHEN 'language'     THEN 'LANGUAGE'
  WHEN 'languages'    THEN 'LANGUAGE'
  WHEN 'health'       THEN 'HEALTH'
  ELSE 'OTHER'
END::"SkillCategory";

-- 4. Swap the columns: drop the old string column, promote the new one
ALTER TABLE "Skill" DROP COLUMN "category";
ALTER TABLE "Skill" RENAME COLUMN "category_new" TO "category";
