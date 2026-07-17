import { Queue } from 'bullmq';
import { redis } from './redis';
import { env } from './environment';

/**
 * BullMQ connection options.
 * Reuses the IORedis singleton connection.
 */
const connection = redis;

/**
 * Queue Names — centralized to avoid magic strings.
 */
export const QUEUE_NAMES = {
  EMAIL: 'email',
  NOTIFICATION: 'notification',
  REPORT: 'report',
  AUDIT: 'audit',
  DOCUMENT_PROCESSING: 'document-processing',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/**
 * BullMQ Queue instances.
 * Workers connect to these queues from workers/index.ts
 */
export const emailQueue = new Queue(QUEUE_NAMES.EMAIL, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 200 },
    removeOnFail: { count: 500 },
  },
});

export const reportQueue = new Queue(QUEUE_NAMES.REPORT, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 10000 },
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
});

export const auditQueue = new Queue(QUEUE_NAMES.AUDIT, {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

export const documentProcessingQueue = new Queue(QUEUE_NAMES.DOCUMENT_PROCESSING, {
  connection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 15000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
});
