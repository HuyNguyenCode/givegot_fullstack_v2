import { User as PrismaUser, Booking, UserSkill, Skill, BookingStatus } from '@prisma/client'

export type User = PrismaUser

export type UserWithSkills = User & {
  skills: (UserSkill & { skill: Skill })[]
}

export type BookingWithDetails = Booking & {
  mentor: User
  mentee: User
  // meetingUrl is a real DB column added via `prisma db push`. Forward-declared here
  // until `prisma generate` is re-run after restarting the dev server.
  meetingUrl: string | null
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

