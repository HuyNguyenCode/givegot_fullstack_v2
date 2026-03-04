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
//         SELECT 
//           u.id,
//           u.email,
//           u.name,
//           u."avatarUrl",
//           u.bio,
//           u."givePoints",
//           u."createdAt",
//           u."updatedAt",
//           -- ĐÃ SỬA: Lấy Mentor teaching so sánh với Bob learning
//           1 - (u."teachingEmbedding" <=> u2."learningEmbedding") as similarity
//         FROM "User" u
//         CROSS JOIN "User" u2
//         WHERE u2.id = ${currentUserId}
//           AND u.id != ${currentUserId}
//           AND u."teachingEmbedding" IS NOT NULL
//         ORDER BY similarity DESC
//         LIMIT 50
//       `

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
            
//             // Note: AI Semantic match might not have exact string matches, 
//             // but we keep this for UI compatibility
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

//     // --- ĐÃ THÊM: In bảng điểm AI ra Terminal để theo dõi ---
//     if (useVectorSearch) {
//       console.log('\n📊 BẢNG ĐIỂM AI CHẤM CHO NGỮ NGHĨA:')
//       mentorsWithSkills.forEach(m => {
//         console.log(`   - Mentor: ${m.name} | Điểm: ${Number(m.similarity || 0).toFixed(4)}`)
//       })
//       console.log('-------------------------------------------\n')
//     }
//    0.57
//     const threshold = useVectorSearch ? 0.60 : 0
    
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
import { generateEmbedding } from '@/lib/gemini'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

// ✨ REFACTORED: Granular skill-level auto-matching (eliminates vector dilution)
interface GranularMatchResult {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  givePoints: number
  createdAt: Date
  updatedAt: Date
  maxSimilarity: number
  hasKeywordMatch: boolean
}

export async function getAutoMatchedMentors(currentUserId: string) {
  try {
    console.log('🎯 Starting GRANULAR skill-level auto-match for user:', currentUserId)
    
    // Step 1: Get current user's learning goals (WANT skills)
    const userLearningSkills = await prisma.userSkill.findMany({
      where: {
        userId: currentUserId,
        type: SkillType.WANT,
      },
      include: {
        skill: true,
      },
    })
    
    const userLearningGoalNames = userLearningSkills.map(us => us.skill.name)
    console.log('📚 User learning goals:', userLearningGoalNames)

    // If user has no learning goals, return empty results
    if (userLearningGoalNames.length === 0) {
      console.log('⚠️ User has no learning goals, returning empty results')
      return {
        bestMatches: [],
        otherMentors: [],
        userLearningGoals: [],
      }
    }

    // Step 2: Perform GRANULAR skill-level similarity search with CROSS JOIN
   // Step 2: Perform GRANULAR skill-level similarity search with CROSS JOIN
   console.log('🤖 Using GRANULAR skill-level embedding comparison...')
    
   // 👇 THÊM DÒNG NÀY ĐỂ TẠO MẪU TÌM KIẾM CHO BIO:
   const ilikePatterns = userLearningGoalNames.map(name => `%${name}%`)
   
   const rawMentors = await prisma.$queryRaw<GranularMatchResult[]>`
     SELECT 
       u.id,
       u.email,
       u.name,
       u."avatarUrl",
       u.bio,
       u."givePoints",
       u."createdAt",
       u."updatedAt",
       -- GRANULAR: Compare each mentor's GIVE skill against ALL user's WANT skills
       MAX(
         CASE 
           WHEN s_give.embedding IS NOT NULL AND s_want.embedding IS NOT NULL
           THEN 1 - (s_give.embedding <=> s_want.embedding)
           ELSE 0
         END
       ) as "maxSimilarity",
       -- HYBRID: Check if skill name matches OR bio matches user's goals
       BOOL_OR(
         s_give.name = ANY(ARRAY[${Prisma.join(userLearningGoalNames)}]::text[]) OR
         u.bio ILIKE ANY(ARRAY[${Prisma.join(ilikePatterns)}]::text[])
       ) as "hasKeywordMatch"
     FROM "User" u
     INNER JOIN "UserSkill" us_give ON us_give."userId" = u.id AND us_give.type = 'GIVE'
     INNER JOIN "Skill" s_give ON s_give.id = us_give."skillId"
     -- CROSS JOIN: Compare against ALL of the current user's WANT skills
     CROSS JOIN (
       SELECT s.embedding, s.name
       FROM "UserSkill" us
       INNER JOIN "Skill" s ON s.id = us."skillId"
       WHERE us."userId" = ${currentUserId} 
         AND us.type = 'WANT' 
         AND s.embedding IS NOT NULL
     ) s_want
     WHERE u.id != ${currentUserId}
       AND s_give.embedding IS NOT NULL
     GROUP BY u.id, u.email, u.name, u."avatarUrl", u.bio, u."givePoints", u."createdAt", u."updatedAt"
     HAVING 
       -- Include if keyword match (Skill OR Bio) OR semantic >= 0.55
       BOOL_OR(
         s_give.name = ANY(ARRAY[${Prisma.join(userLearningGoalNames)}]::text[]) OR
         u.bio ILIKE ANY(ARRAY[${Prisma.join(ilikePatterns)}]::text[])
       ) = true
       OR MAX(
         CASE 
           WHEN s_give.embedding IS NOT NULL AND s_want.embedding IS NOT NULL
           THEN 1 - (s_give.embedding <=> s_want.embedding)
           ELSE 0
         END
       ) >= 0.55
     ORDER BY "hasKeywordMatch" DESC, "maxSimilarity" DESC
     LIMIT 30
   `

    console.log(`✅ Found ${rawMentors.length} mentors via granular skill-level search`)

    // Step 3: Enrich with full teaching skills and isVerified status
    const mentorsWithSkills = await Promise.all(
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
          isVerified: us.isVerified,
        }))

        // Identify which skills are matched (exist in user's learning goals)
        const matchedSkills = teachingSkills
          .filter(skill => userLearningGoalNames.includes(skill.name))
          .map(skill => skill.name)

        return {
          ...mentor,
          teachingSkills,
          matchedSkills,
          matchScore: mentor.maxSimilarity,
          similarity: mentor.maxSimilarity,
        }
      })
    )

    console.log('\n📊 GRANULAR SKILL-LEVEL MATCH SCORES:')
    mentorsWithSkills.forEach(m => {
      console.log(`   - ${m.name}: ${(m.similarity * 100).toFixed(1)}% (Keyword: ${m.hasKeywordMatch ? 'YES' : 'NO'})`)
    })
    console.log('-------------------------------------------\n')

    // Step 4: 🧠 THUẬT TOÁN NGƯỠNG ĐỘNG CÓ PHANH ABS
    // Step 4: 🧠 SỬ DỤNG MỐC VÀNG TĨNH CHO AUTO-MATCH (Nhiều mục tiêu)
    const keywordMatches = mentorsWithSkills.filter(m => m.hasKeywordMatch);
    const semanticMatches = mentorsWithSkills
      .filter(m => !m.hasKeywordMatch)
      .sort((a, b) => b.maxSimilarity - a.maxSimilarity);

    // Mốc vàng 0.585 đã được kiểm chứng:
    // - Vớt được: React -> Web Dev (0.631) | Python -> ML (0.588)
    // - Chặn được: React -> ML (0.582)
    const STATIC_CUTOFF = 0.585;

    const topSemantic = semanticMatches.filter(m => m.maxSimilarity >= STATIC_CUTOFF);
    const remainingSemantic = semanticMatches.filter(m => m.maxSimilarity < STATIC_CUTOFF);

    const bestMatches = [...keywordMatches, ...topSemantic];
    const otherMentors = remainingSemantic;

    console.log(`🎯 Static Auto-Match results (Cutoff: ${STATIC_CUTOFF}):`)
    console.log(`   Learning goals: ${userLearningGoalNames.join(', ')}`)
    console.log(`   Best matches: ${bestMatches.length} (keyword OR semantic >= ${STATIC_CUTOFF})`)
    console.log(`   Other mentors: ${otherMentors.length} (fallback list)`)

    return {
      bestMatches,
      otherMentors,
      userLearningGoals: userLearningGoalNames,
    }
  } catch (error) {
    console.error('❌ Error in granular auto-match:', error)
    
    // Fallback: Try keyword matching if granular search fails
    console.log('⚠️ Falling back to keyword matching...')
    
    try {
      const userLearningSkills = await prisma.userSkill.findMany({
        where: {
          userId: currentUserId,
          type: SkillType.WANT,
        },
        include: {
          skill: true,
        },
      })
      
      const userLearningGoalNames = userLearningSkills.map(us => us.skill.name)
      
      if (userLearningGoalNames.length === 0) {
        return {
          bestMatches: [],
          otherMentors: [],
          userLearningGoals: [],
        }
      }

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

      const mentorsWithSkills = mentors.map(mentor => {
        const teachingSkills = mentor.skills.map(us => ({
          id: us.skill.id,
          name: us.skill.name,
          slug: us.skill.slug,
          isVerified: us.isVerified,
        }))

        const matchedSkills = teachingSkills
          .filter(skill => userLearningGoalNames.includes(skill.name))
          .map(skill => skill.name)
        
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

      const bestMatches = mentorsWithSkills.filter(m => m.matchScore > 0)
      const otherMentors = mentorsWithSkills.filter(m => m.matchScore === 0)

      console.log(`🔤 Keyword fallback results: ${bestMatches.length} matches`)

      return {
        bestMatches,
        otherMentors,
        userLearningGoals: userLearningGoalNames,
      }
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError)
      return {
        bestMatches: [],
        otherMentors: [],
        userLearningGoals: [],
      }
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
      teachingSkills: mentor.skills.map(us => ({
        ...us.skill,
        isVerified: us.isVerified, // ✨ Show verified status
      })),
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
      teachingSkills: mentor.skills.map(us => ({
        ...us.skill,
        isVerified: us.isVerified, // ✨ Show verified status
      })),
    }
  } catch (error) {
    console.error('Error fetching mentor:', error)
    return null
  }
}

// ✨ REFACTORED: Granular skill-level semantic search with hybrid matching
interface SemanticSearchResult {
  id: string
  email: string
  name: string | null
  avatarUrl: string | null
  bio: string | null
  givePoints: number
  createdAt: Date
  updatedAt: Date
  maxSimilarity: number // Highest similarity score among all their skills
  hasKeywordMatch: boolean // True if any skill name matches keyword
}

export async function searchMentorsSemantically(query: string, currentUserId: string) {
  try {
    console.log(`🔍 Starting GRANULAR skill-level semantic search for: "${query}"`)

    if (!query || query.trim().length === 0) {
      console.warn('⚠️ Empty search query, returning empty results')
      return {
        mentors: [],
        query: query,
        totalFound: 0,
      }
    }

    // Step A: Generate embedding for the search query
    console.log('🤖 Generating query embedding...')
    const queryEmbedding = await generateEmbedding(query)
    const embeddingString = `[${queryEmbedding.join(',')}]`

    // Step B: Perform GRANULAR skill-level similarity search with HYBRID matching
    const queryLower = query.toLowerCase()
    
    console.log('🎯 Executing hybrid search (keyword + semantic at skill level)...')
    
    const rawResults = await prisma.$queryRaw<SemanticSearchResult[]>`
      SELECT 
        u.id,
        u.email,
        u.name,
        u."avatarUrl",
        u.bio,
        u."givePoints",
        u."createdAt",
        u."updatedAt",
        -- GRANULAR: Find the BEST matching SKILL for each mentor (not aggregated user embedding)
        MAX(
          CASE 
            WHEN s.embedding IS NOT NULL 
            THEN 1 - (s.embedding <=> ${embeddingString}::vector)
            ELSE 0
          END
        ) as "maxSimilarity",
        -- HYBRID: Check if any skill name or bio matches keyword (case-insensitive)
        BOOL_OR(
          LOWER(s.name) LIKE ${`%${queryLower}%`} OR 
          LOWER(u.bio) LIKE ${`%${queryLower}%`}
        ) as "hasKeywordMatch"
      FROM "User" u
      INNER JOIN "UserSkill" us ON us."userId" = u.id AND us.type = 'GIVE'
      INNER JOIN "Skill" s ON s.id = us."skillId"
      WHERE u.id != ${currentUserId}
      GROUP BY u.id, u.email, u.name, u."avatarUrl", u.bio, u."givePoints", u."createdAt", u."updatedAt"
      HAVING 
        -- HYBRID FILTER: Include if keyword match OR semantic score >= 55%
        BOOL_OR(
          LOWER(s.name) LIKE ${`%${queryLower}%`} OR 
          LOWER(u.bio) LIKE ${`%${queryLower}%`}
        ) = true
        OR 
        MAX(
          CASE 
            WHEN s.embedding IS NOT NULL 
            THEN 1 - (s.embedding <=> ${embeddingString}::vector)
            ELSE 0
          END
        ) >= 0.57
         -- gốc là 0.605
      ORDER BY 
        -- Keyword matches prioritized first, then semantic score
        "hasKeywordMatch" DESC,
        "maxSimilarity" DESC
      LIMIT 50
    `
    // 👇 THÊM DÒNG MÁY QUÉT NÀY VÀO NGAY SAU KHI CHẠY XONG SQL:
    console.log("🕵️ MÁY QUÉT ĐIỂM SỐ AI THỰC TẾ:");
    rawResults.forEach(r => {
      console.log(`   👉 ${r.name}: ${r.maxSimilarity}`);
    });

    console.log(`📊 Hybrid search found ${rawResults.length} mentors`)
    console.log(`   - Keyword matches: ${rawResults.filter(r => r.hasKeywordMatch).length}`)
    console.log(`   - Pure semantic matches: ${rawResults.filter(r => !r.hasKeywordMatch).length}`)

    // Step C: Enrich with full teaching skills and isVerified status
    const mentorsWithSkills = await Promise.all(
      rawResults.map(async (mentor) => {
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
          isVerified: us.isVerified,
        }))

        // Identify which skills are keyword matches (for UI highlighting)
        const matchedSkills = teachingSkills
          .filter(skill => 
            skill.name.toLowerCase().includes(queryLower) ||
            skill.slug.toLowerCase().includes(queryLower)
          )
          .map(skill => skill.name)

        return {
          ...mentor,
          teachingSkills,
          matchedSkills, // Skills that directly match the keyword
          matchScore: mentor.maxSimilarity,
          similarity: mentor.maxSimilarity,
        }
      })
    )

    console.log(`✅ Granular semantic search complete! Returning ${mentorsWithSkills.length} mentors`)

    return {
      mentors: mentorsWithSkills,
      query: query,
      totalFound: mentorsWithSkills.length,
    }
  } catch (error) {
    console.error('❌ Error in granular semantic search:', error)
    throw new Error('Failed to perform semantic search')
  }
}