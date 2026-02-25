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