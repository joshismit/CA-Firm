/**
 * `@config/storage` is stubbed so this test controls `bucketName`/
 * `presignedUrlExpirySeconds` directly, rather than depending on whatever
 * AWS_* env vars happen to be set (there are none in this dev/test
 * environment — see `config/storage.ts`'s optional env vars). The real S3
 * client is never touched either way: `S3StorageService` takes its client
 * via constructor injection, and the test passes a hand-built fake below.
 */
jest.mock('@config/storage', () => ({
  storageConfig: { bucketName: 'test-bucket', presignedUrlExpirySeconds: 3600 },
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { S3StorageService } from '@storage/s3-storage.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * S3StorageService — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Exercises the real `upload()`/`getDownloadUrl()` logic against a hand-built
 * fake S3 client (constructor-injected) — proves the correct AWS SDK commands
 * are issued with the correct bucket/key/body, never touching a real bucket.
 * `modules/documents` is the only consumer today.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function createFakeClient() {
  return { send: jest.fn() } as unknown as S3Client & { send: jest.Mock };
}

describe('S3StorageService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('upload', () => {
    it('sends a PutObjectCommand with the configured bucket, key, body, and content type', async () => {
      const client = createFakeClient();
      client.send.mockResolvedValue({});
      const service = new S3StorageService(client);
      const body = Buffer.from('file-contents');

      await service.upload('tenant-1/abc-file.pdf', body, 'application/pdf');

      expect(client.send).toHaveBeenCalledTimes(1);
      const command = client.send.mock.calls[0][0] as PutObjectCommand;
      expect(command).toBeInstanceOf(PutObjectCommand);
      expect(command.input).toEqual({
        Bucket: 'test-bucket',
        Key: 'tenant-1/abc-file.pdf',
        Body: body,
        ContentType: 'application/pdf',
      });
    });

    it('propagates errors from the client instead of swallowing them', async () => {
      const client = createFakeClient();
      const error = new Error('S3 unreachable');
      client.send.mockRejectedValue(error);
      const service = new S3StorageService(client);

      await expect(service.upload('tenant-1/abc-file.pdf', Buffer.from('x'), 'application/pdf')).rejects.toThrow(error);
    });
  });

  describe('getDownloadUrl', () => {
    it('builds a GetObjectCommand for the configured bucket/key and requests a presigned URL with the configured expiry', async () => {
      const client = createFakeClient();
      (getSignedUrl as jest.Mock).mockResolvedValue('https://bucket.example.test/signed-url');
      const service = new S3StorageService(client);

      const url = await service.getDownloadUrl('tenant-1/abc-file.pdf');

      expect(getSignedUrl).toHaveBeenCalledTimes(1);
      const [passedClient, command, options] = (getSignedUrl as jest.Mock).mock.calls[0];
      expect(passedClient).toBe(client);
      expect(command).toBeInstanceOf(GetObjectCommand);
      expect(command.input).toEqual({ Bucket: 'test-bucket', Key: 'tenant-1/abc-file.pdf' });
      expect(options).toEqual({ expiresIn: 3600 });
      expect(url).toBe('https://bucket.example.test/signed-url');
    });
  });
});
