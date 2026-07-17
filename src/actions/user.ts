'use server'

import { prisma } from '@/lib/prisma'
import { User } from '@/types'
import { SkillType, SkillCategory, UserRole } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { generateSkillEmbedding } from '@/lib/gemini'
import { Prisma } from '@prisma/client'
import { sendEmail, getAppUrl } from '@/lib/email'
import NewMatchEmail from '@/emails/NewMatchEmail'

export async function getAllUsers(): Promise<User[]> {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return users
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    })
    return user
  } catch (error) {
    console.error('Error fetching user:', error)
    return null
  }
}

export interface UserSearchResult {
  id: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  role: UserRole
  trustScore: number
  teachingSkillsCount: number
}

// Plain keyword search (name contains, case-insensitive OR exact id match).
// Intentionally separate from the AI semantic mentor search — does NOT touch
// embeddings, cosine similarity, or any Time-banking logic.
export async function searchUsers(query: string, currentUserId?: string): Promise<UserSearchResult[]> {
  try {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return []

    const users = await prisma.user.findMany({
      where: {
        isSuspended: false,
        ...(currentUserId ? { id: { not: currentUserId } } : {}),
        OR: [
          { name: { contains: trimmedQuery, mode: 'insensitive' } },
          { id: trimmedQuery },
        ],
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        bio: true,
        role: true,
        trustScore: true,
        skills: {
          where: { type: SkillType.GIVE },
          select: { id: true },
        },
      },
      orderBy: { name: 'asc' },
      take: 30,
    })

    return users.map((user) => ({
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      trustScore: user.trustScore,
      teachingSkillsCount: user.skills.length,
    }))
  } catch (error) {
    console.error('Error searching users:', error)
    return []
  }
}

export async function getUserWithSkills(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    })
    return user
  } catch (error) {
    console.error('Error fetching user with skills:', error)
    return null
  }
}

export async function getUserLearningGoals(userId: string): Promise<Array<{ id: string; name: string; roadmap: any | null }>> {
  try {
    const userSkills = await prisma.userSkill.findMany({
      where: {
        userId,
        type: SkillType.WANT,
      },
      select: {
        id: true,
        roadmap: true,
        skill: { select: { name: true } },
      },
    })

    return userSkills.map(us => ({
      id: us.id,
      name: us.skill.name,
      roadmap: us.roadmap,
    }))
  } catch (error) {
    console.error('Error fetching learning goals:', error)
    return []
  }
}

export async function getUserTeachingSkills(userId: string): Promise<Array<{ id: string; name: string; slug: string; isVerified: boolean }>> {
  try {
    const userSkills = await prisma.userSkill.findMany({
      where: {
        userId,
        type: SkillType.GIVE,
      },
      select: {
        isVerified: true,
        skill: { select: { id: true, name: true, slug: true } },
      },
    })
    
    return userSkills.map(us => ({
      id: us.skill.id,
      name: us.skill.name,
      slug: us.skill.slug,
      isVerified: us.isVerified,
    }))
  } catch (error) {
    console.error('Error fetching teaching skills:', error)
    return []
  }
}

// Returns the flat list of skills, pre-sorted by category then name so
// consumers can group them client-side just by walking the array in order
// (see `groupSkillsByCategory` in src/lib/skill-category.ts for a ready-made helper).
export async function getAllAvailableSkills() {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, category: true, status: true },
    })
    return skills
  } catch (error) {
    console.error('Error fetching skills:', error)
    return []
  }
}

interface ProfileUpdateData {
  name?: string
  bio?: string
  avatarUrl?: string
  learningGoals?: string[]
  teachingSkills?: string[]
}

interface ProfileUpdateResult {
  success: boolean
  message: string
}

// Helper function to generate URL-friendly slug
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
}

// Helper function to ensure skill exists (create if not) and generate embedding
async function ensureSkillExists(skillName: string): Promise<string> {
  const trimmedName = skillName.trim()

  // Check if skill already exists (case-insensitive)
  let skill = await prisma.skill.findFirst({
    where: {
      name: {
        equals: trimmedName,
        mode: 'insensitive',
      },
    },
  })

  // If skill doesn't exist, create it WITH embedding
  if (!skill) {
    const slug = generateSlug(trimmedName)

    // Check if slug already exists, if so, append a number
    let finalSlug = slug
    let counter = 1
    while (await prisma.skill.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`
      counter++
    }

    console.log(`Creating new skill: "${trimmedName}" with slug "${finalSlug}"`)
    
    skill = await prisma.skill.create({
      data: {
        name: trimmedName,
        slug: finalSlug,
        category: SkillCategory.OTHER,
        status: 'PENDING', // NEW: All custom skills require admin approval
      },
    })

    // Auto-embed: generate and persist the vector immediately so the new skill
    // is searchable as soon as an admin approves it (no manual backfill needed).
    try {
      console.log(`Auto-generating embedding for new skill: "${trimmedName}"`)
      const embedding = await generateSkillEmbedding([trimmedName])
      if (embedding.length > 0) {
        const vectorString = `[${embedding.join(',')}]`
        await prisma.$executeRaw`
          UPDATE "Skill"
          SET embedding = ${vectorString}::vector
          WHERE id = ${skill.id}
        `
        console.log(`Embedding saved for new skill "${trimmedName}"`)
      }
    } catch (embeddingError) {
      // Non-fatal: skill is still created; embedding can be backfilled later.
      console.error(`Failed to auto-generate embedding for "${trimmedName}":`, embeddingError)
    }
  }

  return skill.id
}

// ── Real-time Cross-Matching Email Notifications ────────────────────────────
//
// Fires organically whenever a user adds a brand-new GIVE or WANT skill to
// their profile (as opposed to `notifyMatchingUsers` in admin.ts, which fires
// when an admin approves a pending skill). Entirely additive: it runs strictly
// AFTER the profile/embedding update has already succeeded, is fully isolated
// via try/catch + Promise.allSettled, and can never affect the caller's result.
async function notifyNewSkillCrossMatches(
  userId: string,
  newlyAddedGiveSkillIds: string[],
  newlyAddedWantSkillIds: string[]
): Promise<void> {
  if (newlyAddedGiveSkillIds.length === 0 && newlyAddedWantSkillIds.length === 0) return

  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    })
    if (!currentUser) return

    const discoverUrl = `${getAppUrl()}/discover`
    const emailTasks: Promise<{ success: boolean; error?: string }>[] = []

    // ── Scenario A: newly added GIVE skill → notify every OTHER user who WANTs it ──
    if (newlyAddedGiveSkillIds.length > 0) {
      const giveSkills = await prisma.skill.findMany({
        where: { id: { in: newlyAddedGiveSkillIds } },
        select: { id: true, name: true },
      })

      for (const skill of giveSkills) {
        const wantMatches = await prisma.userSkill.findMany({
          where: { skillId: skill.id, type: SkillType.WANT, userId: { not: userId } },
          select: { user: { select: { name: true, email: true } } },
        })

        for (const { user: matchedUser } of wantMatches) {
          if (!matchedUser.email) continue
          emailTasks.push(
            sendEmail({
              to: matchedUser.email,
              subject: `Tin hot: đã có mentor dạy "${skill.name}" bạn đang tìm! ✨`,
              react: NewMatchEmail({
                userName: matchedUser.name || matchedUser.email,
                skillName: skill.name,
                discoverUrl,
              }),
            })
          )
        }
      }
    }

    // ── Scenario B: newly added WANT skill → if a mentor already exists, notify ME ──
    if (newlyAddedWantSkillIds.length > 0) {
      const wantSkills = await prisma.skill.findMany({
        where: { id: { in: newlyAddedWantSkillIds } },
        select: { id: true, name: true },
      })

      for (const skill of wantSkills) {
        const mentorCount = await prisma.userSkill.count({
          where: { skillId: skill.id, type: SkillType.GIVE, userId: { not: userId } },
        })
        if (mentorCount === 0) continue // No mentor available yet — nothing to notify

        if (!currentUser.email) continue
        emailTasks.push(
          sendEmail({
            to: currentUser.email,
            subject: `Môn "${skill.name}" bạn muốn học đã có sẵn Mentor, vào đặt lịch ngay! 🚀`,
            react: NewMatchEmail({
              userName: currentUser.name || currentUser.email,
              skillName: skill.name,
              discoverUrl,
            }),
          })
        )
      }
    }

    if (emailTasks.length > 0) {
      const results = await Promise.allSettled(emailTasks)
      const failures = results.filter((r) => r.status === 'rejected').length
      console.log(
        `[CrossMatch] Sent ${results.length - failures}/${results.length} cross-match emails ` +
          `for user ${userId} (${newlyAddedGiveSkillIds.length} new GIVE, ${newlyAddedWantSkillIds.length} new WANT)`
      )
    }
  } catch (error) {
    // Non-fatal by design: cross-match notifications must never affect the
    // primary updateUserProfile flow that triggered them.
    console.error('[CrossMatch] Failed to send skill cross-match notifications:', error)
  }
}

export async function updateUserProfile(
  userId: string,
  updates: ProfileUpdateData
): Promise<ProfileUpdateResult> {
  try {
    console.log('Updating user profile:', userId, updates)

    // ── Skill diffing (for cross-match emails below) ──────────────────────────
    // Snapshot the user's CURRENT skill ids before anything is deleted/updated,
    // so we can later tell exactly which GIVE/WANT skills are brand new. This
    // read-only query never touches embeddings or the profile update itself.
    const previousSkills = await prisma.userSkill.findMany({
      where: { userId, type: { in: [SkillType.GIVE, SkillType.WANT] } },
      select: { skillId: true, type: true },
    })
    const previousGiveSkillIds = new Set(
      previousSkills.filter((s) => s.type === SkillType.GIVE).map((s) => s.skillId)
    )
    const previousWantSkillIds = new Set(
      previousSkills.filter((s) => s.type === SkillType.WANT).map((s) => s.skillId)
    )
    // Populated below while resolving the incoming skill lists — used only for
    // the additive, non-blocking cross-match email step at the end of this function.
    let newlyAddedGiveSkillIds: string[] = []
    let newlyAddedWantSkillIds: string[] = []

    // Update basic profile fields
    if (updates.name !== undefined || updates.bio !== undefined || updates.avatarUrl !== undefined) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(updates.name !== undefined && { name: updates.name }),
          ...(updates.bio !== undefined && { bio: updates.bio }),
          ...(updates.avatarUrl !== undefined && { avatarUrl: updates.avatarUrl }),
        },
      })
    }

    // Update teaching skills (GIVE)
    if (updates.teachingSkills !== undefined) {
      console.log('🎓 Updating teaching skills:', updates.teachingSkills)
      
      // Remove old teaching skills
      await prisma.userSkill.deleteMany({
        where: {
          userId,
          type: SkillType.GIVE,
        },
      })

      // Add new teaching skills
      if (updates.teachingSkills.length > 0) {
        // Ensure all skills exist (create custom ones if needed)
        const skillIds = await Promise.all(
          updates.teachingSkills.map(skillName => ensureSkillExists(skillName))
        )

        // Diff against the pre-update snapshot: only genuinely new GIVE skills
        // should trigger a cross-match email — re-saving existing ones must not spam.
        newlyAddedGiveSkillIds = skillIds.filter((skillId) => !previousGiveSkillIds.has(skillId))

        await prisma.userSkill.createMany({
          data: skillIds.map(skillId => ({
            userId,
            skillId,
            type: SkillType.GIVE,
          })),
        })

        // Generate and save teaching embedding
        console.log('Generating teaching embedding...')
        const teachingEmbedding = await generateSkillEmbedding(updates.teachingSkills)
        const vectorString = `[${teachingEmbedding.join(',')}]`
        
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "teachingEmbedding" = ${vectorString}::vector 
          WHERE id = ${userId}
        `
        console.log('Teaching embedding saved')
      } else {
        // Clear embedding if no teaching skills
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "teachingEmbedding" = NULL 
          WHERE id = ${userId}
        `
        console.log('Teaching embedding cleared')
      }
    }

    // Update learning goals (WANT)
    if (updates.learningGoals !== undefined) {
      console.log('Updating learning goals:', updates.learningGoals)
      
      // Remove old learning goals
      await prisma.userSkill.deleteMany({
        where: {
          userId,
          type: SkillType.WANT,
        },
      })

      // Add new learning goals
      if (updates.learningGoals.length > 0) {
        // Ensure all skills exist (create custom ones if needed)
        const skillIds = await Promise.all(
          updates.learningGoals.map(skillName => ensureSkillExists(skillName))
        )

        // Diff against the pre-update snapshot: only genuinely new WANT skills
        // should trigger a cross-match email — re-saving existing ones must not spam.
        newlyAddedWantSkillIds = skillIds.filter((skillId) => !previousWantSkillIds.has(skillId))

        await prisma.userSkill.createMany({
          data: skillIds.map(skillId => ({
            userId,
            skillId,
            type: SkillType.WANT,
          })),
        })

        // Generate and save learning embedding
        console.log('Generating learning embedding...')
        const learningEmbedding = await generateSkillEmbedding(updates.learningGoals)
        const vectorString = `[${learningEmbedding.join(',')}]`
        
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "learningEmbedding" = ${vectorString}::vector 
          WHERE id = ${userId}
        `
        console.log('Learning embedding saved')
      } else {
        // Clear embedding if no learning goals
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "learningEmbedding" = NULL 
          WHERE id = ${userId}
        `
        console.log('Learning embedding cleared')
      }
    }

    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath('/profile')

    // ── Cross-match email notifications (additive, non-blocking) ─────────────
    // Runs strictly AFTER the profile update + embeddings above have already
    // succeeded. Wrapped in its own try/catch so a Resend/DB hiccup here can
    // never turn a successful profile update into a failed response.
    try {
      await notifyNewSkillCrossMatches(userId, newlyAddedGiveSkillIds, newlyAddedWantSkillIds)
    } catch (crossMatchError) {
      console.error('[CrossMatch] Unexpected error triggering cross-match notifications:', crossMatchError)
    }

    return {
      success: true,
      message: 'Profile updated successfully! AI-powered mentor matches will be refreshed.',
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return {
      success: false,
      message: 'Failed to update profile. Please try again.',
    }
  }
}
