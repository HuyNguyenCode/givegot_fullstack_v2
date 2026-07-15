import { PrismaClient, SkillType, BookingStatus, SkillCategory } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Clear existing data (in development only!)
  console.log('Cleaning existing data...')
  await prisma.review.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.userSkill.deleteMany()
  await prisma.skill.deleteMany()
  await prisma.user.deleteMany()
  console.log('Existing data cleared')

  // 1. Create Skills (Categorized)
  console.log('Creating categorized skills...')
  const skills = await Promise.all([
    // Development (was: Development, Data Science, DevOps & Cloud)
    prisma.skill.create({ data: { name: 'ReactJS', slug: 'reactjs', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'NodeJS', slug: 'nodejs', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Python', slug: 'python', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'TypeScript', slug: 'typescript', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'JavaScript', slug: 'javascript', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Next.js', slug: 'nextjs', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Vue.js', slug: 'vuejs', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Angular', slug: 'angular', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Machine Learning', slug: 'machine-learning', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Data Analysis', slug: 'data-analysis', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'SQL', slug: 'sql', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Pandas', slug: 'pandas', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'TensorFlow', slug: 'tensorflow', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Docker', slug: 'docker', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'AWS', slug: 'aws', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'Kubernetes', slug: 'kubernetes', category: SkillCategory.DEVELOPMENT } }),
    prisma.skill.create({ data: { name: 'CI/CD', slug: 'cicd', category: SkillCategory.DEVELOPMENT } }),

    // Design
    prisma.skill.create({ data: { name: 'UI/UX Design', slug: 'ui-ux-design', category: SkillCategory.DESIGN } }),
    prisma.skill.create({ data: { name: 'Figma', slug: 'figma', category: SkillCategory.DESIGN } }),
    prisma.skill.create({ data: { name: 'Adobe XD', slug: 'adobe-xd', category: SkillCategory.DESIGN } }),
    prisma.skill.create({ data: { name: 'Graphic Design', slug: 'graphic-design', category: SkillCategory.DESIGN } }),
    prisma.skill.create({ data: { name: 'Web Design', slug: 'web-design', category: SkillCategory.DESIGN } }),

    // Business
    prisma.skill.create({ data: { name: 'Marketing', slug: 'marketing', category: SkillCategory.BUSINESS } }),
    prisma.skill.create({ data: { name: 'Digital Marketing', slug: 'digital-marketing', category: SkillCategory.BUSINESS } }),
    prisma.skill.create({ data: { name: 'SEO', slug: 'seo', category: SkillCategory.BUSINESS } }),
    prisma.skill.create({ data: { name: 'Content Writing', slug: 'content-writing', category: SkillCategory.BUSINESS } }),
    prisma.skill.create({ data: { name: 'Product Management', slug: 'product-management', category: SkillCategory.BUSINESS } }),

    // Language
    prisma.skill.create({ data: { name: 'IELTS', slug: 'ielts', category: SkillCategory.LANGUAGE } }),
    prisma.skill.create({ data: { name: 'English Speaking', slug: 'english-speaking', category: SkillCategory.LANGUAGE } }),
    prisma.skill.create({ data: { name: 'Business English', slug: 'business-english', category: SkillCategory.LANGUAGE } }),
    prisma.skill.create({ data: { name: 'Japanese', slug: 'japanese', category: SkillCategory.LANGUAGE } }),
    prisma.skill.create({ data: { name: 'Spanish', slug: 'spanish', category: SkillCategory.LANGUAGE } }),

    // Academic (NEW: high school subjects)
    prisma.skill.create({ data: { name: 'Algebra', slug: 'algebra', category: SkillCategory.ACADEMIC } }),
    prisma.skill.create({ data: { name: 'Calculus', slug: 'calculus', category: SkillCategory.ACADEMIC } }),
    prisma.skill.create({ data: { name: 'Physics', slug: 'physics', category: SkillCategory.ACADEMIC } }),
    prisma.skill.create({ data: { name: 'Chemistry', slug: 'chemistry', category: SkillCategory.ACADEMIC } }),
    prisma.skill.create({ data: { name: 'Biology', slug: 'biology', category: SkillCategory.ACADEMIC } }),
    prisma.skill.create({ data: { name: 'World History', slug: 'world-history', category: SkillCategory.ACADEMIC } }),

    // Health
    prisma.skill.create({ data: { name: 'Yoga', slug: 'yoga', category: SkillCategory.HEALTH } }),
    prisma.skill.create({ data: { name: 'Nutrition', slug: 'nutrition', category: SkillCategory.HEALTH } }),
  ])
  console.log(`Created ${skills.length} categorized skills`)

  // 2. Create Users
  console.log('Creating users...')
  
  const aliceJohnson = await prisma.user.create({
    data: {
      email: 'mentor@example.com',
      name: 'Alice Johnson',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=1',
      bio: 'Senior Full-Stack Developer with 10 years of experience. Love teaching ReactJS and NodeJS!',
      givePoints: 15,
    },
  })

  const bobSmith = await prisma.user.create({
    data: {
      email: 'mentee@example.com',
      name: 'Bob Smith',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=2',
      bio: 'Computer Science student eager to learn web development and land my first job.',
      givePoints: 3,
    },
  })

  const carolDesigner = await prisma.user.create({
    data: {
      email: 'design.guru@example.com',
      name: 'Carol Designer',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=3',
      bio: 'UX/UI Designer specializing in beautiful, user-friendly interfaces. 5+ years in the industry.',
      givePoints: 20,
    },
  })

  const davidLee = await prisma.user.create({
    data: {
      email: 'newbie@example.com',
      name: 'David Lee',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=4',
      bio: 'Marketing professional transitioning to tech. Want to learn Python for data analysis.',
      givePoints: 3,
    },
  })

  const emmaPython = await prisma.user.create({
    data: {
      email: 'python.expert@example.com',
      name: 'Emma Python',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=5',
      bio: 'Data Scientist and Python expert. Teaching Python for web development, data analysis, and machine learning.',
      givePoints: 25,
    },
  })

  const frankWilliams = await prisma.user.create({
    data: {
      email: 'english.teacher@example.com',
      name: 'Frank Williams',
      avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=6',
      bio: 'IELTS instructor with 8+ years of experience. Helped 200+ students achieve their target scores.',
      givePoints: 30,
    },
  })

  console.log('Created 6 users')

  // 3. Create UserSkills (Teaching & Learning)
  console.log('🔗 Creating user-skill relationships...')
  
  const reactSkill = skills.find(s => s.slug === 'reactjs')!
  const nodeSkill = skills.find(s => s.slug === 'nodejs')!
  const pythonSkill = skills.find(s => s.slug === 'python')!
  const uiuxSkill = skills.find(s => s.slug === 'ui-ux-design')!
  const marketingSkill = skills.find(s => s.slug === 'marketing')!
  const ieltsSkill = skills.find(s => s.slug === 'ielts')!

  await Promise.all([
    // Alice teaches ReactJS and NodeJS
    prisma.userSkill.create({
      data: { userId: aliceJohnson.id, skillId: reactSkill.id, type: SkillType.GIVE },
    }),
    prisma.userSkill.create({
      data: { userId: aliceJohnson.id, skillId: nodeSkill.id, type: SkillType.GIVE },
    }),

    // Bob wants to learn ReactJS and Python
    prisma.userSkill.create({
      data: { userId: bobSmith.id, skillId: reactSkill.id, type: SkillType.WANT },
    }),
    prisma.userSkill.create({
      data: { userId: bobSmith.id, skillId: pythonSkill.id, type: SkillType.WANT },
    }),

    // Carol teaches UI/UX Design
    prisma.userSkill.create({
      data: { userId: carolDesigner.id, skillId: uiuxSkill.id, type: SkillType.GIVE },
    }),

    // David wants to learn Python and Marketing
    prisma.userSkill.create({
      data: { userId: davidLee.id, skillId: pythonSkill.id, type: SkillType.WANT },
    }),
    prisma.userSkill.create({
      data: { userId: davidLee.id, skillId: marketingSkill.id, type: SkillType.WANT },
    }),

    // Emma teaches Python
    prisma.userSkill.create({
      data: { userId: emmaPython.id, skillId: pythonSkill.id, type: SkillType.GIVE },
    }),

    // Frank teaches IELTS
    prisma.userSkill.create({
      data: { userId: frankWilliams.id, skillId: ieltsSkill.id, type: SkillType.GIVE },
    }),
  ])

  console.log('Created user-skill relationships')

  // 4. Create Sample Bookings
  console.log('Creating sample bookings...')
  
  const booking1 = await prisma.booking.create({
    data: {
      mentorId: aliceJohnson.id,
      menteeId: bobSmith.id,
      startTime: new Date('2024-02-15T14:00:00Z'),
      endTime: new Date('2024-02-15T15:00:00Z'),
      status: BookingStatus.COMPLETED,
      note: 'Need help with React hooks',
    },
  })

  const booking2 = await prisma.booking.create({
    data: {
      mentorId: aliceJohnson.id,
      menteeId: davidLee.id,
      startTime: new Date('2024-02-10T10:00:00Z'),
      endTime: new Date('2024-02-10T11:00:00Z'),
      status: BookingStatus.COMPLETED,
      note: 'Introduction to React',
    },
  })

  const booking3 = await prisma.booking.create({
    data: {
      mentorId: emmaPython.id,
      menteeId: davidLee.id,
      startTime: new Date('2024-02-12T16:00:00Z'),
      endTime: new Date('2024-02-12T17:00:00Z'),
      status: BookingStatus.COMPLETED,
      note: 'Python basics for data analysis',
    },
  })

  const booking4 = await prisma.booking.create({
    data: {
      mentorId: carolDesigner.id,
      menteeId: bobSmith.id,
      startTime: new Date('2024-02-18T13:00:00Z'),
      endTime: new Date('2024-02-18T14:00:00Z'),
      status: BookingStatus.COMPLETED,
      note: 'UI/UX principles for beginners',
    },
  })

  console.log('Created 4 sample bookings')

  // 5. Create Reviews (matching our mock data)
  console.log('Creating sample reviews...')
  
  await Promise.all([
    prisma.review.create({
      data: {
        bookingId: booking2.id,
        receiverId: aliceJohnson.id,
        authorId: davidLee.id,
        rating: 5,
        comment: 'Alice is an amazing mentor! She explained React hooks so clearly and patiently. Highly recommend!',
      },
    }),
    prisma.review.create({
      data: {
        bookingId: booking1.id,
        receiverId: aliceJohnson.id,
        authorId: bobSmith.id,
        rating: 5,
        comment: 'Excellent session on Next.js. Alice knows her stuff and made complex topics easy to understand.',
      },
    }),
    prisma.review.create({
      data: {
        bookingId: booking3.id,
        receiverId: emmaPython.id,
        authorId: davidLee.id,
        rating: 4,
        comment: 'Very helpful Python session. Emma is patient and explains things well.',
      },
    }),
    prisma.review.create({
      data: {
        bookingId: booking4.id,
        receiverId: carolDesigner.id,
        authorId: bobSmith.id,
        rating: 5,
        comment: 'Carol helped me understand UI/UX principles beautifully. Great mentor!',
      },
    }),
  ])

  console.log('Created 4 sample reviews')

  console.log('Database seeding completed successfully!')
  console.log('\nSummary:')
  console.log(`   - Skills: ${skills.length}`)
  console.log('   - Users: 6')
  console.log('   - User-Skill Relations: 9')
  console.log('   - Bookings: 4')
  console.log('   - Reviews: 4')
  console.log('\nYour database is ready!')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
