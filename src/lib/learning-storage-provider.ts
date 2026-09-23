import 'server-only'

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetPublicAccessBlockCommand,
  HeadObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { downloadContentDisposition } from '@/lib/learning-download-disposition'

export type StoredObject = { sizeBytes: number; mimeType: string }
export type UploadCredential = { url: string; fields: Record<string, string>; expiresAt: string }

export interface LearningStorageProvider {
  assertPrivateBucket(): Promise<void>
  signUpload(key: string, mimeType: string, maxBytes: number, expiresAt: Date): Promise<UploadCredential>
  stat(key: string): Promise<StoredObject | null>
  readPrefix(key: string, length: number): Promise<Uint8Array>
  promote(sourceKey: string, destinationKey: string, mimeType: string): Promise<void>
  signDownload(key: string, fileName: string, expiresAt: Date): Promise<string>
  remove(key: string): Promise<void>
}

const UPLOAD_SECONDS = 300
const DOWNLOAD_SECONDS = 600

export function createS3LearningStorageProvider(config: { bucket: string; region: string; client?: S3Client }): LearningStorageProvider {
  if (!config.bucket || !config.region) throw new Error('Learning storage bucket and region are required')
  const client = config.client ?? new S3Client({ region: config.region })
  let privateCheckExpires = 0

  return {
    async assertPrivateBucket() {
      if (privateCheckExpires > Date.now()) return
      const access = await client.send(new GetPublicAccessBlockCommand({ Bucket: config.bucket }))
      const block = access.PublicAccessBlockConfiguration
      if (!block?.BlockPublicAcls || !block.IgnorePublicAcls || !block.BlockPublicPolicy || !block.RestrictPublicBuckets) {
        throw new Error('Learning storage bucket must block all public access')
      }
      privateCheckExpires = Date.now() + 60_000
    },
    async signUpload(key, mimeType, maxBytes, expiresAt) {
      const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      if (seconds < 1 || seconds > UPLOAD_SECONDS) throw new Error('Invalid upload expiry')
      const signed = await createPresignedPost(client, {
        Bucket: config.bucket,
        Key: key,
        Expires: seconds,
        Fields: { 'Content-Type': mimeType },
        Conditions: [
          ['content-length-range', 1, maxBytes],
          ['eq', '$Content-Type', mimeType],
        ],
      })
      return { url: signed.url, fields: signed.fields, expiresAt: expiresAt.toISOString() }
    },
    async stat(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }))
        return { sizeBytes: result.ContentLength ?? -1, mimeType: result.ContentType ?? '' }
      } catch (error) {
        if (error && typeof error === 'object' && 'name' in error && (error.name === 'NotFound' || error.name === 'NoSuchKey')) return null
        throw error
      }
    },
    async readPrefix(key, length) {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: `bytes=0-${length - 1}` }))
      if (!result.Body) throw new Error('Storage object body unavailable')
      return result.Body.transformToByteArray()
    },
    async promote(sourceKey, destinationKey, mimeType) {
      await client.send(new CopyObjectCommand({
        Bucket: config.bucket,
        Key: destinationKey,
        CopySource: `${config.bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
        ContentType: mimeType,
        MetadataDirective: 'REPLACE',
      }))
    },
    async signDownload(key, fileName, expiresAt) {
      const seconds = Math.floor((expiresAt.getTime() - Date.now()) / 1000)
      if (seconds < 1 || seconds > DOWNLOAD_SECONDS) throw new Error('Invalid download expiry')
      return getSignedUrl(client, new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ResponseContentDisposition: downloadContentDisposition(fileName),
        ResponseContentType: 'application/octet-stream',
      }), { expiresIn: seconds })
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }))
    },
  }
}

export function configuredLearningStorageProvider(): LearningStorageProvider {
  let provider: LearningStorageProvider | undefined
  const get = () => provider ??= createS3LearningStorageProvider({ bucket: process.env.LEARNING_STORAGE_BUCKET ?? '', region: process.env.AWS_REGION ?? '' })
  return {
    assertPrivateBucket: () => get().assertPrivateBucket(),
    signUpload: (key, mimeType, maxBytes, expiresAt) => get().signUpload(key, mimeType, maxBytes, expiresAt),
    stat: key => get().stat(key),
    readPrefix: (key, length) => get().readPrefix(key, length),
    promote: (sourceKey, destinationKey, mimeType) => get().promote(sourceKey, destinationKey, mimeType),
    signDownload: (key, fileName, expiresAt) => get().signDownload(key, fileName, expiresAt),
    remove: key => get().remove(key),
  }
}
