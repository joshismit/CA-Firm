import { PrismaClient, Prisma, LeadStage } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * `LeadStage` is tenant-scoped (unlike `BusinessType`) but has no
 * `deletedAt` column (unlike `Lead`) — it is never soft-deleted. Every
 * method that touches `BaseRepository.applyFilters()` must therefore pass
 * `ignoreSoftDelete: true`, mirroring `ContactRoleRepository`'s identical
 * situation for the same reason.
 */
export class LeadStageRepository extends BaseRepository<Prisma.LeadStageDelegate, LeadStage> {
  constructor(prisma: PrismaClient) {
    super(prisma.leadStage, prisma);
  }

  async listAll(options: RepositoryOptions = {}): Promise<LeadStage[]> {
    return this.findMany({}, { ...options, ignoreSoftDelete: true }, undefined, { order: 'asc' });
  }
}
