import { User as PrismaUser, Booking, UserSkill, Skill, BookingStatus } from '@prisma/client'

export type User = PrismaUser

export type UserWithSkills = User & {
  skills: (UserSkill & { skill: Skill })[]
}

export type BookingWithDetails = Booking & {
  mentor: User
  mentee: User
}

export interface Review {
  id: string
  bookingId: string
  mentorId: string
  menteeId: string
  rating: number
  comment: string | null
  createdAt: Date
}

export { BookingStatus }

