'use server'

import { prisma } from '@/lib/prisma'
import { User } from '@/types'
import { SkillType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { generateSkillEmbedding } from '@/lib/gemini'
import { Prisma } from '@prisma/client'

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

export async function getUserLearningGoals(userId: string): Promise<string[]> {
  try {
    const userSkills = await prisma.userSkill.findMany({
      where: {
        userId,
        type: SkillType.WANT,
      },
      include: {
        skill: true,
      },
    })
    
    return userSkills.map(us => us.skill.name)
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
      include: {
        skill: true,
      },
    })
    
    return userSkills.map(us => ({
      id: us.skill.id,
      name: us.skill.name,
      slug: us.skill.slug,
      isVerified: us.isVerified, // ✨ Include verification status
    }))
  } catch (error) {
    console.error('Error fetching teaching skills:', error)
    return []
  }
}

export async function getAllAvailableSkills() {
  try {
    const skills = await prisma.skill.findMany({
      orderBy: { name: 'asc' },
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

// Helper function to ensure skill exists (create if not)
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

  // If skill doesn't exist, create it
  if (!skill) {
    const slug = generateSlug(trimmedName)
    
    // Check if slug already exists, if so, append a number
    let finalSlug = slug
    let counter = 1
    while (await prisma.skill.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${slug}-${counter}`
      counter++
    }

    console.log(`✨ Creating new skill: "${trimmedName}" with slug "${finalSlug}"`)
    
    skill = await prisma.skill.create({
      data: {
        name: trimmedName,
        slug: finalSlug,
        category: 'Other', // Default category for custom skills
      },
    })
  }

  return skill.id
}

export async function updateUserProfile(
  userId: string,
  updates: ProfileUpdateData
): Promise<ProfileUpdateResult> {
  try {
    console.log('🔵 Updating user profile:', userId, updates)
    
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

        await prisma.userSkill.createMany({
          data: skillIds.map(skillId => ({
            userId,
            skillId,
            type: SkillType.GIVE,
          })),
        })

        // Generate and save teaching embedding
        console.log('🤖 Generating teaching embedding...')
        const teachingEmbedding = await generateSkillEmbedding(updates.teachingSkills)
        const vectorString = `[${teachingEmbedding.join(',')}]`
        
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "teachingEmbedding" = ${vectorString}::vector 
          WHERE id = ${userId}
        `
        console.log('✅ Teaching embedding saved')
      } else {
        // Clear embedding if no teaching skills
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "teachingEmbedding" = NULL 
          WHERE id = ${userId}
        `
        console.log('✅ Teaching embedding cleared')
      }
    }

    // Update learning goals (WANT)
    if (updates.learningGoals !== undefined) {
      console.log('📚 Updating learning goals:', updates.learningGoals)
      
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

        await prisma.userSkill.createMany({
          data: skillIds.map(skillId => ({
            userId,
            skillId,
            type: SkillType.WANT,
          })),
        })

        // Generate and save learning embedding
        console.log('🤖 Generating learning embedding...')
        const learningEmbedding = await generateSkillEmbedding(updates.learningGoals)
        const vectorString = `[${learningEmbedding.join(',')}]`
        
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "learningEmbedding" = ${vectorString}::vector 
          WHERE id = ${userId}
        `
        console.log('✅ Learning embedding saved')
      } else {
        // Clear embedding if no learning goals
        await prisma.$executeRaw`
          UPDATE "User" 
          SET "learningEmbedding" = NULL 
          WHERE id = ${userId}
        `
        console.log('✅ Learning embedding cleared')
      }
    }

    revalidatePath('/')
    revalidatePath('/discover')
    revalidatePath('/profile')

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
