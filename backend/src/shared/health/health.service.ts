import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { prisma } from '@config/database';
import { redis } from '@config/redis';
import { mailTransport } from '@config/mail';
import { s3Client, storageConfig } from '@config/storage';
import { env } from '@config/environment';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Health / Readiness Service
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Backs the two cross-cutting endpoints mounted directly in `app.ts` (not a
 * feature module — no tenant/user scoping applies here, so it doesn't fit
 * `BaseService`).
 *
 *   GET /health — liveness. Always 200 if the process can respond at all.
 *   GET /ready  — readiness. Exercises every external dependency the app
 *                 actually needs to serve real traffic; 503 if any is down.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const CHECK_TIMEOUT_MS = 3000;

type ComponentStatus = 'ok' | 'error' | 'skipped';

export interface ComponentResult {
  status: ComponentStatus;
  message?: string;
  latencyMs?: number;
}

export interface ReadinessResult {
  ready: boolean;
  checks: Record<'database' | 'redis' | 'smtp' | 'storage', ComponentResult>;
}

export interface LivenessResult {
  status: 'ok';
  version: string;
  commitSha: string | null;
  uptimeSeconds: number;
  timestamp: string;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
      timer.unref();
    }),
  ]);
}

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'unknown error';
}

async function timedCheck(check: () => Promise<unknown>): Promise<ComponentResult> {
  const start = Date.now();
  try {
    await withTimeout(check(), CHECK_TIMEOUT_MS);
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return { status: 'error', message: toErrorMessage(err) };
  }
}

async function checkDatabase(): Promise<ComponentResult> {
  return timedCheck(() => prisma.$queryRaw`SELECT 1`);
}

async function checkRedis(): Promise<ComponentResult> {
  return timedCheck(() => redis.ping());
}

async function checkSmtp(): Promise<ComponentResult> {
  return timedCheck(() => mailTransport.verify());
}

async function checkStorage(): Promise<ComponentResult> {
  if (storageConfig.provider === 'local' || !storageConfig.bucketName) {
    return { status: 'skipped', message: 'STORAGE_PROVIDER is "local" or AWS_BUCKET_NAME is not set' };
  }
  return timedCheck(() => s3Client.send(new HeadBucketCommand({ Bucket: storageConfig.bucketName })));
}

export function getLiveness(): LivenessResult {
  return {
    status: 'ok',
    version: env.APP_VERSION,
    commitSha: env.COMMIT_SHA ?? null,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export async function getReadiness(): Promise<ReadinessResult> {
  const [database, redisResult, smtp, storage] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkSmtp(),
    checkStorage(),
  ]);
  const checks: ReadinessResult['checks'] = { database, redis: redisResult, smtp, storage };
  const ready = Object.values(checks).every((c) => c.status !== 'error');
  return { ready, checks };
}
