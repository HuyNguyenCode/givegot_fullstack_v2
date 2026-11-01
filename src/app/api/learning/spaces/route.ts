import { createLearningSpaceCollectionHandlers } from '@/lib/learning-space-route-handlers'
import { learningSpaceService } from '@/lib/learning-space-service'
import { listMySpaces } from '@/lib/learning-space-listing'
import { createSpaceListingHandler } from '@/lib/learning-space-listing-handler'

export const { POST } = createLearningSpaceCollectionHandlers(learningSpaceService)
export const GET = createSpaceListingHandler(listMySpaces)
