import { PrismaClient } from '@prisma/client';
import { env } from './environment';

/**
 * Prisma Client Singleton.
 * Never instantiate PrismaClient outside this file.
 * All modules import this instance via: import { prisma } from '@config/database'
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'pretty',
  });

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
