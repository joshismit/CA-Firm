import { PrismaClient, Prisma, LeadNote } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * `LeadNote` has no `deletedAt`/`deletedBy` columns (never soft-deleted, same
 * situation as `ContactRole`/`BusinessAssignment` — see those repositories'
 * header comments), so every method here passes `ignoreSoftDelete: true`.
 */
export class LeadNoteRepository extends BaseRepository<Prisma.LeadNoteDelegate, LeadNote> {
  constructor(prisma: PrismaClient) {
    super(prisma.leadNote, prisma);
  }

  /** Chronological CRM notes (PRD §8.6) — newest first. */
  async findByLead(leadId: string, options: RepositoryOptions = {}): Promise<LeadNote[]> {
    return this.findMany({ leadId }, { ...options, ignoreSoftDelete: true }, undefined, { createdAt: 'desc' });
  }

  /** Used to derive `Lead`'s "Last Contacted Date" (PRD §8.4) without a duplicated column. */
  async findMostRecentByLead(leadId: string, options: RepositoryOptions = {}): Promise<LeadNote | null> {
    return this.findFirst({ leadId }, { ...options, ignoreSoftDelete: true }, undefined, { createdAt: 'desc' });
  }
}
