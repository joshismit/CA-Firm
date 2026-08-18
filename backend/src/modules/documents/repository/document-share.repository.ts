import { PrismaClient, Prisma, ResourceAccessPolicy, ResourceAccessLevel } from '@prisma/client';
import { BaseRepository } from '@shared/base/base.repository';

/** The `ResourceAccessPolicy.resourceType` value document shares are stored under. */
export const DOCUMENT_RESOURCE_TYPE = 'Document';

export interface UpsertDocumentShareInput {
  tenantId: string;
  documentId: string;
  sharedWithUserId: string;
  grantedById: string;
  expiresAt?: Date | null;
}

/**
 * Data access for document-sharing grants. Reuses the existing, previously
 * dormant `ResourceAccessPolicy` model (a generic per-resource per-user
 * grant table — see its schema comment) instead of introducing a new
 * `DocumentShare` model, keyed by `resourceType: 'Document'`.
 */
export class DocumentShareRepository extends BaseRepository<Prisma.ResourceAccessPolicyDelegate, ResourceAccessPolicy> {
  constructor(prisma: PrismaClient) {
    super(prisma.resourceAccessPolicy, prisma);
  }

  /** Re-sharing the same document with the same user updates the existing grant (`@@unique([tenantId, userId, resourceType, resourceId])`) rather than erroring. */
  async upsertShare(input: UpsertDocumentShareInput): Promise<ResourceAccessPolicy> {
    return this.prisma.resourceAccessPolicy.upsert({
      where: {
        uq_resource_policy: {
          tenantId: input.tenantId,
          userId: input.sharedWithUserId,
          resourceType: DOCUMENT_RESOURCE_TYPE,
          resourceId: input.documentId,
        },
      },
      update: {
        accessLevel: ResourceAccessLevel.READ,
        grantedById: input.grantedById,
        expiresAt: input.expiresAt ?? null,
      },
      create: {
        tenantId: input.tenantId,
        userId: input.sharedWithUserId,
        resourceType: DOCUMENT_RESOURCE_TYPE,
        resourceId: input.documentId,
        accessLevel: ResourceAccessLevel.READ,
        grantedById: input.grantedById,
        expiresAt: input.expiresAt ?? null,
      },
    });
  }

  /** Deletes a specific share grant, if one exists. Returns whether a row was actually removed (vs. never having been shared). */
  async revokeShare(tenantId: string, documentId: string, sharedWithUserId: string): Promise<boolean> {
    const result = await this.prisma.resourceAccessPolicy.deleteMany({
      where: { tenantId, userId: sharedWithUserId, resourceType: DOCUMENT_RESOURCE_TYPE, resourceId: documentId },
    });
    return result.count > 0;
  }

  /** Document IDs explicitly shared with this user, excluding expired grants — consumed by `DocumentAccessScopeService`. */
  async findSharedDocumentIds(userId: string, tenantId: string): Promise<string[]> {
    const grants = await this.prisma.resourceAccessPolicy.findMany({
      where: {
        tenantId,
        userId,
        resourceType: DOCUMENT_RESOURCE_TYPE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { resourceId: true },
    });

    return grants.map((grant) => grant.resourceId);
  }
}
