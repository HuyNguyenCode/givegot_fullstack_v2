import { createLearningTopicHandlers } from '@/lib/learning-space-route-handlers'
import { learningSpaceService } from '@/lib/learning-space-service'
export const { PATCH } = createLearningTopicHandlers(learningSpaceService)
