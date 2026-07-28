import { PrismaClient, Prisma, Client } from '@prisma/client';
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
}
