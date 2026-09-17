import { createLearningInviteHandlers } from '@/lib/learning-invite-route-handlers'
import { learningInviteService } from '@/lib/learning-invite-service'

export const { PATCH } = createLearningInviteHandlers(learningInviteService)
