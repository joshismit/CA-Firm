import { randomUUID } from 'crypto';
import { PrismaClient, TenantStatus, BusinessStatus, DocumentCategory, RoleType, ContactRoleType } from '@prisma/client';
import { ACCOUNTANT_ROLE_NAME, AUDITOR_ROLE_NAME } from '@modules/roles/constants/extended-roles.constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRD 6.2 (Document Permission Philosophy) — Access Scope Fixtures
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * A dedicated fixture builder (kept separate from `fixtures.ts`, used by
 * `document.routes.spec.ts` and many other suites, to avoid any risk to its
 * existing consumers) for `document-access-scope.routes.spec.ts`. Seeds one
 * tenant with:
 *   - Two Businesses (A/B).
 *   - An "Accountant" Role + UserRole, assigned via `BusinessAssignment` to
 *     Business A only (`DocumentAccessScopeService` matches this role by name).
 *   - An "Auditor" Role + UserRole (no Business restriction — category-only).
 *   - A portal Contact (`portalUserId` set) with a `ContactRole` on Business A.
 *   - Documents spanning both Businesses, multiple categories (including
 *     AUDIT), and one linked directly to the portal Contact (no Business).
 *
 * Real `Role`/`UserRole`/`BusinessAssignment`/`Contact`/`ContactRole` rows are
 * required (not just JWT claims) because `DocumentAccessScopeService` resolves
 * role names and assignments from the DB on every request — see that
 * service's header comment for why it's deliberately not JWT-cached. JWT
 * `permissions` are still set directly via `signAccessToken()` in the test
 * file itself, exactly like `document.routes.spec.ts`'s `tokenMissing()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export interface AccessScopeFixtures {
  tenantId: string;
  ownerUserId: string;
  businessAId: string;
  businessBId: string;
  accountantUserId: string;
  auditorUserId: string;
  clientPortalUserId: string;
  contactId: string;
  outsiderUserId: string;
  documentInBusinessA: string;
  documentInBusinessB: string;
  auditDocumentInBusinessB: string;
  clientPersonalDocumentId: string;
}

export async function seedAccessScopeFixtures(prisma: PrismaClient): Promise<AccessScopeFixtures> {
  const suffix = randomUUID().slice(0, 8);

  const tenant = await prisma.tenant.create({
    data: { slug: `test-scope-${suffix}`, name: `Access Scope Test Tenant ${suffix}`, status: TenantStatus.ACTIVE },
  });

  const [owner, accountantUser, auditorUser, clientPortalUser, outsider] = await Promise.all(
    ['owner', 'accountant', 'auditor', 'client', 'outsider'].map((label) =>
      prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: `${label}.${suffix}@example.test`,
          firstName: 'Scope',
          lastName: `Test ${label}`,
        },
      }),
    ),
  );

  const businessType = await prisma.businessType.create({
    data: { code: `TEST-SCOPE-TYPE-${suffix}`, name: `Test Scope Business Type ${suffix}` },
  });

  const [businessA, businessB] = await Promise.all([
    prisma.business.create({
      data: { tenantId: tenant.id, typeId: businessType.id, name: `Business A ${suffix}`, status: BusinessStatus.ACTIVE },
    }),
    prisma.business.create({
      data: { tenantId: tenant.id, typeId: businessType.id, name: `Business B ${suffix}`, status: BusinessStatus.ACTIVE },
    }),
  ]);

  const accountantRole = await prisma.role.create({
    data: { tenantId: tenant.id, name: ACCOUNTANT_ROLE_NAME, type: RoleType.SYSTEM, createdById: owner.id },
  });
  const auditorRole = await prisma.role.create({
    data: { tenantId: tenant.id, name: AUDITOR_ROLE_NAME, type: RoleType.SYSTEM, createdById: owner.id },
  });

  await Promise.all([
    prisma.userRole.create({
      data: { tenantId: tenant.id, userId: accountantUser.id, roleId: accountantRole.id, assignedById: owner.id },
    }),
    prisma.userRole.create({
      data: { tenantId: tenant.id, userId: auditorUser.id, roleId: auditorRole.id, assignedById: owner.id },
    }),
    // `outsider` is also an Accountant, but assigned to Business B only — used to prove that an explicit
    // `documents:share` grant (not just "no role at all") is what lets them reach Business A's document.
    prisma.userRole.create({
      data: { tenantId: tenant.id, userId: outsider.id, roleId: accountantRole.id, assignedById: owner.id },
    }),
    prisma.businessAssignment.create({
      data: { tenantId: tenant.id, businessId: businessA.id, userId: accountantUser.id, role: 'ACCOUNTANT' },
    }),
    prisma.businessAssignment.create({
      data: { tenantId: tenant.id, businessId: businessB.id, userId: outsider.id, role: 'ACCOUNTANT' },
    }),
  ]);

  const contact = await prisma.contact.create({
    data: { tenantId: tenant.id, firstName: 'Portal', lastName: 'Client', portalUserId: clientPortalUser.id },
  });
  await prisma.contactRole.create({
    data: { tenantId: tenant.id, businessId: businessA.id, contactId: contact.id, roleType: ContactRoleType.DIRECTOR, isPrimary: true },
  });

  const makeDocument = (overrides: { businessId?: string | null; contactId?: string | null; category: DocumentCategory }) =>
    prisma.document.create({
      data: {
        tenantId: tenant.id,
        businessId: overrides.businessId ?? null,
        contactId: overrides.contactId ?? null,
        category: overrides.category,
        fileName: `${randomUUID()}.pdf`,
        storageKey: `tenants/${tenant.id}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        uploadedById: owner.id,
      },
    });

  const [documentInBusinessA, documentInBusinessB, auditDocumentInBusinessB, clientPersonalDocument] = await Promise.all([
    makeDocument({ businessId: businessA.id, category: DocumentCategory.PAN }),
    makeDocument({ businessId: businessB.id, category: DocumentCategory.PAN }),
    makeDocument({ businessId: businessB.id, category: DocumentCategory.AUDIT }),
    makeDocument({ contactId: contact.id, category: DocumentCategory.IDENTITY }),
  ]);

  return {
    tenantId: tenant.id,
    ownerUserId: owner.id,
    businessAId: businessA.id,
    businessBId: businessB.id,
    accountantUserId: accountantUser.id,
    auditorUserId: auditorUser.id,
    clientPortalUserId: clientPortalUser.id,
    contactId: contact.id,
    outsiderUserId: outsider.id,
    documentInBusinessA: documentInBusinessA.id,
    documentInBusinessB: documentInBusinessB.id,
    auditDocumentInBusinessB: auditDocumentInBusinessB.id,
    clientPersonalDocumentId: clientPersonalDocument.id,
  };
}

/** Removes every row created by `seedAccessScopeFixtures`, in FK-safe order. */
export async function cleanupAccessScopeFixtures(prisma: PrismaClient, fixtures: AccessScopeFixtures): Promise<void> {
  const tenantId = fixtures.tenantId;

  await prisma.resourceAccessPolicy.deleteMany({ where: { tenantId } });
  await prisma.document.deleteMany({ where: { tenantId } });
  await prisma.contactRole.deleteMany({ where: { tenantId } });
  await prisma.contact.deleteMany({ where: { tenantId } });
  await prisma.businessAssignment.deleteMany({ where: { tenantId } });
  await prisma.userRole.deleteMany({ where: { tenantId } });
  await prisma.role.deleteMany({ where: { tenantId } });

  const businesses = await prisma.business.findMany({ where: { tenantId }, select: { id: true, typeId: true } });
  await prisma.business.deleteMany({ where: { tenantId } });
  await prisma.businessType.deleteMany({ where: { id: { in: businesses.map((b) => b.typeId) } } });

  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}
