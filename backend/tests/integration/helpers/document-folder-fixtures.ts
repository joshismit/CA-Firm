import { randomUUID } from 'crypto';
import { PrismaClient, TenantStatus, BusinessStatus } from '@prisma/client';

export interface DocumentFolderFixtures {
  tenantId: string;
  userId: string;
  businessId: string;
  /** A second Business in the same tenant — used for cross-Business negative tests. */
  otherBusinessId: string;
  businessTypeId: string;
}

/**
 * Seeds the minimum real rows needed to exercise the Document Folder API's
 * full request lifecycle against a real Postgres database (folders have real
 * FKs to `Business`/`User` — see `prisma/schema.prisma`'s `DocumentFolder`
 * model). Mirrors `tests/integration/helpers/fixtures.ts`'s identical shape.
 */
export async function seedDocumentFolderFixtures(prisma: PrismaClient): Promise<DocumentFolderFixtures> {
  const suffix = randomUUID().slice(0, 8);

  const tenant = await prisma.tenant.create({
    data: {
      slug: `test-folders-${suffix}`,
      name: `Folder Test Tenant ${suffix}`,
      status: TenantStatus.ACTIVE,
    },
  });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `folders.${suffix}@example.test`,
      firstName: 'Folder',
      lastName: 'Tester',
    },
  });

  const businessType = await prisma.businessType.create({
    data: { code: `FOLDER-TYPE-${suffix}`, name: `Folder Test Type ${suffix}` },
  });

  const [business, otherBusiness] = await Promise.all([
    prisma.business.create({
      data: { tenantId: tenant.id, typeId: businessType.id, name: `Folder Test Business ${suffix}`, status: BusinessStatus.ACTIVE },
    }),
    prisma.business.create({
      data: { tenantId: tenant.id, typeId: businessType.id, name: `Other Business ${suffix}`, status: BusinessStatus.ACTIVE },
    }),
  ]);

  return {
    tenantId: tenant.id,
    userId: user.id,
    businessId: business.id,
    otherBusinessId: otherBusiness.id,
    businessTypeId: businessType.id,
  };
}

/** Removes every row created by `seedDocumentFolderFixtures`, in FK-safe order. */
export async function cleanupDocumentFolderFixtures(prisma: PrismaClient, fx: DocumentFolderFixtures): Promise<void> {
  await prisma.document.deleteMany({ where: { tenantId: fx.tenantId } });
  // Null out every self-referencing `parentFolderId` first — `DocumentFolder.parentFolder` is
  // `onDelete: Restrict`, so a single `deleteMany` across a parent/child pair could otherwise
  // violate the FK depending on row-processing order.
  await prisma.documentFolder.updateMany({ where: { tenantId: fx.tenantId }, data: { parentFolderId: null } });
  await prisma.documentFolder.deleteMany({ where: { tenantId: fx.tenantId } });
  await prisma.business.deleteMany({ where: { tenantId: fx.tenantId } });
  await prisma.businessType.delete({ where: { id: fx.businessTypeId } });
  await prisma.user.deleteMany({ where: { tenantId: fx.tenantId } });
  await prisma.tenant.delete({ where: { id: fx.tenantId } });
}
