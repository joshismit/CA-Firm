import { S3Client } from '@aws-sdk/client-s3';
import { env } from './environment';

/**
 * AWS S3 / Cloudflare R2 Client.
 * R2 is S3-compatible — switch via STORAGE_PROVIDER and AWS_ENDPOINT_URL env vars.
 */
export const s3Client = new S3Client({
  region: env.AWS_REGION || 'auto',
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      }
      : undefined,
  ...(env.AWS_ENDPOINT_URL ? { endpoint: env.AWS_ENDPOINT_URL } : {}),
});

export const storageConfig = {
  provider: env.STORAGE_PROVIDER,
  bucketName: env.AWS_BUCKET_NAME || '',
  region: env.AWS_REGION || 'auto',

  // Upload constraints
  maxFileSizeMB: 50,
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ],

  // Signed URL expiry for downloads
  presignedUrlExpirySeconds: 60 * 60, // 1 hour
} as const;
