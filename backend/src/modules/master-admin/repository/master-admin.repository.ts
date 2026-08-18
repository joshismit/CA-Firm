import { PrismaClient, MasterAdmin } from '@prisma/client';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Admin Repository
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Data access for the `MasterAdmin` login lifecycle. Deliberately NOT a
 * `BaseRepository<TDelegate, TEntity>` subclass — `MasterAdmin` has no
 * `tenantId` column at all (it's cross-tenant by definition) and no soft
 * delete, so `BaseRepository`'s tenant/soft-delete scoping doesn't apply.
 * Mirrors the same "bespoke repository when the shape doesn't fit
 * BaseRepository" precedent as `modules/auth/repository/auth.repository.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export class MasterAdminRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<MasterAdmin | null> {
    return this.prisma.masterAdmin.findUnique({ where: { email } });
  }

  async recordLogin(id: string): Promise<void> {
    await this.prisma.masterAdmin.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }
}
