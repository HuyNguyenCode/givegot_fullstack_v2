import 'server-only'

import { configuredLearningStorageProvider } from '@/lib/learning-storage-provider'
import { createLearningStorageService, learningStorageRepository } from '@/lib/learning-storage-service'
import { requireAuthenticatedUser } from '@/lib/server-authorization'

export function learningStorageService() {
  return createLearningStorageService({ repository: learningStorageRepository, provider: configuredLearningStorageProvider(), authenticatedUser: requireAuthenticatedUser })
}
