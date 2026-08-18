import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './environment';

/**
 * Prisma Client Singleton — Prisma v7 adapter pattern.
 *
 * In Prisma v7 the connection URL is no longer read from schema.prisma.
 * Instead, a driver adapter is passed directly to PrismaClient.
 * @see https://pris.ly/d/prisma7-client-config
 *
 * Never instantiate PrismaClient outside this file.
 * All modules import this instance via: import { prisma } from '@config/database'
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

  return new PrismaClient({
    adapter,
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'pretty',
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to the database.
 * Called during server startup.
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
}

/**
 * Disconnect from the database.
 * Called during graceful shutdown.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
