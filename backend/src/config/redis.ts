import Redis from 'ioredis';
import { env } from './environment';
import { logger } from './logger';

/**
 * IORedis Client Singleton.
 * Used for: caching, rate limiting, session management, BullMQ connection.
 */

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null, // Required for BullMQ
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  reconnectOnError(err) {
    const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
    if (targetErrors.some((e) => err.message.includes(e))) {
      return true;
    }
    return false;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('ready', () => {
  logger.info('Redis ready');
});

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error');
});

redis.on('close', () => {
  logger.warn('Redis connection closed');
});

redis.on('reconnecting', () => {
  logger.info('Redis reconnecting...');
});

/**
 * Connect to Redis. Called during server startup.
 */
export async function connectRedis(): Promise<void> {
  await redis.connect();
}

/**
 * Disconnect from Redis. Called during graceful shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  await redis.quit();
}
