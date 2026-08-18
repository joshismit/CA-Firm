import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin Seed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Creates (or updates the password of) the single initial platform-admin
 * account from `MASTER_ADMIN_EMAIL`/`MASTER_ADMIN_PASSWORD` (.env) — there is
 * no signup flow for `MasterAdmin` by design (see its header comment in
 * schema.prisma), so this seed is the only way one gets created.
 *
 * Both env vars are optional (see `config/environment.ts`) so that running
 * the seed orchestrator in an environment that doesn't need a master admin
 * (e.g. a fresh CI database only exercising tenant-scoped tests) doesn't fail
 * — it just skips this step with a warning.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const BCRYPT_ROUNDS = 12;

export async function seedMasterAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.MASTER_ADMIN_EMAIL;
  const password = process.env.MASTER_ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn('Skipping master admin seed: MASTER_ADMIN_EMAIL/MASTER_ADMIN_PASSWORD not set in .env');
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await prisma.masterAdmin.upsert({
    where: { email },
    update: { passwordHash },
    create: {
      email,
      passwordHash,
      firstName: 'Master',
      lastName: 'Admin',
    },
  });
}
