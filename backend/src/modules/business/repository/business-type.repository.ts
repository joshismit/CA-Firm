import { PrismaClient, Prisma, BusinessType } from '@prisma/client';
import { BaseRepository, RepositoryOptions } from '@shared/base/base.repository';

/**
 * `BusinessType` is a shared reference table — it has no `tenantId` column
 * (every tenant sees the same type catalog) and no `deletedAt` column (it is
 * never soft-deleted). Every call here therefore passes both
 * `ignoreTenant: true` and `ignoreSoftDelete: true`; without them,
 * `BaseRepository.applyFilters()` would try to filter on columns this model
 * doesn't have and Prisma would reject the query.
 */
export class BusinessTypeRepository extends BaseRepository<Prisma.BusinessTypeDelegate, BusinessType> {
  constructor(prisma: PrismaClient) {
    super(prisma.businessType, prisma);
  }

  async listActive(options: RepositoryOptions = {}): Promise<BusinessType[]> {
    return this.findMany(
      { isActive: true },
      { ...options, ignoreTenant: true, ignoreSoftDelete: true },
      undefined,
      { name: 'asc' },
    );
  }
}
