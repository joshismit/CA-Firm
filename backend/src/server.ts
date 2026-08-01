import process from 'process';

try {
  process.loadEnvFile();
} catch (e) {
  // Ignore if .env doesn't exist
}

import type { Server } from 'http';
import app from './app';
import { env } from './config/environment';
import { logger } from './config/logger';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';

// Anything that reaches here escaped every try/catch in the app — the process
// is in an unknown state and must not keep serving traffic on it.
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — shutting down');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled promise rejection — shutting down');
  process.exit(1);
});

let server: Server | undefined;

async function startServer(): Promise<void> {
  try {
    // Fail fast on boot rather than accepting traffic against a DB/Redis that
    // isn't actually reachable — Prisma/ioredis would otherwise only surface
    // this on the first real request.
    await connectDatabase();
    await connectRedis();

    const port = env.APP_PORT;
    server = app.listen(port, () => {
      logger.info(`Server is running on port ${port} in ${env.NODE_ENV} mode`);
    });
  } catch (error) {
    logger.fatal({ err: error }, 'Error starting server');
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'Server shutting down');

  // Force-exit if the graceful path hangs (e.g. a slow client holding a
  // keep-alive connection open) — an orchestrator's SIGKILL grace period is
  // finite, better to exit cleanly ourselves first.
  const forceExitTimer = setTimeout(() => {
    logger.warn('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server?.close(() => {
    void Promise.allSettled([disconnectDatabase(), disconnectRedis()]).then(() => {
      clearTimeout(forceExitTimer);
      process.exit(0);
    });
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

void startServer();
