'use server'

import { prisma } from '@/lib/prisma'
import { generateSkillQuiz, QuizQuestion } from '@/lib/gemini'
import { revalidatePath } from 'next/cache'

interface QuizResult {
  success: boolean
  questions?: QuizQuestion[]
  message?: string
}

export async function getQuizForSkill(skillName: string): Promise<QuizResult> {
  try {
    console.log(`🎯 Getting quiz for skill: ${skillName}`)
    
    const questions = await generateSkillQuiz(skillName)
    
    return {
      success: true,
      questions,
    }
  } catch (error) {
    console.error('Error getting quiz:', error)
    return {
      success: false,
      message: 'Failed to generate quiz. Please try again.',
    }
  }
}

interface VerifyResult {
  success: boolean
  message: string
}

export async function verifyUserSkill(userSkillId: string): Promise<VerifyResult> {
  try {
    console.log(`✅ Verifying user skill: ${userSkillId}`)
    
    // Update the UserSkill to mark as verified
    await prisma.userSkill.update({
      where: { id: userSkillId },
      data: { isVerified: true },
    })
    
    // Revalidate profile page to show updated status
    revalidatePath('/profile')
    revalidatePath('/')
    
    console.log(`🎉 User skill ${userSkillId} verified successfully!`)
    
    return {
      success: true,
      message: 'Skill verified successfully! Your profile has been updated.',
    }
  } catch (error) {
    console.error('Error verifying skill:', error)
    return {
      success: false,
      message: 'Failed to verify skill. Please try again.',
    }
  }
}

// Helper function to get UserSkill with details
export async function getUserSkillDetails(userId: string, skillName: string, type: 'GIVE' | 'WANT') {
  try {
    const userSkill = await prisma.userSkill.findFirst({
      where: {
        userId,
        type,
        skill: {
          name: skillName,
        },
      },
      include: {
        skill: true,
      },
    })
    
    return userSkill
  } catch (error) {
    console.error('Error getting user skill details:', error)
    return null
  }
}
