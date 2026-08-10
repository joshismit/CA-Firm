import { randomUUID } from 'crypto';
import { PrismaClient, TenantStatus, BusinessStatus, ClientStatus, UserStatus, ContactRoleType } from '@prisma/client';

export interface TenantFixture {
  tenantId: string;
  businessId: string;
  clientId: string;
  userId: string;
  /** A second, distinct staff user in the same tenant — e.g. exercising "does Amit see Rahul's task" visibility scenarios. */
  staffUserId: string;
  /** A CLIENT-portal user linked via `Contact.portalUserId` to `contactId`, which in turn has a `ContactRole` on `businessId`. */
  clientPortalUserId: string;
  contactId: string;
}

export interface TestFixtures {
  tenantA: TenantFixture;
  tenantB: TenantFixture;
}

/**
 * Seeds the minimum real rows needed to exercise the full request lifecycle:
 * an ACTIVE Tenant (required by `tenantMiddleware`), a User (Project's
 * `createdBy` FK must reference a real row when set), and a Client via
 * BusinessType → Business → Client (Project.clientId is a required,
 * `onDelete: Restrict` FK). Two full tenants are created so tests can assert
 * tenant isolation.
 */
async function createTenantFixture(prisma: PrismaClient, label: string): Promise<TenantFixture> {
  const suffix = randomUUID().slice(0, 8);

  const tenant = await prisma.tenant.create({
    data: {
      slug: `test-${label}-${suffix}`,
      name: `Integration Test Tenant ${label.toUpperCase()} ${suffix}`,
      status: TenantStatus.ACTIVE,
    },
  });

  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `test.${label}.${suffix}@example.test`,
      firstName: 'Integration',
      lastName: `Test ${label.toUpperCase()}`,
      status: UserStatus.ACTIVE,
    },
  });

  // A second, distinct staff user — needed so "does staff member X see a task assigned to/
  // created by staff member Y" scenarios exercise genuinely different identities, not the same
  // `userId` wearing a different JWT permission set.
  const staffUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `test.${label}.staff2.${suffix}@example.test`,
      firstName: 'Integration',
      lastName: `Staff2 ${label.toUpperCase()}`,
      status: UserStatus.ACTIVE,
    },
  });

  const businessType = await prisma.businessType.create({
    data: {
      code: `TEST-TYPE-${suffix}`,
      name: `Test Business Type ${suffix}`,
    },
  });

  const business = await prisma.business.create({
    data: {
      tenantId: tenant.id,
      typeId: businessType.id,
      name: `Test Business ${label.toUpperCase()} ${suffix}`,
      status: BusinessStatus.ACTIVE,
    },
  });

  const client = await prisma.client.create({
    data: {
      tenantId: tenant.id,
      businessId: business.id,
      status: ClientStatus.ACTIVE,
    },
  });

  // CLIENT-portal identity: a User with no staff role, linked to a Contact via
  // `portalUserId`, and that Contact holds a `ContactRole` on `business` — the same
  // `Contact.portalUserId -> ContactRole -> businessId` chain
  // `TaskAccessScopeService.resolveClientScope()`/`TaskService.resolveClientTaskContext()`
  // resolve at request time.
  const clientPortalUser = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: `test.${label}.client.${suffix}@example.test`,
      firstName: 'Integration',
      lastName: `ClientPortal ${label.toUpperCase()}`,
      status: UserStatus.ACTIVE,
    },
  });

  const contact = await prisma.contact.create({
    data: {
      tenantId: tenant.id,
      firstName: 'Integration',
      lastName: `Contact ${label.toUpperCase()}`,
      portalUserId: clientPortalUser.id,
    },
  });

  await prisma.contactRole.create({
    data: {
      tenantId: tenant.id,
      businessId: business.id,
      contactId: contact.id,
      roleType: ContactRoleType.DIRECTOR,
      isPrimary: true,
    },
  });

  return {
    tenantId: tenant.id,
    businessId: business.id,
    clientId: client.id,
    userId: user.id,
    staffUserId: staffUser.id,
    clientPortalUserId: clientPortalUser.id,
    contactId: contact.id,
  };
}

export async function seedFixtures(prisma: PrismaClient): Promise<TestFixtures> {
  const [tenantA, tenantB] = await Promise.all([
    createTenantFixture(prisma, 'a'),
    createTenantFixture(prisma, 'b'),
  ]);

  return { tenantA, tenantB };
}

/**
 * Removes every row created by `seedFixtures`, in FK-safe order. Projects are
 * hard-deleted directly (bypassing the app's soft-delete repository layer) —
 * this is teardown, not something going through the API.
 */
export async function cleanupFixtures(prisma: PrismaClient, fixtures: TestFixtures): Promise<void> {
  const tenantIds = [fixtures.tenantA.tenantId, fixtures.tenantB.tenantId];

  await prisma.project.deleteMany({ where: { tenantId: { in: tenantIds } } });
  // ContactRole cascades from either side (Contact or Business) being deleted — no separate
  // cleanup needed for it. BusinessAssignment likewise cascades from Business.
  await prisma.contact.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.client.deleteMany({ where: { tenantId: { in: tenantIds } } });

  const businesses = await prisma.business.findMany({
    where: { tenantId: { in: tenantIds } },
    select: { id: true, typeId: true },
  });
  await prisma.business.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.businessType.deleteMany({ where: { id: { in: businesses.map((b) => b.typeId) } } });

  await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });

  // Settings/branding/domain rows aren't seeded here — tests create them as a
  // side effect of exercising the settings APIs — but all three are
  // `onDelete: Restrict` against Tenant, so they must go before it.
  await prisma.tenantSettings.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantBranding.deleteMany({ where: { tenantId: { in: tenantIds } } });
  await prisma.tenantDomain.deleteMany({ where: { tenantId: { in: tenantIds } } });

  await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
}
