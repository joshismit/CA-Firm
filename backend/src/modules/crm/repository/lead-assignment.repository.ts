import { PrismaClient, Prisma, LeadAssignment } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * Data access for the `LeadAssignment` junction model — which staff `User`s
 * are assigned to which pre-conversion `Lead`s (PRD §8.5). Mirrors
 * `BusinessAssignmentRepository` exactly; the CRM equivalent used once a lead
 * has no `businessId` yet to assign staff against via `BusinessAssignment`.
 *
 * `LeadAssignment` has no `deletedAt` column (never soft-deleted, same
 * situation as `ContactRole`/`BusinessAssignment`), so every method here
 * passes `ignoreSoftDelete: true`. "Unassign" is a real row deletion via
 * `forceDelete()` — there is no history value in keeping a removed
 * assignment row around, matching how `BusinessAssignment` would behave if
 * it had an unassign endpoint.
 */
export class LeadAssignmentRepository extends BaseRepository<Prisma.LeadAssignmentDelegate, LeadAssignment> {
  constructor(prisma: PrismaClient) {
    super(prisma.leadAssignment, prisma);
  }

  async findByLead(leadId: string, options: RepositoryOptions = {}): Promise<LeadAssignment[]> {
    return this.findMany({ leadId }, { ...options, ignoreSoftDelete: true }, undefined, { assignedAt: 'desc' });
  }

  async findExisting(leadId: string, userId: string, options: RepositoryOptions = {}): Promise<LeadAssignment | null> {
    return this.findFirst({ leadId, userId }, { ...options, ignoreSoftDelete: true });
  }

  /** Clears `isPrimary` on every other assignment for this lead, before a new "lead owner" is set. Mirrors `ContactRoleRepository.clearPrimaryForBusiness()`. */
  async clearPrimaryForLead(leadId: string, options: RepositoryOptions = {}): Promise<void> {
    const where = this.applyFilters({ leadId, isPrimary: true }, { ...options, ignoreSoftDelete: true });
    const client = this.getClient(options.tx);
    await client.updateMany({ where, data: { isPrimary: false } });
  }
}
