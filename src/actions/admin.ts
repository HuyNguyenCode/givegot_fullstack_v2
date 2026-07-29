'use server'

import { prisma } from '@/lib/prisma'
import {
  UserRole,
  ReportStatus,
  SkillStatus,
  SkillCategory,
  BookingStatus,
  TransactionType,
  ReportResolutionType,
} from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { createNotification } from './notifications'
import { verifyMeetingAttendance } from '@/lib/google-meet'
import { isAdmin } from '@/lib/admin'

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
        },
        // NEW: booking context — lets the UI show 3 financial resolution
        // buttons instead of the generic "mark resolved" button whenever
        // a report is linked to a disputed session.
        booking: {
          select: {
            id: true,
            status: true,
            startTime: true,
            endTime: true,
          },
        },
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

export type AttendanceEvidenceResult =
  | {
      success: true
      mentorMinutes: number
      menteeMinutes: number
      source: 'api' | 'mock'
    }
  | {
      success: false
      message: string
    }

/**
 * Fetches objective Google Meet attendance evidence for an admin reviewing a
 * booking-linked report. Keeping this separate from the reports query prevents
 * the external attendance lookup from blocking the initial page render.
 */
export async function getAttendanceEvidence(
  bookingId: string,
): Promise<AttendanceEvidenceResult> {
  try {
    if (!(await isAdmin())) {
      return { success: false, message: 'Unauthorized.' }
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: {
        meetingUrl: true,
        startTime: true,
        endTime: true,
        mentor: { select: { email: true } },
        mentee: { select: { email: true } },
      },
    })

    if (!booking) {
      return { success: false, message: 'Booking not found.' }
    }

    if (!booking.meetingUrl) {
      return {
        success: false,
        message: 'No Google Meet link is stored for this booking.',
      }
    }

    const attendance = await verifyMeetingAttendance(
      booking.meetingUrl,
      booking.mentor.email,
      booking.mentee.email,
      new Date(booking.startTime),
      new Date(booking.endTime),
    )

    if (!attendance) {
      return {
        success: false,
        message: 'Attendance data is currently unavailable.',
      }
    }

    return {
      success: true,
      mentorMinutes: attendance.mentorMinutes,
      menteeMinutes: attendance.menteeMinutes,
      source: attendance.source,
    }
  } catch (error) {
    console.error('[getAttendanceEvidence] Error:', error)
    return {
      success: false,
      message: 'Failed to fetch attendance evidence.',
    }
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

// ==========================================
// ABSENCE REPORT RESOLUTION (Financial + Trust Score)
// ==========================================
//
// Unlike `resolveReport` above (which only flips the ticket to RESOLVED),
// this actually settles the underlying dispute: it moves the escrowed
// GivePoint to the correct party and applies a Trust Score penalty where
// appropriate, then marks the Report resolved in the SAME transaction so
// the two can never drift out of sync. Fully additive — `resolveReport`
// is untouched and still used for generic (non-booking) reports.

export type AbsenceResolutionType =
  | 'RESOLVE_MENTEE_ABSENT'
  | 'RESOLVE_MENTOR_ABSENT'
  | 'RESOLVE_SYSTEM_ERROR'

interface ResolveAbsenceReportInput {
  reportId: string
  bookingId: string
  resolutionType: AbsenceResolutionType
  adminNotes?: string
}

interface ResolveAbsenceReportResult {
  success: boolean
  message: string
}

/** Trust Score penalty applied to whichever party the admin confirms was absent. */
const ADMIN_ABSENCE_TRUST_PENALTY = 20

const RESOLUTION_TYPE_MAP: Record<AbsenceResolutionType, ReportResolutionType> = {
  RESOLVE_MENTEE_ABSENT: ReportResolutionType.MENTEE_ABSENT,
  RESOLVE_MENTOR_ABSENT: ReportResolutionType.MENTOR_ABSENT,
  RESOLVE_SYSTEM_ERROR:  ReportResolutionType.SYSTEM_ERROR,
}

const TERMINAL_BOOKING_STATUSES: BookingStatus[] = [
  BookingStatus.MISSED,
  BookingStatus.CANCELLED,
  BookingStatus.COMPLETED,
]

export async function resolveAbsenceReport({
  reportId,
  bookingId,
  resolutionType,
  adminNotes,
}: ResolveAbsenceReportInput): Promise<ResolveAbsenceReportResult> {
  try {
    // ── 1. Fetch report + booking (with both parties) ─────────────────────
    const [report, booking] = await Promise.all([
      prisma.report.findUnique({ where: { id: reportId } }),
      prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          mentor: { select: { id: true, name: true, email: true } },
          mentee: { select: { id: true, name: true, email: true } },
        },
      }),
    ])

    if (!report) {
      return { success: false, message: 'Không tìm thấy báo cáo.' }
    }
    if (report.status === ReportStatus.RESOLVED) {
      return { success: false, message: 'Báo cáo này đã được xử lý trước đó.' }
    }
    if (!booking) {
      return { success: false, message: 'Không tìm thấy buổi học liên quan đến báo cáo này.' }
    }
    if (TERMINAL_BOOKING_STATUSES.includes(booking.status)) {
      return {
        success: false,
        message: `Buổi học đã ở trạng thái cuối (${booking.status}) — không thể xử lý tài chính lại để tránh hoàn/trừ điểm trùng lặp.`,
      }
    }

    const newBookingStatus: BookingStatus =
      resolutionType === 'RESOLVE_SYSTEM_ERROR' ? BookingStatus.CANCELLED : BookingStatus.MISSED

    // ── 2. Atomic transaction — GivePoints + Trust Score + status + ticket ──
    await prisma.$transaction(async (tx) => {
      if (resolutionType === 'RESOLVE_MENTEE_ABSENT') {
        // Mentee confirmed absent → release the escrowed GivePoint to the mentor.
        await tx.user.update({
          where: { id: booking.mentorId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: { userId: booking.mentorId, amount: 1, type: TransactionType.ADMIN_RESOLVED_MENTEE_ABSENT, bookingId },
        })

        // Re-read trust score inside the transaction to avoid stale reads.
        const latestMentee = await tx.user.findUnique({ where: { id: booking.menteeId }, select: { trustScore: true } })
        if (!latestMentee) throw new Error('Mentee record missing inside transaction')
        const newTrust = Math.max(0, latestMentee.trustScore - ADMIN_ABSENCE_TRUST_PENALTY)
        await tx.user.update({ where: { id: booking.menteeId }, data: { trustScore: newTrust } })
        await tx.trustHistory.create({
          data: {
            userId: booking.menteeId,
            previousScore: latestMentee.trustScore,
            newScore: newTrust,
            reason:
              `Admin xác nhận Mentee vắng mặt (buổi học ${bookingId}). GivePoint đã chuyển cho Mentor.` +
              (adminNotes ? ` Ghi chú admin: ${adminNotes}` : ''),
          },
        })
      } else if (resolutionType === 'RESOLVE_MENTOR_ABSENT') {
        // Mentor confirmed absent → refund 100% of the GivePoint to the mentee.
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: { userId: booking.menteeId, amount: 1, type: TransactionType.ADMIN_RESOLVED_MENTOR_ABSENT, bookingId },
        })

        const latestMentor = await tx.user.findUnique({ where: { id: booking.mentorId }, select: { trustScore: true } })
        if (!latestMentor) throw new Error('Mentor record missing inside transaction')
        const newTrust = Math.max(0, latestMentor.trustScore - ADMIN_ABSENCE_TRUST_PENALTY)
        await tx.user.update({ where: { id: booking.mentorId }, data: { trustScore: newTrust } })
        await tx.trustHistory.create({
          data: {
            userId: booking.mentorId,
            previousScore: latestMentor.trustScore,
            newScore: newTrust,
            reason:
              `Admin xác nhận Mentor vắng mặt (buổi học ${bookingId}). Mentee đã được hoàn 100% GivePoint.` +
              (adminNotes ? ` Ghi chú admin: ${adminNotes}` : ''),
          },
        })
      } else {
        // RESOLVE_SYSTEM_ERROR — no one's fault: full refund, zero Trust Score change.
        await tx.user.update({
          where: { id: booking.menteeId },
          data: { givePoints: { increment: 1 } },
        })
        await tx.transactionLog.create({
          data: { userId: booking.menteeId, amount: 1, type: TransactionType.ADMIN_RESOLVED_SYSTEM_ERROR, bookingId },
        })
      }

      await tx.booking.update({ where: { id: bookingId }, data: { status: newBookingStatus } })

      await tx.report.update({
        where: { id: reportId },
        data: {
          status: ReportStatus.RESOLVED,
          resolvedAt: new Date(),
          resolutionType: RESOLUTION_TYPE_MAP[resolutionType],
          adminNotes: adminNotes?.trim() || null,
        },
      })
    })

    // ── 3. Best-effort notifications (never block the response) ────────────
    try {
      if (resolutionType === 'RESOLVE_MENTEE_ABSENT') {
        await Promise.all([
          createNotification(
            booking.mentorId,
            'Tranh chấp đã được giải quyết',
            'Admin xác nhận Mentee vắng mặt trong buổi học. Bạn đã nhận được +1 GivePoint.',
            'POINTS',
            '/dashboard',
          ),
          createNotification(
            booking.menteeId,
            'Tranh chấp đã được giải quyết',
            `Admin xác nhận bạn đã vắng mặt buổi học. −${ADMIN_ABSENCE_TRUST_PENALTY} Trust Score đã được áp dụng.`,
            'SYSTEM',
            '/dashboard',
          ),
        ])
      } else if (resolutionType === 'RESOLVE_MENTOR_ABSENT') {
        await Promise.all([
          createNotification(
            booking.menteeId,
            'Tranh chấp đã được giải quyết',
            'Admin xác nhận Mentor vắng mặt trong buổi học. Bạn đã được hoàn 100% GivePoint.',
            'POINTS',
            '/dashboard',
          ),
          createNotification(
            booking.mentorId,
            'Tranh chấp đã được giải quyết',
            `Admin xác nhận bạn đã vắng mặt buổi học. −${ADMIN_ABSENCE_TRUST_PENALTY} Trust Score đã được áp dụng.`,
            'SYSTEM',
            '/dashboard',
          ),
        ])
      } else {
        await Promise.all([
          createNotification(
            booking.menteeId,
            'Tranh chấp đã được giải quyết',
            'Admin xác định đây là lỗi hệ thống — không ai vắng mặt. Bạn đã được hoàn 100% GivePoint.',
            'POINTS',
            '/dashboard',
          ),
          createNotification(
            booking.mentorId,
            'Tranh chấp đã được giải quyết',
            'Admin xác định buổi học này là lỗi hệ thống. Không có hình phạt nào được áp dụng cho bạn.',
            'SYSTEM',
            '/dashboard',
          ),
        ])
      }
    } catch (notifyError) {
      console.error('[resolveAbsenceReport] Failed to notify users:', notifyError)
    }

    // ── 4. Revalidate affected pages ─────────────────────────────────────────
    revalidatePath('/admin/reports')
    revalidatePath('/dashboard')
    revalidatePath('/history')

    const messages: Record<AbsenceResolutionType, string> = {
      RESOLVE_MENTEE_ABSENT: `Đã xác nhận Mentee vắng mặt. 1 GivePoint chuyển cho Mentor, −${ADMIN_ABSENCE_TRUST_PENALTY} Trust Score cho Mentee.`,
      RESOLVE_MENTOR_ABSENT: `Đã xác nhận Mentor vắng mặt. 1 GivePoint hoàn cho Mentee, −${ADMIN_ABSENCE_TRUST_PENALTY} Trust Score cho Mentor.`,
      RESOLVE_SYSTEM_ERROR:  'Đã hoàn 100% GivePoint cho Mentee do lỗi hệ thống. Không ai bị trừ Trust Score.',
    }

    return { success: true, message: messages[resolutionType] }
  } catch (error) {
    console.error('[resolveAbsenceReport] Error:', error)
    return { success: false, message: 'Không thể xử lý báo cáo. Vui lòng thử lại.' }
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
  category: SkillCategory
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
  category?: SkillCategory
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
