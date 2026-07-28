import { PrismaClient, Prisma, LeadConversion } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * `LeadConversion` is tenant-scoped but has no `deletedAt` column — it is
 * never soft-deleted (a conversion, once recorded, is permanent history).
 * `findByLead()` therefore passes `ignoreSoftDelete: true`, mirroring
 * `LeadStageRepository`/`ContactRoleRepository`'s identical situation.
 */
export class LeadConversionRepository extends BaseRepository<Prisma.LeadConversionDelegate, LeadConversion> {
  constructor(prisma: PrismaClient) {
    super(prisma.leadConversion, prisma);
  }

  async findByLead(leadId: string, options: RepositoryOptions = {}): Promise<LeadConversion | null> {
    return this.findFirst({ leadId }, { ...options, ignoreSoftDelete: true });
  }
}
