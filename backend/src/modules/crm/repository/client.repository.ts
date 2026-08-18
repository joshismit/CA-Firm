import { PrismaClient, Prisma, Client, ClientStatus } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * Minimal repository for what Lead conversion needs from `Client` — find the
 * existing client for a business (at most one: `Client.businessId` is
 * `@unique`), or create one. No standalone Clients module exists yet in this
 * codebase (Client management is out of scope for this phase); this
 * repository is scoped to `modules/crm` deliberately, as an implementation
 * detail of conversion, not a general-purpose Client API. `Client` does have
 * `deletedAt` (standard soft-delete filtering applies normally, unlike
 * `LeadStage`/`ContactRole`/`LeadConversion`).
 */
export class ClientRepository extends BaseRepository<Prisma.ClientDelegate, Client> {
  constructor(prisma: PrismaClient) {
    super(prisma.client, prisma);
  }

  async findByBusiness(businessId: string, options: RepositoryOptions = {}): Promise<Client | null> {
    return this.findFirst({ businessId }, options);
  }

  /**
   * PRD §10.5/§10.11 — dashboard "Assigned Clients" widget: resolves the Clients for a
   * staff member's assigned Businesses (`BusinessAssignmentRepository.findBusinessIdsForUser()`).
   * An empty `businessIds` array (unassigned staff) deliberately returns `[]` rather than
   * falling through to an unscoped `{ in: [] }` no-op that would return every tenant Client.
   */
  async findByBusinessIds(
    businessIds: string[],
    options: RepositoryOptions = {},
    include?: Prisma.ClientInclude,
  ): Promise<Client[]> {
    if (businessIds.length === 0) return [];
    return this.findMany({ businessId: { in: businessIds } }, options, include);
  }

  /**
   * PRD §8.10 — CRM dashboard counts. `statuses` lets the caller distinguish
   * "converted" (ACTIVE/INACTIVE/SUSPENDED) from "archived" (FORMER, per the
   * decision to reuse `Client.status` rather than add a separate flag) with
   * one query shape instead of two near-identical methods.
   */
  async countByStatus(statuses: ClientStatus[], options: RepositoryOptions = {}): Promise<number> {
    return this.count({ status: { in: statuses } }, options);
  }
}
