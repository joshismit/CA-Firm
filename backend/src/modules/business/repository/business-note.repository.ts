import { PrismaClient, Prisma, BusinessNote } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * Data access for `BusinessNote` — exact mirror of
 * `modules/crm/repository/lead-note.repository.ts`'s `LeadNoteRepository`,
 * scoped to `businessId` instead of `leadId` (PRD §8.6). `BusinessNote` has no
 * `deletedAt` column (never soft-deleted, same as `LeadNote`), so every
 * method here passes `ignoreSoftDelete: true`.
 */
export class BusinessNoteRepository extends BaseRepository<Prisma.BusinessNoteDelegate, BusinessNote> {
  constructor(prisma: PrismaClient) {
    super(prisma.businessNote, prisma);
  }

  async findByBusiness(businessId: string, options: RepositoryOptions = {}): Promise<BusinessNote[]> {
    return this.findMany({ businessId }, { ...options, ignoreSoftDelete: true }, undefined, { createdAt: 'desc' });
  }
}
