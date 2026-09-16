import { createLearningTopicCollectionHandlers } from '@/lib/learning-space-route-handlers'
import { learningSpaceService } from '@/lib/learning-space-service'
export const { POST } = createLearningTopicCollectionHandlers(learningSpaceService)
