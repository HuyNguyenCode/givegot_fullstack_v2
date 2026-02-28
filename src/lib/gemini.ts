import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      console.warn('⚠️ Empty text provided for embedding generation')
      return new Array(768).fill(0)
    }

    console.log('🤖 Generating embedding for:', text.substring(0, 100))
    
    const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
    const result = await model.embedContent(text)
    
    // ĐÃ SỬA: Lấy mảng gốc (3072 số) và dùng slice cắt đúng 768 số đầu tiên
    const embedding = result.embedding.values.slice(0, 768)

    console.log(`✅ Generated embedding and sliced to ${embedding.length} dimensions`)
    
    return embedding
  } catch (error) {
    console.error('❌ Error generating embedding:', error)
    throw new Error('Failed to generate embedding')
  }
}

export async function generateSkillEmbedding(skills: string[]): Promise<number[]> {
  if (skills.length === 0) {
    return new Array(768).fill(0)
  }

  const text = skills.join(', ')
  return generateEmbedding(text)
}

export interface QuizQuestion {
  question: string
  options: string[]
  correctAnswer: number
}

export async function generateSkillQuiz(skillName: string): Promise<QuizQuestion[]> {
  try {
    console.log(`📝 Generating quiz for skill: ${skillName}`)
    
    // const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
    const prompt = `You are a strict technical skill assessment generator. Generate EXACTLY 5 multiple-choice questions in Vietnamese to verify knowledge of "${skillName}".

CRITICAL REQUIREMENTS:
1. Questions must be medium difficulty - not too easy, not too hard
2. Questions must test practical understanding, not just memorization
3. All options must be plausible (no obviously wrong answers)
4. Questions must be specific to "${skillName}"

OUTPUT FORMAT (MUST BE EXACTLY THIS):
Return ONLY a raw JSON array with NO markdown, NO code blocks, NO greetings, NO explanations. Just the pure JSON array.

[
  {
    "question": "Câu hỏi về ${skillName}?",
    "options": ["Đáp án A", "Đáp án B", "Đáp án C", "Đáp án D"],
    "correctAnswer": 0
  }
]

Generate the 5 questions now. Return ONLY the JSON array, nothing else.`

    const result = await model.generateContent(prompt)
    const response = await result.response
    let text = response.text()

    
    console.log('📄 Raw AI response:', text.substring(0, 200))
    
    // Clean up response - remove markdown code blocks if present
    text = text.replace(/```json/gi, '').replace(/```/gi, '').trim()
    text = text.trim()
    if (text.startsWith('```json')) {
      text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '')
    } else if (text.startsWith('```')) {
      text = text.replace(/```\n?/g, '')
    }
    
    // Find JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      console.error('❌ No JSON array found in response')
      throw new Error('AI did not return valid JSON')
    }
    
    const questions: QuizQuestion[] = JSON.parse(jsonMatch[0])
    
    // Validate structure
    if (!Array.isArray(questions) || questions.length !== 5) {
      throw new Error('AI did not return exactly 5 questions')
    }
    
    for (const q of questions) {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
          typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
        throw new Error('Invalid question format')
      }
    }
    
    console.log(`✅ Generated ${questions.length} valid quiz questions`)
    
    return questions
  } catch (error) {
    console.error('❌ Error generating quiz:', error)
    throw new Error('Failed to generate quiz')
  }
}