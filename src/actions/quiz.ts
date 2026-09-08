'use server'

import { prisma } from '@/lib/prisma'
import { generateSkillQuiz, QuizQuestion } from '@/lib/gemini'
import { revalidatePath } from 'next/cache'
import { SkillType } from '@prisma/client'
import { auth } from '@/lib/auth'
import { PUBLISHED_SKILL_WHERE } from '@/lib/skill-publication'

interface QuizResult {
  success: boolean
  questions?: QuizQuestion[]
  message?: string
}

export async function getQuizForSkill(skillName: string): Promise<QuizResult> {
  try {
    console.log(`Getting quiz for skill: ${skillName}`)

    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        message: 'Vui lòng đăng nhập để làm bài xác thực kỹ năng.',
      }
    }

    // A quiz is only available to the owner of a published GIVE skill.
    // Re-checking here prevents direct server-action calls from bypassing the UI.
    const eligibleSkill = await prisma.userSkill.findFirst({
      where: {
        userId: session.user.id,
        type: SkillType.GIVE,
        skill: {
          name: skillName,
          ...PUBLISHED_SKILL_WHERE,
        },
      },
      select: { id: true },
    })

    if (!eligibleSkill) {
      return {
        success: false,
        message: `Kỹ năng "${skillName}" chưa sẵn sàng để xác thực. Kỹ năng cần được Admin duyệt và chuẩn bị tìm kiếm hoàn tất.`,
      }
    }
    
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
    console.log(`Verifying user skill: ${userSkillId}`)

    const session = await auth()
    if (!session?.user?.id) {
      return {
        success: false,
        message: 'Vui lòng đăng nhập để xác thực kỹ năng.',
      }
    }

    // The conditional update is both an ownership check and a final publication
    // check. If Admin unpublishes the skill while the quiz is open, no badge is saved.
    const updated = await prisma.userSkill.updateMany({
      where: {
        id: userSkillId,
        userId: session.user.id,
        type: SkillType.GIVE,
        skill: PUBLISHED_SKILL_WHERE,
      },
      data: { isVerified: true },
    })

    if (updated.count !== 1) {
      return {
        success: false,
        message: 'Kỹ năng không còn sẵn sàng để xác thực hoặc không thuộc hồ sơ của bạn.',
      }
    }
    
    // Revalidate profile page to show updated status
    revalidatePath('/profile')
    revalidatePath('/')
    
    console.log(`User skill ${userSkillId} verified successfully!`)
    
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
    const session = await auth()
    if (!session?.user?.id || session.user.id !== userId) {
      return null
    }

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
