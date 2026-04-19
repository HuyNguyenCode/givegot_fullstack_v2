'use server'

import { prisma } from '@/lib/prisma'
import { UserRole, ReportStatus, SkillStatus } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notifications'

// ==========================================
// ADMIN STATISTICS
// ==========================================

export async function getAdminStats() {
  try {
    const [totalUsers, totalBookings, totalGivePoints, pendingSkills, pendingReports] = await Promise.all([
      prisma.user.count(),
      prisma.booking.count(),
      prisma.user.aggregate({
        _sum: {
          givePoints: true
        }
      }),
      prisma.skill.count({
        where: {
          status: SkillStatus.PENDING
        }
      }),
      prisma.report.count({
        where: {
          status: ReportStatus.PENDING
        }
      })
    ])

    return {
      totalUsers,
      totalBookings,
      totalGivePoints: totalGivePoints._sum.givePoints || 0,
      pendingSkills,
      pendingReports
    }
  } catch (error) {
    console.error('Failed to get admin stats:', error)
    throw new Error('Failed to fetch admin statistics')
  }
}

// ==========================================
// USER MANAGEMENT
// ==========================================

export async function getAllUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        givePoints: true,
        isSuspended: true,
        createdAt: true,
        _count: {
          select: {
            mentoring: true,
            learning: true,
            reportsReceived: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return users
  } catch (error) {
    console.error('Failed to get all users:', error)
    throw new Error('Failed to fetch users')
  }
}

export async function updateUserRole(userId: string, role: UserRole) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role }
    })

    revalidatePath('/admin/users')
    return { success: true, message: `User role updated to ${role}` }
  } catch (error) {
    console.error('Failed to update user role:', error)
    return { success: false, message: 'Failed to update user role' }
  }
}

export async function adjustUserPoints(userId: string, amount: number, reason: string) {
  try {
    // Update user points
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        givePoints: {
          increment: amount
        }
      }
    })

    // Create transaction log
    await prisma.transactionLog.create({
      data: {
        userId,
        amount,
        type: 'ADMIN_ADJUSTMENT'
      }
    })

    // Notify user about admin point adjustment
    const sign = amount >= 0 ? `+${amount}` : `${amount}`
    await createNotification(
      userId,
      'GivePoints Updated',
      `An admin has adjusted your balance: ${sign} GivePoints. Reason: ${reason}. New balance: ${user.givePoints} pts.`,
      'POINTS',
      '/history'
    )

    revalidatePath('/admin/users')
    return { 
      success: true, 
      message: `Points adjusted by ${amount}. New balance: ${user.givePoints}`,
      newBalance: user.givePoints
    }
  } catch (error) {
    console.error('Failed to adjust user points:', error)
    return { success: false, message: 'Failed to adjust points' }
  }
}

export async function updateUser(userId: string, data: {
  name?: string
  role?: UserRole
  givePoints?: number
  isSuspended?: boolean
}) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data
    })

    revalidatePath('/admin/users')
    return { success: true, message: 'User updated successfully' }
  } catch (error) {
    console.error('Failed to update user:', error)
    return { success: false, message: 'Failed to update user' }
  }
}

export async function toggleUserSuspension(userId: string, suspend: boolean) {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { isSuspended: suspend }
    })

    revalidatePath('/admin/users')
    return { 
      success: true, 
      message: suspend ? 'User suspended successfully' : 'User activated successfully'
    }
  } catch (error) {
    console.error('Failed to toggle user suspension:', error)
    return { success: false, message: 'Failed to update user status' }
  }
}

export async function deleteUser(userId: string) {
  try {
    // Check if user has active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        OR: [
          { mentorId: userId, status: { in: ['PENDING', 'CONFIRMED'] } },
          { menteeId: userId, status: { in: ['PENDING', 'CONFIRMED'] } }
        ]
      }
    })

    if (activeBookings > 0) {
      return { 
        success: false, 
        message: `Cannot delete user with ${activeBookings} active booking(s). Cancel or complete them first.`
      }
    }

    // Delete user (cascade will handle relations)
    await prisma.user.delete({
      where: { id: userId }
    })

    revalidatePath('/admin/users')
    return { success: true, message: 'User deleted successfully' }
  } catch (error) {
    console.error('Failed to delete user:', error)
    return { success: false, message: 'Failed to delete user' }
  }
}

// ==========================================
// REPORT MANAGEMENT
// ==========================================

export async function getAllReports() {
  try {
    const reports = await prisma.report.findMany({
      include: {
        reporter: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true
          }
        },
        reportedUser: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true
          }
        }
      },
      orderBy: [
        { status: 'asc' }, // PENDING first
        { createdAt: 'desc' }
      ]
    })

    return reports
  } catch (error) {
    console.error('Failed to get reports:', error)
    throw new Error('Failed to fetch reports')
  }
}

export async function resolveReport(reportId: string) {
  try {
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: ReportStatus.RESOLVED,
        resolvedAt: new Date()
      }
    })

    revalidatePath('/admin/reports')
    return { success: true, message: 'Report marked as resolved' }
  } catch (error) {
    console.error('Failed to resolve report:', error)
    return { success: false, message: 'Failed to resolve report' }
  }
}

export async function createReport(reporterId: string, reportedUserId: string, reason: string) {
  try {
    await prisma.report.create({
      data: {
        reporterId,
        reportedUserId,
        reason
      }
    })

    return { success: true, message: 'Report submitted successfully' }
  } catch (error) {
    console.error('Failed to create report:', error)
    return { success: false, message: 'Failed to submit report' }
  }
}

// ==========================================
// SKILL APPROVAL SHADOW
// ==========================================

export async function getPendingSkills() {
  try {
    const skills = await prisma.skill.findMany({
      where: {
        status: SkillStatus.PENDING
      },
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return skills
  } catch (error) {
    console.error('Failed to get pending skills:', error)
    throw new Error('Failed to fetch pending skills')
  }
}

export async function approveSkill(skillId: string) {
  try {
    const skill = await prisma.skill.update({
      where: { id: skillId },
      data: { status: SkillStatus.APPROVED },
    })

    // Matching notification: find users who WANT this skill and notify them
    await notifyMatchingUsers(skill.id, skill.name)

    revalidatePath('/admin/skills')
    revalidatePath('/discover')
    return { success: true, message: 'Skill approved successfully' }
  } catch (error) {
    console.error('Failed to approve skill:', error)
    return { success: false, message: 'Failed to approve skill' }
  }
}

/**
 * Notifies users who have `skillId` as a WANT skill that a new mentor
 * teaching that skill is now available (triggered on skill approval).
 */
async function notifyMatchingUsers(skillId: string, skillName: string): Promise<void> {
  try {
    // Users who want to learn this skill
    const wantUsers = await prisma.userSkill.findMany({
      where: { skillId, type: 'WANT' },
      select: { userId: true },
    })

    // Users who give (teach) this skill — check if there is at least one mentor
    const giveCount = await prisma.userSkill.count({ where: { skillId, type: 'GIVE' } })
    if (giveCount === 0) return // No mentors to match with yet

    await Promise.all(
      wantUsers.map(({ userId }) =>
        createNotification(
          userId,
          'New Match Found!',
          `The skill "${skillName}" has been approved and mentors are available. Check out the Discover page to book a session!`,
          'MATCHING',
          '/discover'
        )
      )
    )
  } catch (error) {
    console.error('[Notification] Failed to send matching notifications:', error)
  }
}

export async function rejectSkill(skillId: string) {
  try {
    await prisma.skill.update({
      where: { id: skillId },
      data: {
        status: SkillStatus.REJECTED
      }
    })

    revalidatePath('/admin/skills')
    return { success: true, message: 'Skill rejected' }
  } catch (error) {
    console.error('Failed to reject skill:', error)
    return { success: false, message: 'Failed to reject skill' }
  }
}

export async function getAllSkills() {
  try {
    const skills = await prisma.skill.findMany({
      include: {
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { createdAt: 'desc' }
      ]
    })

    return skills
  } catch (error) {
    console.error('Failed to get all skills:', error)
    throw new Error('Failed to fetch skills')
  }
}

export async function createSkill(data: {
  name: string
  category: string
  status?: SkillStatus
}) {
  try {
    // Generate slug
    const slug = data.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')

    // Check if skill already exists
    const existing = await prisma.skill.findFirst({
      where: {
        OR: [
          { name: { equals: data.name, mode: 'insensitive' } },
          { slug }
        ]
      }
    })

    if (existing) {
      return { success: false, message: 'A skill with this name already exists' }
    }

    // Create skill
    await prisma.skill.create({
      data: {
        name: data.name.trim(),
        slug,
        category: data.category,
        status: data.status || 'APPROVED' // Master skills are approved by default
      }
    })

    revalidatePath('/admin/skills')
    revalidatePath('/discover')
    return { success: true, message: 'Skill created successfully' }
  } catch (error) {
    console.error('Failed to create skill:', error)
    return { success: false, message: 'Failed to create skill' }
  }
}

export async function updateSkill(skillId: string, data: {
  name?: string
  category?: string
  status?: SkillStatus
}) {
  try {
    // If name is being updated, regenerate slug
    let updateData: any = { ...data }
    
    if (data.name) {
      const slug = data.name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '')
      
      updateData.slug = slug
    }

    await prisma.skill.update({
      where: { id: skillId },
      data: updateData
    })

    revalidatePath('/admin/skills')
    revalidatePath('/discover')
    return { success: true, message: 'Skill updated successfully' }
  } catch (error) {
    console.error('Failed to update skill:', error)
    return { success: false, message: 'Failed to update skill' }
  }
}

export async function deleteSkill(skillId: string) {
  try {
    // Check if any users are using this skill
    const usageCount = await prisma.userSkill.count({
      where: { skillId }
    })

    if (usageCount > 0) {
      return { 
        success: false, 
        message: `Cannot delete skill. ${usageCount} user(s) are currently teaching or learning this skill.`
      }
    }

    // Safe to delete
    await prisma.skill.delete({
      where: { id: skillId }
    })

    revalidatePath('/admin/skills')
    revalidatePath('/discover')
    return { success: true, message: 'Skill deleted successfully' }
  } catch (error) {
    console.error('Failed to delete skill:', error)
    return { success: false, message: 'Failed to delete skill' }
  }
}
