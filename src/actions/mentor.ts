// 'use server'

// import { prisma } from '@/lib/prisma'
// import { SkillType, Prisma } from '@prisma/client'

// interface MentorMatch {
//   id: string
//   email: string
//   name: string | null
//   avatarUrl: string | null
//   bio: string | null
//   givePoints: number
//   createdAt: Date
//   updatedAt: Date
//   teachingSkills: Array<{
//     id: string
//     name: string
//     slug: string
//   }>
//   matchedSkills: string[]
//   matchScore: number
// }

// interface RawMentorResult {
//   id: string
//   email: string
//   name: string | null
//   avatarUrl: string | null
//   bio: string | null
//   givePoints: number
//   createdAt: Date
//   updatedAt: Date
//   similarity: number
// }

// export async function getAutoMatchedMentors(currentUserId: string) {
//   try {
//     console.log('🎯 Starting AI-powered auto-match for user:', currentUserId)
    
//     // Get current user's learning goals (WANT skills)
//     const userLearningSkills = await prisma.userSkill.findMany({
//       where: {
//         userId: currentUserId,
//         type: SkillType.WANT,
//       },
//       include: {
//         skill: true,
//       },
//     })
    
//     const userLearningGoals = userLearningSkills.map(us => us.skill.name)
//     console.log('📚 User learning goals:', userLearningGoals)

//     // Get current user's learning embedding (use raw query since Prisma doesn't support vector type)
//     const currentUserRaw = await prisma.$queryRaw<Array<{ hasEmbedding: boolean }>>`
//       SELECT CASE WHEN "learningEmbedding" IS NOT NULL THEN true ELSE false END as "hasEmbedding"
//       FROM "User"
//       WHERE id = ${currentUserId}
//     `

//     const hasLearningEmbedding = currentUserRaw[0]?.hasEmbedding || false

//     let mentorsWithSkills: any[] = []
//     let useVectorSearch = false

//     // Try vector similarity search if embedding exists
//     if (hasLearningEmbedding) {
//       console.log('🤖 Using AI Vector Similarity Search')
//       useVectorSearch = true
      
//       try {
//         // Perform cosine similarity search using pgvector
//         const rawMentors = await prisma.$queryRaw<RawMentorResult[]>`
//           SELECT 
//             u.id,
//             u.email,
//             u.name,
//             u."avatarUrl",
//             u.bio,
//             u."givePoints",
//             u."createdAt",
//             u."updatedAt",
//             1 - (u."learningEmbedding" <=> u2."teachingEmbedding") as similarity
//           FROM "User" u
//           CROSS JOIN "User" u2
//           WHERE u2.id = ${currentUserId}
//             AND u.id != ${currentUserId}
//             AND u."teachingEmbedding" IS NOT NULL
//           ORDER BY similarity DESC
//           LIMIT 50
//         `

//         console.log(`✅ Found ${rawMentors.length} mentors via vector search`)

//         // Enrich with teaching skills
//         mentorsWithSkills = await Promise.all(
//           rawMentors.map(async (mentor) => {
//             const skills = await prisma.userSkill.findMany({
//               where: {
//                 userId: mentor.id,
//                 type: SkillType.GIVE,
//               },
//               include: {
//                 skill: true,
//               },
//             })

//             const teachingSkills = skills.map(us => ({
//               id: us.skill.id,
//               name: us.skill.name,
//               slug: us.skill.slug,
//             }))

//             const teachingSkillNames = teachingSkills.map(s => s.name)
//             const matchedSkills = userLearningGoals.filter(goal =>
//               teachingSkillNames.includes(goal)
//             )

//             return {
//               ...mentor,
//               teachingSkills,
//               matchedSkills,
//               matchScore: mentor.similarity,
//               similarity: mentor.similarity,
//             }
//           })
//         )
//       } catch (vectorError) {
//         console.error('⚠️ Vector search failed, falling back to keyword matching:', vectorError)
//         useVectorSearch = false
//       }
//     }

//     // Fallback: Use keyword matching if no embedding or vector search failed
//     if (!useVectorSearch || mentorsWithSkills.length === 0) {
//       console.log('🔤 Using Keyword Matching (fallback)')
      
//       const mentors = await prisma.user.findMany({
//         where: {
//           id: { not: currentUserId },
//           skills: {
//             some: {
//               type: SkillType.GIVE,
//             },
//           },
//         },
//         include: {
//           skills: {
//             where: {
//               type: SkillType.GIVE,
//             },
//             include: {
//               skill: true,
//             },
//           },
//         },
//       })

//       mentorsWithSkills = mentors.map(mentor => {
//         const teachingSkills = mentor.skills.map(us => ({
//           id: us.skill.id,
//           name: us.skill.name,
//           slug: us.skill.slug,
//         }))

//         const teachingSkillNames = teachingSkills.map(s => s.name)
        
//         const matchedSkills = userLearningGoals.filter(goal => 
//           teachingSkillNames.includes(goal)
//         )
        
//         const matchScore = matchedSkills.length

//         return {
//           id: mentor.id,
//           email: mentor.email,
//           name: mentor.name,
//           avatarUrl: mentor.avatarUrl,
//           bio: mentor.bio,
//           givePoints: mentor.givePoints,
//           createdAt: mentor.createdAt,
//           updatedAt: mentor.updatedAt,
//           teachingSkills,
//           matchedSkills,
//           matchScore,
//         }
//       })

//       mentorsWithSkills.sort((a, b) => b.matchScore - a.matchScore)
//     }

//     // Split into best matches and others
//     // For vector search: similarity > 0.5 = best match
//     // For keyword: matchScore > 0 = best match
//     const threshold = useVectorSearch ? 0.5 : 0
    
//     const bestMatches = mentorsWithSkills.filter(m => 
//       useVectorSearch ? (m.similarity || 0) > threshold : m.matchScore > 0
//     )
    
//     const otherMentors = mentorsWithSkills.filter(m =>
//       useVectorSearch ? (m.similarity || 0) <= threshold : m.matchScore === 0
//     )

//     console.log(`🎯 Auto-match results (${useVectorSearch ? 'AI' : 'Keyword'}):`)
//     console.log(`   Learning goals: ${userLearningGoals.join(', ')}`)
//     console.log(`   Best matches: ${bestMatches.length}`)
//     console.log(`   Other mentors: ${otherMentors.length}`)

//     return {
//       bestMatches,
//       otherMentors,
//       userLearningGoals,
//     }
//   } catch (error) {
//     console.error('Error getting auto-matched mentors:', error)
//     return {
//       bestMatches: [],
//       otherMentors: [],
//       userLearningGoals: [],
//     }
//   }
// }

// export async function getMentors(excludeUserId?: string) {
//   try {
//     const mentors = await prisma.user.findMany({
//       where: {
//         ...(excludeUserId && { id: { not: excludeUserId } }),
//         skills: {
//           some: {
//             type: SkillType.GIVE,
//           },
//         },
//       },
//       include: {
//         skills: {
//           where: {
//             type: SkillType.GIVE,
//           },
//           include: {
//             skill: true,
//           },
//         },
//       },
//     })

//     return mentors.map(mentor => ({
//       ...mentor,
//       teachingSkills: mentor.skills.map(us => us.skill),
//     }))
//   } catch (error) {
//     console.error('Error fetching mentors:', error)
//     return []
//   }
// }

// export async function getMentorById(mentorId: string) {
//   try {
//     const mentor = await prisma.user.findUnique({
//       where: { id: mentorId },
//       include: {
//         skills: {
//           where: {
//             type: SkillType.GIVE,
//           },
//           include: {
//             skill: true,
//           },
//         },
//       },
//     })

//     if (!mentor) {
//       return null
//     }

//     return {
//       ...mentor,
//       teachingSkills: mentor.skills.map(us => us.skill),
//     }
//   } catch (error) {
//     console.error('Error fetching mentor:', error)
//     return null
//   }
// }
'use server'

import { prisma } from '@/lib/prisma'
import { SkillType, Prisma } from '@prisma/client'

interface MentorMatch {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  givePoints: number
  createdAt: Date
  updatedAt: Date
  teachingSkills: Array<{
    id: string
    name: string
    slug: string
  }>
  matchedSkills: string[]
  matchScore: number
}

interface RawMentorResult {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  givePoints: number
  createdAt: Date
  updatedAt: Date
  similarity: number
}

export async function getAutoMatchedMentors(currentUserId: string) {
  try {
    console.log('🎯 Starting AI-powered auto-match for user:', currentUserId)
    
    // Get current user's learning goals (WANT skills)
    const userLearningSkills = await prisma.userSkill.findMany({
      where: {
        userId: currentUserId,
        type: SkillType.WANT,
      },
      include: {
        skill: true,
      },
    })
    
    const userLearningGoals = userLearningSkills.map(us => us.skill.name)
    console.log('📚 User learning goals:', userLearningGoals)

    // Get current user's learning embedding (use raw query since Prisma doesn't support vector type)
    const currentUserRaw = await prisma.$queryRaw<Array<{ hasEmbedding: boolean }>>`
      SELECT CASE WHEN "learningEmbedding" IS NOT NULL THEN true ELSE false END as "hasEmbedding"
      FROM "User"
      WHERE id = ${currentUserId}
    `

    const hasLearningEmbedding = currentUserRaw[0]?.hasEmbedding || false

    let mentorsWithSkills: any[] = []
    let useVectorSearch = false

    // Try vector similarity search if embedding exists
    if (hasLearningEmbedding) {
      console.log('🤖 Using AI Vector Similarity Search')
      useVectorSearch = true
      
      try {
        // Perform cosine similarity search using pgvector
        const rawMentors = await prisma.$queryRaw<RawMentorResult[]>`
        SELECT 
          u.id,
          u.email,
          u.name,
          u."avatarUrl",
          u.bio,
          u."givePoints",
          u."createdAt",
          u."updatedAt",
          -- ĐÃ SỬA: Lấy Mentor teaching so sánh với Bob learning
          1 - (u."teachingEmbedding" <=> u2."learningEmbedding") as similarity
        FROM "User" u
        CROSS JOIN "User" u2
        WHERE u2.id = ${currentUserId}
          AND u.id != ${currentUserId}
          AND u."teachingEmbedding" IS NOT NULL
        ORDER BY similarity DESC
        LIMIT 50
      `

        console.log(`✅ Found ${rawMentors.length} mentors via vector search`)

        // Enrich with teaching skills
        mentorsWithSkills = await Promise.all(
          rawMentors.map(async (mentor) => {
            const skills = await prisma.userSkill.findMany({
              where: {
                userId: mentor.id,
                type: SkillType.GIVE,
              },
              include: {
                skill: true,
              },
            })

            const teachingSkills = skills.map(us => ({
              id: us.skill.id,
              name: us.skill.name,
              slug: us.skill.slug,
            }))

            const teachingSkillNames = teachingSkills.map(s => s.name)
            
            // Note: AI Semantic match might not have exact string matches, 
            // but we keep this for UI compatibility
            const matchedSkills = userLearningGoals.filter(goal =>
              teachingSkillNames.includes(goal)
            )

            return {
              ...mentor,
              teachingSkills,
              matchedSkills,
              matchScore: mentor.similarity,
              similarity: mentor.similarity,
            }
          })
        )
      } catch (vectorError) {
        console.error('⚠️ Vector search failed, falling back to keyword matching:', vectorError)
        useVectorSearch = false
      }
    }

    // Fallback: Use keyword matching if no embedding or vector search failed
    if (!useVectorSearch || mentorsWithSkills.length === 0) {
      console.log('🔤 Using Keyword Matching (fallback)')
      
      const mentors = await prisma.user.findMany({
        where: {
          id: { not: currentUserId },
          skills: {
            some: {
              type: SkillType.GIVE,
            },
          },
        },
        include: {
          skills: {
            where: {
              type: SkillType.GIVE,
            },
            include: {
              skill: true,
            },
          },
        },
      })

      mentorsWithSkills = mentors.map(mentor => {
        const teachingSkills = mentor.skills.map(us => ({
          id: us.skill.id,
          name: us.skill.name,
          slug: us.skill.slug,
        }))

        const teachingSkillNames = teachingSkills.map(s => s.name)
        
        const matchedSkills = userLearningGoals.filter(goal => 
          teachingSkillNames.includes(goal)
        )
        
        const matchScore = matchedSkills.length

        return {
          id: mentor.id,
          email: mentor.email,
          name: mentor.name,
          avatarUrl: mentor.avatarUrl,
          bio: mentor.bio,
          givePoints: mentor.givePoints,
          createdAt: mentor.createdAt,
          updatedAt: mentor.updatedAt,
          teachingSkills,
          matchedSkills,
          matchScore,
        }
      })

      mentorsWithSkills.sort((a, b) => b.matchScore - a.matchScore)
    }

    // --- ĐÃ THÊM: In bảng điểm AI ra Terminal để theo dõi ---
    if (useVectorSearch) {
      console.log('\n📊 BẢNG ĐIỂM AI CHẤM CHO NGỮ NGHĨA:')
      mentorsWithSkills.forEach(m => {
        console.log(`   - Mentor: ${m.name} | Điểm: ${Number(m.similarity || 0).toFixed(4)}`)
      })
      console.log('-------------------------------------------\n')
    }

    // --- ĐÃ SỬA: Hạ ngưỡng điểm (threshold) xuống 0.15 do vector đã bị cắt ---
    const threshold = useVectorSearch ? 0.57 : 0
    
    const bestMatches = mentorsWithSkills.filter(m => 
      useVectorSearch ? (m.similarity || 0) > threshold : m.matchScore > 0
    )
    
    const otherMentors = mentorsWithSkills.filter(m =>
      useVectorSearch ? (m.similarity || 0) <= threshold : m.matchScore === 0
    )

    console.log(`🎯 Auto-match results (${useVectorSearch ? 'AI' : 'Keyword'}):`)
    console.log(`   Learning goals: ${userLearningGoals.join(', ')}`)
    console.log(`   Best matches: ${bestMatches.length}`)
    console.log(`   Other mentors: ${otherMentors.length}`)

    return {
      bestMatches,
      otherMentors,
      userLearningGoals,
    }
  } catch (error) {
    console.error('Error getting auto-matched mentors:', error)
    return {
      bestMatches: [],
      otherMentors: [],
      userLearningGoals: [],
    }
  }
}

export async function getMentors(excludeUserId?: string) {
  try {
    const mentors = await prisma.user.findMany({
      where: {
        ...(excludeUserId && { id: { not: excludeUserId } }),
        skills: {
          some: {
            type: SkillType.GIVE,
          },
        },
      },
      include: {
        skills: {
          where: {
            type: SkillType.GIVE,
          },
          include: {
            skill: true,
          },
        },
      },
    })

    return mentors.map(mentor => ({
      ...mentor,
      teachingSkills: mentor.skills.map(us => us.skill),
    }))
  } catch (error) {
    console.error('Error fetching mentors:', error)
    return []
  }
}

export async function getMentorById(mentorId: string) {
  try {
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: {
        skills: {
          where: {
            type: SkillType.GIVE,
          },
          include: {
            skill: true,
          },
        },
      },
    })

    if (!mentor) {
      return null
    }

    return {
      ...mentor,
      teachingSkills: mentor.skills.map(us => us.skill),
    }
  } catch (error) {
    console.error('Error fetching mentor:', error)
    return null
  }
}