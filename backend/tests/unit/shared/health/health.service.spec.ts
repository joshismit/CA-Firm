jest.mock('@config/database', () => ({ prisma: { $queryRaw: jest.fn() } }));
jest.mock('@config/redis', () => ({ redis: { ping: jest.fn() } }));
jest.mock('@config/mail', () => ({ mailTransport: { verify: jest.fn() } }));
jest.mock('@config/storage', () => ({
  s3Client: { send: jest.fn() },
  storageConfig: { provider: 'local', bucketName: '' },
}));

import { prisma } from '@config/database';
import { redis } from '@config/redis';
import { mailTransport } from '@config/mail';
import { s3Client, storageConfig } from '@config/storage';
import { getLiveness, getReadiness } from '@shared/health/health.service';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Health / Readiness Service — Unit Tests
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every external dependency (Prisma, Redis, Nodemailer transport, S3 client)
 * is fully mocked — exercises only this service's aggregation/timeout logic,
 * never a real database or network call. Real connectivity is covered by
 * `tests/integration/health.routes.spec.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const mockedPrisma = prisma as unknown as { $queryRaw: jest.Mock };
const mockedRedis = redis as unknown as { ping: jest.Mock };
const mockedMail = mailTransport as unknown as { verify: jest.Mock };
const mockedS3 = s3Client as unknown as { send: jest.Mock };
const mockedStorageConfig = storageConfig as unknown as { provider: string; bucketName: string };

describe('health.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedStorageConfig.provider = 'local';
    mockedStorageConfig.bucketName = '';
  });

  describe('getLiveness', () => {
    it('reports status ok, the configured version, and a null commitSha when unset', () => {
      const result = getLiveness();

      expect(result.status).toBe('ok');
      expect(result.version).toBe('1.0.0'); // envSchema default — .env sets neither APP_VERSION nor COMMIT_SHA
      expect(result.commitSha).toBeNull();
      expect(typeof result.uptimeSeconds).toBe('number');
      expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
      expect(() => new Date(result.timestamp).toISOString()).not.toThrow();
    });
  });

  describe('getReadiness', () => {
    it('reports ready:true when every component check succeeds', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockedRedis.ping.mockResolvedValue('PONG');
      mockedMail.verify.mockResolvedValue(true);
      mockedStorageConfig.provider = 's3';
      mockedStorageConfig.bucketName = 'test-bucket';
      mockedS3.send.mockResolvedValue({});

      const result = await getReadiness();

      expect(result.ready).toBe(true);
      expect(result.checks.database.status).toBe('ok');
      expect(result.checks.redis.status).toBe('ok');
      expect(result.checks.smtp.status).toBe('ok');
      expect(result.checks.storage.status).toBe('ok');
    });

    it('reports ready:false when the database check fails, without masking the other components', async () => {
      mockedPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      mockedRedis.ping.mockResolvedValue('PONG');
      mockedMail.verify.mockResolvedValue(true);

      const result = await getReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.database).toMatchObject({ status: 'error', message: 'connection refused' });
      expect(result.checks.redis.status).toBe('ok');
      expect(result.checks.smtp.status).toBe('ok');
    });

    it('reports ready:false when Redis fails', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockedRedis.ping.mockRejectedValue(new Error('ECONNREFUSED'));
      mockedMail.verify.mockResolvedValue(true);

      const result = await getReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.redis).toMatchObject({ status: 'error', message: 'ECONNREFUSED' });
    });

    it('reports ready:false when the SMTP transport fails to verify', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockedRedis.ping.mockResolvedValue('PONG');
      mockedMail.verify.mockRejectedValue(new Error('SMTP connection timeout'));

      const result = await getReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.smtp).toMatchObject({ status: 'error', message: 'SMTP connection timeout' });
    });

    it('skips the storage check (does not affect readiness) when STORAGE_PROVIDER is local', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockedRedis.ping.mockResolvedValue('PONG');
      mockedMail.verify.mockResolvedValue(true);
      mockedStorageConfig.provider = 'local';

      const result = await getReadiness();

      expect(result.ready).toBe(true);
      expect(result.checks.storage.status).toBe('skipped');
      expect(mockedS3.send).not.toHaveBeenCalled();
    });

    it('reports ready:false when object storage is configured but unreachable', async () => {
      mockedPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockedRedis.ping.mockResolvedValue('PONG');
      mockedMail.verify.mockResolvedValue(true);
      mockedStorageConfig.provider = 's3';
      mockedStorageConfig.bucketName = 'test-bucket';
      mockedS3.send.mockRejectedValue(new Error('NoSuchBucket'));

      const result = await getReadiness();

      expect(result.ready).toBe(false);
      expect(result.checks.storage).toMatchObject({ status: 'error', message: 'NoSuchBucket' });
    });

    it('runs all four checks concurrently, not sequentially', async () => {
      const order: string[] = [];
      mockedPrisma.$queryRaw.mockImplementation(async () => {
        order.push('database-start');
        await new Promise((r) => setTimeout(r, 10));
        order.push('database-end');
        return [];
      });
      mockedRedis.ping.mockImplementation(async () => {
        order.push('redis');
        return 'PONG';
      });
      mockedMail.verify.mockImplementation(async () => {
        order.push('smtp');
        return true;
      });

      await getReadiness();

      // If checks ran sequentially, redis/smtp would only start after database-end.
      expect(order.indexOf('redis')).toBeLessThan(order.indexOf('database-end'));
      expect(order.indexOf('smtp')).toBeLessThan(order.indexOf('database-end'));
    });
  });
});
