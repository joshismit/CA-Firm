import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, storageConfig } from '@config/storage';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * S3 Storage Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Thin wrapper around the real `s3Client`/`storageConfig` from
 * `@config/storage` (already-configured S3/R2 client — see that file's
 * comment on switching providers via `STORAGE_PROVIDER`). Generic and
 * module-agnostic by design (hence `src/storage`, matching the pre-existing
 * `@storage/*` path alias in tsconfig/jest that nothing used until now) —
 * any module needing object storage should depend on this, not talk to
 * `S3Client` directly.
 *
 * Deliberately just two operations: `upload()` and `getDownloadUrl()`. No
 * `delete()` — `modules/documents` only ever soft-deletes the metadata row,
 * never the underlying object (mirrors `Lead`'s "no restore endpoint" stance:
 * out of scope until an actual retention/purge workflow is designed).
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class S3StorageService {
  constructor(private readonly client: S3Client = s3Client) {}

  /** Uploads a file buffer to the configured bucket under `key`. */
  async upload(key: string, body: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: storageConfig.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  /**
   * Returns a time-limited presigned GET URL for downloading `key`. When
   * `downloadFileName` is given, sets `ResponseContentDisposition` so the
   * browser saves the file under its original name (PRD §7.2 — "keep the
   * original filename for download display") rather than the opaque
   * internal `key`, without ever renaming the object in the bucket itself.
   */
  async getDownloadUrl(key: string, downloadFileName?: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: storageConfig.bucketName,
      Key: key,
      ResponseContentDisposition: downloadFileName ? buildContentDisposition(downloadFileName) : undefined,
    });
    return getSignedUrl(this.client, command, { expiresIn: storageConfig.presignedUrlExpirySeconds });
  }
}

/**
 * RFC 6266/5987 `Content-Disposition` value: an ASCII-safe `filename` fallback
 * plus a `filename*` UTF-8 form, so names with non-ASCII characters (e.g. "ग्राहक.pdf")
 * still download correctly in modern browsers instead of being mangled or rejected.
 */
function buildContentDisposition(fileName: string): string {
  const asciiFallback = fileName.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
