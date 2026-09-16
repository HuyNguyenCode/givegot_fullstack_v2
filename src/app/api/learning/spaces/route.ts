import { createLearningSpaceCollectionHandlers } from '@/lib/learning-space-route-handlers'
import { learningSpaceService } from '@/lib/learning-space-service'
export const { POST } = createLearningSpaceCollectionHandlers(learningSpaceService)
