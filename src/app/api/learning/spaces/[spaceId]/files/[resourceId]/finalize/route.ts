import { createLearningFileFinalizeHandlers } from '@/lib/learning-storage-route-handlers'
import { learningStorageService } from '@/lib/learning-storage-runtime'

export const { POST } = createLearningFileFinalizeHandlers(learningStorageService())
