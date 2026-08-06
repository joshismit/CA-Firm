import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedPermissions } from './permissions.seed';
import { seedBusinessTypes } from './business-type.seed';
import { seedMasterAdmin } from './master-admin.seed';
import { seedPlans } from './plan.seed';
import { seedNotificationTemplates } from './notification-templates.seed';

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
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, errorFormat: 'pretty' });

async function main(): Promise<void> {
  console.log('Seeding permissions...');
  await seedPermissions(prisma);
  console.log('Permissions seeded successfully.');

  console.log('Seeding business types...');
  await seedBusinessTypes(prisma);
  console.log('Business types seeded successfully.');

  console.log('Seeding master admin...');
  await seedMasterAdmin(prisma);
  console.log('Master admin seeded successfully.');

  console.log('Seeding plans...');
  await seedPlans(prisma);
  console.log('Plans seeded successfully.');

  console.log('Seeding notification templates...');
  await seedNotificationTemplates(prisma);
  console.log('Notification templates seeded successfully.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
