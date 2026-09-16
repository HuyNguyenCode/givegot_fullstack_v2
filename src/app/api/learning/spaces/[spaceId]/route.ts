import { createLearningSpaceHandlers } from '@/lib/learning-space-route-handlers'
import { learningSpaceService } from '@/lib/learning-space-service'
export const { GET, PATCH } = createLearningSpaceHandlers(learningSpaceService)
