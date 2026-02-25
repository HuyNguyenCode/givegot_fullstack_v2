import { BookingWithDetails, User, Review } from '@/types'
import { BookingStatus, Skill, SkillType } from '@prisma/client'

class MockStore {
  private static instance: MockStore
  
  private users: User[] = [
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
    {
      id: 'user-mentor-3',
      email: 'python.expert@example.com',
      name: 'Emma Python',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
      bio: 'Data Scientist and Python expert. Teaching Python for web development, data analysis, and machine learning.',
      givePoints: 25,
      createdAt: new Date('2024-01-10'),
      updatedAt: new Date('2024-01-10'),
    },
    {
      id: 'user-mentor-4',
      email: 'english.teacher@example.com',
      name: 'Frank Williams',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=6',
      bio: 'IELTS instructor with 8+ years of experience. Helped 200+ students achieve their target scores.',
      givePoints: 30,
      createdAt: new Date('2024-01-12'),
      updatedAt: new Date('2024-01-12'),
    },
  ]

  private skills: Skill[] = [
    { id: 'skill-1', name: 'ReactJS', slug: 'reactjs' },
    { id: 'skill-2', name: 'NodeJS', slug: 'nodejs' },
    { id: 'skill-3', name: 'Python', slug: 'python' },
    { id: 'skill-4', name: 'UI/UX Design', slug: 'ui-ux-design' },
    { id: 'skill-5', name: 'Marketing', slug: 'marketing' },
    { id: 'skill-6', name: 'IELTS', slug: 'ielts' },
  ]

  private userSkills = [
    { userId: 'user-mentor-1', skillId: 'skill-1', type: SkillType.GIVE },
    { userId: 'user-mentor-1', skillId: 'skill-2', type: SkillType.GIVE },
    { userId: 'user-mentor-2', skillId: 'skill-4', type: SkillType.GIVE },
    { userId: 'user-mentor-3', skillId: 'skill-3', type: SkillType.GIVE },
    { userId: 'user-mentor-4', skillId: 'skill-6', type: SkillType.GIVE },
    { userId: 'user-mentee-1', skillId: 'skill-1', type: SkillType.WANT },
    { userId: 'user-mentee-1', skillId: 'skill-3', type: SkillType.WANT },
    { userId: 'user-mentee-2', skillId: 'skill-3', type: SkillType.WANT },
    { userId: 'user-mentee-2', skillId: 'skill-5', type: SkillType.WANT },
  ]

  private learningGoals: Record<string, string[]> = {
    'user-mentee-1': ['ReactJS', 'Python'],
    'user-mentee-2': ['Python', 'Marketing'],
    'user-mentor-1': [],
    'user-mentor-2': [],
    'user-mentor-3': [],
    'user-mentor-4': [],
  }

  private bookings: BookingWithDetails[] = []

  private reviews: Review[] = [
    {
      id: 'review-1',
      bookingId: 'mock-booking-1',
      mentorId: 'user-mentor-1',
      menteeId: 'user-mentee-2',
      rating: 5,
      comment: 'Alice is an amazing mentor! She explained React hooks so clearly and patiently. Highly recommend!',
      createdAt: new Date('2024-02-10'),
    },
    {
      id: 'review-2',
      bookingId: 'mock-booking-2',
      mentorId: 'user-mentor-1',
      menteeId: 'user-mentee-1',
      rating: 5,
      comment: 'Excellent session on Next.js. Alice knows her stuff and made complex topics easy to understand.',
      createdAt: new Date('2024-02-15'),
    },
    {
      id: 'review-3',
      bookingId: 'mock-booking-3',
      mentorId: 'user-mentor-3',
      menteeId: 'user-mentee-2',
      rating: 4,
      comment: 'Very helpful Python session. Emma is patient and explains things well.',
      createdAt: new Date('2024-02-12'),
    },
    {
      id: 'review-4',
      bookingId: 'mock-booking-4',
      mentorId: 'user-mentor-2',
      menteeId: 'user-mentee-1',
      rating: 5,
      comment: 'Carol helped me understand UI/UX principles beautifully. Great mentor!',
      createdAt: new Date('2024-02-18'),
    },
  ]

  private constructor() {}

  static getInstance(): MockStore {
    if (!MockStore.instance) {
      MockStore.instance = new MockStore()
    }
    return MockStore.instance
  }

  getUsers(): User[] {
    return [...this.users]
  }

  getUserById(userId: string): User | undefined {
    return this.users.find(u => u.id === userId)
  }

  getSkills(): Skill[] {
    return [...this.skills]
  }

  getUserSkills() {
    return [...this.userSkills]
  }

  getUserLearningGoals(userId: string): string[] {
    return this.learningGoals[userId] || []
  }

  getUserTeachingSkillNames(userId: string): string[] {
    const teachingSkills = this.userSkills
      .filter(us => us.userId === userId && us.type === SkillType.GIVE)
      .map(us => {
        const skill = this.skills.find(s => s.id === us.skillId)
        return skill?.name
      })
      .filter(Boolean) as string[]
    
    return teachingSkills
  }

  getBookings(): BookingWithDetails[] {
    return [...this.bookings]
  }

  getBookingById(bookingId: string): BookingWithDetails | undefined {
    return this.bookings.find(b => b.id === bookingId)
  }

  getBookingsByUserId(userId: string): BookingWithDetails[] {
    return this.bookings.filter(b => b.mentorId === userId || b.menteeId === userId)
  }

  addBooking(booking: BookingWithDetails): void {
    this.bookings.push(booking)
    console.log('✅ Booking added to store. Total:', this.bookings.length)
  }

  updateUserPoints(userId: string, pointsChange: number): boolean {
    const user = this.users.find(u => u.id === userId)
    if (user) {
      user.givePoints += pointsChange
      console.log(`✅ Updated ${user.name} points: ${user.givePoints - pointsChange} → ${user.givePoints}`)
      return true
    }
    return false
  }

  updateBookingStatus(bookingId: string, status: BookingStatus): boolean {
    const booking = this.bookings.find(b => b.id === bookingId)
    if (booking) {
      booking.status = status
      console.log(`✅ Updated booking ${bookingId} status: ${status}`)
      return true
    }
    return false
  }

  updateUserProfile(userId: string, updates: Partial<User>): boolean {
    const user = this.users.find(u => u.id === userId)
    if (user) {
      Object.assign(user, updates)
      user.updatedAt = new Date()
      console.log(`✅ Updated profile for ${user.name}`)
      return true
    }
    return false
  }

  updateUserLearningGoals(userId: string, goals: string[]): void {
    this.learningGoals[userId] = goals
    console.log(`✅ Updated learning goals for ${userId}:`, goals)
  }

  updateUserTeachingSkills(userId: string, skillNames: string[]): void {
    this.userSkills = this.userSkills.filter(
      us => !(us.userId === userId && us.type === SkillType.GIVE)
    )

    skillNames.forEach(skillName => {
      const skill = this.skills.find(s => s.name === skillName)
      if (skill) {
        this.userSkills.push({
          userId,
          skillId: skill.id,
          type: SkillType.GIVE
        })
      }
    })

    console.log(`✅ Updated teaching skills for ${userId}:`, skillNames)
  }

  addReview(review: Review): void {
    this.reviews.push(review)
    console.log(`✅ Review added for mentor ${review.mentorId}. Total reviews:`, this.reviews.length)
  }

  getReviewsByMentorId(mentorId: string): Review[] {
    return this.reviews.filter(r => r.mentorId === mentorId)
  }

  getReviewByBookingId(bookingId: string): Review | undefined {
    return this.reviews.find(r => r.bookingId === bookingId)
  }

  getMentorAverageRating(mentorId: string): { average: number; count: number } {
    const mentorReviews = this.reviews.filter(r => r.mentorId === mentorId)
    
    if (mentorReviews.length === 0) {
      return { average: 0, count: 0 }
    }

    const totalRating = mentorReviews.reduce((sum, review) => sum + review.rating, 0)
    const average = totalRating / mentorReviews.length
    
    return {
      average: Math.round(average * 10) / 10,
      count: mentorReviews.length
    }
  }

  getAllReviews(): Review[] {
    return [...this.reviews]
  }

  reset(): void {
    this.users = [
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
      {
        id: 'user-mentor-3',
        email: 'python.expert@example.com',
        name: 'Emma Python',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
        bio: 'Data Scientist and Python expert. Teaching Python for web development, data analysis, and machine learning.',
        givePoints: 25,
        createdAt: new Date('2024-01-10'),
        updatedAt: new Date('2024-01-10'),
      },
      {
        id: 'user-mentor-4',
        email: 'english.teacher@example.com',
        name: 'Frank Williams',
        avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=6',
        bio: 'IELTS instructor with 8+ years of experience. Helped 200+ students achieve their target scores.',
        givePoints: 30,
        createdAt: new Date('2024-01-12'),
        updatedAt: new Date('2024-01-12'),
      },
    ]
    
    this.skills = [
      { id: 'skill-1', name: 'ReactJS', slug: 'reactjs' },
      { id: 'skill-2', name: 'NodeJS', slug: 'nodejs' },
      { id: 'skill-3', name: 'Python', slug: 'python' },
      { id: 'skill-4', name: 'UI/UX Design', slug: 'ui-ux-design' },
      { id: 'skill-5', name: 'Marketing', slug: 'marketing' },
      { id: 'skill-6', name: 'IELTS', slug: 'ielts' },
    ]
    
    this.userSkills = [
      { userId: 'user-mentor-1', skillId: 'skill-1', type: SkillType.GIVE },
      { userId: 'user-mentor-1', skillId: 'skill-2', type: SkillType.GIVE },
      { userId: 'user-mentor-2', skillId: 'skill-4', type: SkillType.GIVE },
      { userId: 'user-mentor-3', skillId: 'skill-3', type: SkillType.GIVE },
      { userId: 'user-mentor-4', skillId: 'skill-6', type: SkillType.GIVE },
      { userId: 'user-mentee-1', skillId: 'skill-1', type: SkillType.WANT },
      { userId: 'user-mentee-1', skillId: 'skill-3', type: SkillType.WANT },
      { userId: 'user-mentee-2', skillId: 'skill-3', type: SkillType.WANT },
      { userId: 'user-mentee-2', skillId: 'skill-5', type: SkillType.WANT },
    ]
    
    this.learningGoals = {
      'user-mentee-1': ['ReactJS', 'Python'],
      'user-mentee-2': ['Python', 'Marketing'],
      'user-mentor-1': [],
      'user-mentor-2': [],
      'user-mentor-3': [],
      'user-mentor-4': [],
    }
    
    this.bookings = []
    
    this.reviews = [
      {
        id: 'review-1',
        bookingId: 'mock-booking-1',
        mentorId: 'user-mentor-1',
        menteeId: 'user-mentee-2',
        rating: 5,
        comment: 'Alice is an amazing mentor! She explained React hooks so clearly and patiently. Highly recommend!',
        createdAt: new Date('2024-02-10'),
      },
      {
        id: 'review-2',
        bookingId: 'mock-booking-2',
        mentorId: 'user-mentor-1',
        menteeId: 'user-mentee-1',
        rating: 5,
        comment: 'Excellent session on Next.js. Alice knows her stuff and made complex topics easy to understand.',
        createdAt: new Date('2024-02-15'),
      },
      {
        id: 'review-3',
        bookingId: 'mock-booking-3',
        mentorId: 'user-mentor-3',
        menteeId: 'user-mentee-2',
        rating: 4,
        comment: 'Very helpful Python session. Emma is patient and explains things well.',
        createdAt: new Date('2024-02-12'),
      },
      {
        id: 'review-4',
        bookingId: 'mock-booking-4',
        mentorId: 'user-mentor-2',
        menteeId: 'user-mentee-1',
        rating: 5,
        comment: 'Carol helped me understand UI/UX principles beautifully. Great mentor!',
        createdAt: new Date('2024-02-18'),
      },
    ]
    
    console.log('✅ Mock store reset')
  }
}

export const mockStore = MockStore.getInstance()
