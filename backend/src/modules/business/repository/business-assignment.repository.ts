import { PrismaClient, Prisma, BusinessAssignment } from '@prisma/client';
import { BaseRepository } from '@shared/base/base.repository';

/**
 * Data access for the `BusinessAssignment` junction model — which staff
 * `User`s are assigned to which `Business`es. `BusinessAssignment` has no
 * `deletedAt` column (never soft-deleted, same situation as `ContactRole` —
 * see `ContactRoleRepository`'s header comment), so every method here passes
 * `ignoreSoftDelete: true`.
 *
 * Consumed by `DocumentAccessScopeService`
 * (`modules/documents/service/document-access-scope.service.ts`) to scope an
 * Accountant's document access to only their assigned Businesses.
 */
export class BusinessAssignmentRepository extends BaseRepository<Prisma.BusinessAssignmentDelegate, BusinessAssignment> {
  constructor(prisma: PrismaClient) {
    super(prisma.businessAssignment, prisma);
  }

  async findBusinessIdsForUser(userId: string, tenantId: string): Promise<string[]> {
    const assignments = await this.findMany({ userId }, { tenantId, ignoreSoftDelete: true });
    return assignments.map((assignment) => assignment.businessId);
  }
}
