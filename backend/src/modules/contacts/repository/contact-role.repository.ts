import { PrismaClient, Prisma, ContactRole, ContactRoleType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * `ContactRole` is a pure join table between Contact and Business — it has no
 * `deletedAt`/`deletedBy` columns at all (never soft-deleted). Every method
 * that touches `BaseRepository.applyFilters()` must therefore pass
 * `ignoreSoftDelete: true`, mirroring `BusinessTypeRepository`'s identical
 * situation for the same reason (that model has no deletedAt column either).
 */
export class ContactRoleRepository extends BaseRepository<Prisma.ContactRoleDelegate, ContactRole> {
  constructor(prisma: PrismaClient) {
    super(prisma.contactRole, prisma);
  }

  async findByContact(contactId: string, options: RepositoryOptions = {}): Promise<ContactRole[]> {
    return this.findMany(
      { contactId },
      { ...options, ignoreSoftDelete: true },
      undefined,
      { createdAt: 'desc' },
    );
  }

  async findExisting(
    businessId: string,
    contactId: string,
    roleType: ContactRoleType,
    options: RepositoryOptions = {},
  ): Promise<ContactRole | null> {
    return this.findFirst({ businessId, contactId, roleType }, { ...options, ignoreSoftDelete: true });
  }

  /** Clears isPrimary on every other role for this business, before a new primary is set. */
  async clearPrimaryForBusiness(businessId: string, options: RepositoryOptions = {}): Promise<void> {
    const where = this.applyFilters({ businessId, isPrimary: true }, { ...options, ignoreSoftDelete: true });
    const client = this.getClient(options.tx);
    await client.updateMany({ where, data: { isPrimary: false } });
  }
}
