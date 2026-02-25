import { User, BookingWithDetails } from '@/types'
import { BookingStatus, Skill, SkillType } from '@prisma/client'

export const MOCK_SKILLS: Skill[] = [
  { id: 'skill-1', name: 'ReactJS', slug: 'reactjs' },
  { id: 'skill-2', name: 'NodeJS', slug: 'nodejs' },
  { id: 'skill-3', name: 'Python', slug: 'python' },
  { id: 'skill-4', name: 'UI/UX Design', slug: 'ui-ux-design' },
  { id: 'skill-5', name: 'Marketing', slug: 'marketing' },
  { id: 'skill-6', name: 'IELTS', slug: 'ielts' },
]

export const MOCK_USERS: User[] = [
  {
    id: 'user-mentor-1',
    email: 'mentor@example.com',
    name: 'Alice Johnson',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
    bio: 'Senior Full-Stack Developer with 10 years of experience. Love teaching ReactJS and NodeJS!',
    givePoints: 15,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
  },
  {
    id: 'user-mentee-1',
    email: 'mentee@example.com',
    name: 'Bob Smith',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
    bio: 'Computer Science student eager to learn web development and land my first job.',
    givePoints: 3,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
  },
  {
    id: 'user-mentor-2',
    email: 'design.guru@example.com',
    name: 'Carol Designer',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
    bio: 'UX/UI Designer specializing in beautiful, user-friendly interfaces. 5+ years in the industry.',
    givePoints: 20,
    createdAt: new Date('2024-01-18'),
    updatedAt: new Date('2024-01-18'),
  },
  {
    id: 'user-mentee-2',
    email: 'newbie@example.com',
    name: 'David Lee',
    avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4',
    bio: 'Marketing professional transitioning to tech. Want to learn Python for data analysis.',
    givePoints: 3,
    createdAt: new Date('2024-01-22'),
    updatedAt: new Date('2024-01-22'),
  },
]

export const MOCK_USER_SKILLS = [
  { userId: 'user-mentor-1', skillId: 'skill-1', type: SkillType.GIVE },
  { userId: 'user-mentor-1', skillId: 'skill-2', type: SkillType.GIVE },
  { userId: 'user-mentor-2', skillId: 'skill-4', type: SkillType.GIVE },
  { userId: 'user-mentee-1', skillId: 'skill-1', type: SkillType.WANT },
  { userId: 'user-mentee-1', skillId: 'skill-3', type: SkillType.WANT },
  { userId: 'user-mentee-2', skillId: 'skill-3', type: SkillType.WANT },
  { userId: 'user-mentee-2', skillId: 'skill-5', type: SkillType.WANT },
]

export let MOCK_BOOKINGS: BookingWithDetails[] = []

export function updateUserPoints(userId: string, pointsChange: number) {
  const user = MOCK_USERS.find(u => u.id === userId)
  if (user) {
    user.givePoints += pointsChange
  }
}

export function addMockBooking(booking: BookingWithDetails) {
  MOCK_BOOKINGS.push(booking)
}

export function updateMockBookingStatus(bookingId: string, status: BookingStatus) {
  const booking = MOCK_BOOKINGS.find(b => b.id === bookingId)
  if (booking) {
    booking.status = status
  }
}

export function getMockBookingById(bookingId: string) {
  return MOCK_BOOKINGS.find(b => b.id === bookingId)
}

export function getMockBookingsByUser(userId: string) {
  return MOCK_BOOKINGS.filter(
    b => b.mentorId === userId || b.menteeId === userId
  )
}

export function resetMockData() {
  MOCK_USERS[0].givePoints = 15
  MOCK_USERS[1].givePoints = 3
  MOCK_USERS[2].givePoints = 20
  MOCK_USERS[3].givePoints = 3
  MOCK_BOOKINGS = []
}

