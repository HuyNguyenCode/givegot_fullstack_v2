'use server'

import { prisma } from '@/lib/prisma'
import { generateLearningRoadmap, RoadmapStep } from '@/lib/gemini'
import { revalidatePath } from 'next/cache'

interface RoadmapResult {
  success: boolean
  roadmap?: RoadmapStep[]
  message?: string
}

export async function getOrGenerateRoadmap(
  userSkillId: string,
  skillName: string
): Promise<RoadmapResult> {
  try {
    console.log(`🗺️ Getting/Generating roadmap for UserSkill: ${userSkillId}, Skill: ${skillName}`)

    // Step 1: Fetch the UserSkill by ID
    const userSkill = await prisma.userSkill.findUnique({
      where: { id: userSkillId },
    })

    if (!userSkill) {
      return {
        success: false,
        message: 'User skill not found',
      }
    }

    // Step 2: Check if roadmap already exists (cache hit)
    if (userSkill.roadmap) {
      console.log('✅ Roadmap cache hit! Returning existing roadmap.')
      return {
        success: true,
        roadmap: userSkill.roadmap as RoadmapStep[],
      }
    }

    // Step 3: Generate new roadmap using AI
    console.log('🤖 Cache miss. Generating new AI roadmap...')
    const roadmap = await generateLearningRoadmap(skillName)

    // Step 4: Save the roadmap to database (cache it)
    await prisma.userSkill.update({
      where: { id: userSkillId },
      data: { roadmap: roadmap as any }, // Cast to any for Json type
    })

    console.log('💾 Roadmap saved to database successfully!')

    // Revalidate profile page to reflect the cached roadmap
    revalidatePath('/profile')

    return {
      success: true,
      roadmap,
    }
  } catch (error) {
    console.error('❌ Error in getOrGenerateRoadmap:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to generate roadmap',
    }
  }
}

// Helper function to clear roadmap cache (useful for testing or if user wants to regenerate)
export async function clearRoadmapCache(userSkillId: string): Promise<{ success: boolean }> {
  try {
    await prisma.userSkill.update({
      where: { id: userSkillId },
      data: { roadmap: null },
    })

    revalidatePath('/profile')

    return { success: true }
  } catch (error) {
    console.error('❌ Error clearing roadmap cache:', error)
    return { success: false }
  }
}
