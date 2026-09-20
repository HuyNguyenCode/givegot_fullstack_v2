import { createLearningFileHandlers } from '@/lib/learning-storage-route-handlers'
import { learningStorageService } from '@/lib/learning-storage-runtime'

export const { DELETE } = createLearningFileHandlers(learningStorageService())
