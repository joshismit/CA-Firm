import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './permissions.seed';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Database Seed Entry Point
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Invoked by:
 *   npm run prisma:seed   → "prisma:seed": "ts-node prisma/seeds/index.ts" (package.json)
 *   npx prisma db seed    → migrations.seed (prisma.config.ts)
 *
 * Add future seed modules by importing and calling them here, in dependency
 * order (e.g. permissions before roles, roles before role-permission grants).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const prisma = new PrismaClient({ errorFormat: 'pretty' });

async function main(): Promise<void> {
  console.log('Seeding permissions...');
  await seedPermissions(prisma);
  console.log('Permissions seeded successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
