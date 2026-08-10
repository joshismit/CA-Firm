import 'dotenv/config';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import {
  PrismaClient,
  TenantStatus,
  SubscriptionStatus,
  UserStatus,
  RoleType,
  PermissionAction,
  BusinessStatus,
  AddressType,
  ContactRoleType,
  ClientStatus,
  ActivityType,
  ProjectStatus,
  TaskStatus,
  DocumentCategory,
  Permission,
} from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { seedPermissions } from './permissions.seed';
import { seedBusinessTypes } from './business-type.seed';
import {
  ACCOUNTANT_ROLE_NAME,
  AUDITOR_ROLE_NAME,
  HR_ROLE_NAME,
  CLIENT_ROLE_NAME,
  ACCOUNTANT_PERMISSION_CODES,
  AUDITOR_PERMISSION_CODES,
  HR_PERMISSION_CODES,
  CLIENT_PERMISSION_CODES,
} from '../../src/modules/roles/constants/extended-roles.constants';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Dev/Demo Data Seed
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Populates a full demo tenant end-to-end (auth, RBAC, business, contacts,
 * CRM, clients, projects, tasks, documents) so the whole backend can be
 * exercised against real rows instead of an empty database. Separate from
 * `prisma/seeds/index.ts` (prod-safe reference data only — permissions and
 * business types) because none of this is real-tenant data.
 *
 * Run with: `npx ts-node prisma/seeds/dev-data.seed.ts` (or `npm run seed:dev`).
 * Safe to re-run: the tenant/roles/users/reference tables are upserted; the
 * bulk of business/contact/lead/client/project/task/document rows are only
 * created once (skipped if the demo tenant already has any `Business` rows).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, errorFormat: 'pretty' });

const DEMO_TENANT_SLUG = 'demo-ca-firm';
const DEMO_PASSWORD = 'Passw0rd!123';

const OWNER_EMAIL = 'owner@democafirm.test';
const STAFF_EMAIL = 'staff@democafirm.test';
const ACCOUNTANT_EMAIL = 'accountant@democafirm.test';
const AUDITOR_EMAIL = 'auditor@democafirm.test';
const HR_EMAIL = 'hr@democafirm.test';
/** Client-portal login demo — linked to `contact1` (Rohit Sharma, Sharma & Sons) once `seedDemoEntities()` creates that Contact. */
const CLIENT_EMAIL = 'client@democafirm.test';

async function seedTenant() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO_TENANT_SLUG },
    update: { status: TenantStatus.ACTIVE, subscriptionStatus: SubscriptionStatus.ACTIVE },
    create: {
      slug: DEMO_TENANT_SLUG,
      name: 'Demo CA Firm',
      country: 'IN',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      defaultCurrency: 'INR',
      status: TenantStatus.ACTIVE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      planCode: 'PRO',
      maxUsers: 25,
      maxClients: 500,
      maxStorageGb: 50,
      maxDocuments: 5000,
    },
  });

  await prisma.tenantSettings.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: { tenantId: tenant.id },
  });

  return tenant;
}

async function seedUsers(tenantId: string) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const owner = await prisma.user.upsert({
    where: { uq_users_tenant_email: { tenantId, email: OWNER_EMAIL } },
    update: {},
    create: {
      tenantId,
      email: OWNER_EMAIL,
      passwordHash,
      firstName: 'Asha',
      lastName: 'Mehta',
      phone: '+919820012345',
      status: UserStatus.ACTIVE,
      isOwner: true,
      jobTitle: 'Founding Partner',
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
    },
  });

  const staff = await prisma.user.upsert({
    where: { uq_users_tenant_email: { tenantId, email: STAFF_EMAIL } },
    update: {},
    create: {
      tenantId,
      email: STAFF_EMAIL,
      passwordHash,
      firstName: 'Karan',
      lastName: 'Desai',
      phone: '+919820054321',
      status: UserStatus.ACTIVE,
      isOwner: false,
      jobTitle: 'Article Assistant',
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
      createdBy: owner.id,
    },
  });

  const accountant = await prisma.user.upsert({
    where: { uq_users_tenant_email: { tenantId, email: ACCOUNTANT_EMAIL } },
    update: {},
    create: {
      tenantId,
      email: ACCOUNTANT_EMAIL,
      passwordHash,
      firstName: 'Priya',
      lastName: 'Kulkarni',
      phone: '+919820098765',
      status: UserStatus.ACTIVE,
      isOwner: false,
      jobTitle: 'Accountant',
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
      createdBy: owner.id,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { uq_users_tenant_email: { tenantId, email: AUDITOR_EMAIL } },
    update: {},
    create: {
      tenantId,
      email: AUDITOR_EMAIL,
      passwordHash,
      firstName: 'Rajesh',
      lastName: 'Iyer',
      phone: '+919820011223',
      status: UserStatus.ACTIVE,
      isOwner: false,
      jobTitle: 'Auditor',
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
      createdBy: owner.id,
    },
  });

  const hr = await prisma.user.upsert({
    where: { uq_users_tenant_email: { tenantId, email: HR_EMAIL } },
    update: {},
    create: {
      tenantId,
      email: HR_EMAIL,
      passwordHash,
      firstName: 'Neha',
      lastName: 'Bhatt',
      phone: '+919820033445',
      status: UserStatus.ACTIVE,
      isOwner: false,
      jobTitle: 'HR Executive',
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
      createdBy: owner.id,
    },
  });

  // CLIENT-portal demo user — `resolveRole()` only resolves this to UserRole.CLIENT once
  // `seedDemoEntities()` links `Contact.portalUserId` to this user's id (see below).
  const client = await prisma.user.upsert({
    where: { uq_users_tenant_email: { tenantId, email: CLIENT_EMAIL } },
    update: {},
    create: {
      tenantId,
      email: CLIENT_EMAIL,
      passwordHash,
      firstName: 'Rohit',
      lastName: 'Sharma',
      phone: '+919000011111',
      status: UserStatus.ACTIVE,
      isOwner: false,
      jobTitle: 'Client (Sharma & Sons)',
      emailVerifiedAt: new Date(),
      passwordChangedAt: new Date(),
      createdBy: owner.id,
    },
  });

  return { owner, staff, accountant, auditor, hr, client };
}

async function seedRolesAndPermissions(
  tenantId: string,
  ownerId: string,
  staffId: string,
  accountantId: string,
  auditorId: string,
  hrId: string,
  clientId: string,
) {
  const ownerRole = await prisma.role.upsert({
    where: { uq_roles_tenant_name: { tenantId, name: 'Owner' } },
    update: {},
    create: {
      tenantId,
      name: 'Owner',
      description: 'Full access to every module.',
      type: RoleType.SYSTEM,
      createdById: ownerId,
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { uq_roles_tenant_name: { tenantId, name: 'Staff' } },
    update: {},
    create: {
      tenantId,
      name: 'Staff',
      description: 'Create/read/update access, no delete or admin actions.',
      type: RoleType.SYSTEM,
      createdById: ownerId,
    },
  });

  const allPermissions: Permission[] = await prisma.permission.findMany();
  const staffActions: string[] = [PermissionAction.CREATE, PermissionAction.READ, PermissionAction.UPDATE];

  await prisma.rolePermission.createMany({
    data: allPermissions.map((permission) => ({
      roleId: ownerRole.id,
      permissionId: permission.id,
      grantedById: ownerId,
    })),
    skipDuplicates: true,
  });

  await prisma.rolePermission.createMany({
    data: allPermissions
      .filter((permission) => staffActions.includes(permission.action))
      .map((permission) => ({
        roleId: staffRole.id,
        permissionId: permission.id,
        grantedById: ownerId,
      })),
    skipDuplicates: true,
  });

  await prisma.userRole.upsert({
    where: { uq_user_role: { tenantId, userId: ownerId, roleId: ownerRole.id } },
    update: {},
    create: { tenantId, userId: ownerId, roleId: ownerRole.id, assignedById: ownerId },
  });

  await prisma.userRole.upsert({
    where: { uq_user_role: { tenantId, userId: staffId, roleId: staffRole.id } },
    update: {},
    create: { tenantId, userId: staffId, roleId: staffRole.id, assignedById: ownerId },
  });

  // ── Accountant / Auditor / HR — PRD 6.2 (Permission Philosophy) ───────────
  // `DocumentAccessScopeService` (modules/documents/service/
  // document-access-scope.service.ts) matches Accountant/Auditor by role
  // *name* and further restricts them at request time (assigned Businesses /
  // AUDIT-category documents, respectively — see that service). HR
  // deliberately gets no `documents:*` permission at all; `HR_PERMISSION_CODES`
  // is the single source of truth both this seed and the test suite assert
  // against.
  const roleDefinitions: Array<{ name: string; description: string; userId: string; codes: string[] }> = [
    {
      name: ACCOUNTANT_ROLE_NAME,
      description: 'Manages documents for their assigned Businesses only.',
      userId: accountantId,
      codes: ACCOUNTANT_PERMISSION_CODES,
    },
    {
      name: AUDITOR_ROLE_NAME,
      description: 'Reviews AUDIT-category documents only.',
      userId: auditorId,
      codes: AUDITOR_PERMISSION_CODES,
    },
    {
      name: HR_ROLE_NAME,
      description: 'Manages staff users. No access to client documents.',
      userId: hrId,
      codes: HR_PERMISSION_CODES,
    },
    {
      name: CLIENT_ROLE_NAME,
      description: 'Client-portal user — can create and assign tasks for their own business only.',
      userId: clientId,
      codes: CLIENT_PERMISSION_CODES,
    },
  ];

  for (const definition of roleDefinitions) {
    const role = await prisma.role.upsert({
      where: { uq_roles_tenant_name: { tenantId, name: definition.name } },
      update: {},
      create: {
        tenantId,
        name: definition.name,
        description: definition.description,
        type: RoleType.SYSTEM,
        createdById: ownerId,
      },
    });

    await prisma.rolePermission.createMany({
      data: allPermissions
        .filter((permission) => definition.codes.includes(permission.code))
        .map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
          grantedById: ownerId,
        })),
      skipDuplicates: true,
    });

    await prisma.userRole.upsert({
      where: { uq_user_role: { tenantId, userId: definition.userId, roleId: role.id } },
      update: {},
      create: { tenantId, userId: definition.userId, roleId: role.id, assignedById: ownerId },
    });
  }
}

async function seedCrmReferenceData(tenantId: string) {
  const sourceNames = ['Website', 'Referral', 'Cold Call', 'Social Media'];
  const sources = await Promise.all(
    sourceNames.map((name) =>
      prisma.leadSource.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: {},
        create: { tenantId, name },
      }),
    ),
  );

  const stageNames = ['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Won', 'Lost'];
  const stages = await Promise.all(
    stageNames.map((name, order) =>
      prisma.leadStage.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: { order },
        create: { tenantId, name, order },
      }),
    ),
  );

  const categoryNames = ['Premium', 'Regular'];
  const categories = await Promise.all(
    categoryNames.map((name) =>
      prisma.clientCategory.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: {},
        create: { tenantId, name, color: name === 'Premium' ? '#7C3AED' : '#2563EB' },
      }),
    ),
  );

  const tagNames = ['GST', 'VIP', 'Urgent'];
  const tags = await Promise.all(
    tagNames.map((name) =>
      prisma.clientTag.upsert({
        where: { tenantId_name: { tenantId, name } },
        update: {},
        create: { tenantId, name },
      }),
    ),
  );

  return {
    sourceByName: Object.fromEntries(sources.map((s) => [s.name, s])),
    stageByName: Object.fromEntries(stages.map((s) => [s.name, s])),
    categoryByName: Object.fromEntries(categories.map((c) => [c.name, c])),
    tagByName: Object.fromEntries(tags.map((t) => [t.name, t])),
  };
}

async function seedDemoEntities(
  tenantId: string,
  owner: { id: string },
  staff: { id: string },
  accountant: { id: string },
  client: { id: string },
) {
  const refData = await seedCrmReferenceData(tenantId);

  const businessTypeByCode = Object.fromEntries(
    (await prisma.businessType.findMany()).map((t) => [t.code, t]),
  );

  // ── Contacts ──────────────────────────────────────────────────────────────
  // `portalUserId` links this Contact to the demo Client-portal user (`CLIENT_EMAIL`) — the
  // one place this field is ever set outside `AuthService.acceptInvite()`'s invite flow, since
  // this Contact and its business are created together in this same seed run.
  const contact1 = await prisma.contact.create({
    data: {
      tenantId,
      firstName: 'Rohit',
      lastName: 'Sharma',
      email: 'rohit.sharma@sharmasons.example',
      phone: '+919000011111',
      pan: 'ABCDE1234F',
      portalUserId: client.id,
      addresses: {
        create: {
          tenantId,
          type: AddressType.RESIDENTIAL,
          isPrimary: true,
          addressLine1: '12 Marine Drive',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400002',
        },
      },
      comms: { create: { tenantId } },
    },
  });

  const contact2 = await prisma.contact.create({
    data: {
      tenantId,
      firstName: 'Ananya',
      lastName: 'Verma',
      email: 'ananya.verma@vermatextiles.example',
      phone: '+919000022222',
      pan: 'BCDEF2345G',
      addresses: {
        create: {
          tenantId,
          type: AddressType.RESIDENTIAL,
          isPrimary: true,
          addressLine1: '45 Connaught Place',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110001',
        },
      },
      comms: { create: { tenantId } },
    },
  });

  const contact3 = await prisma.contact.create({
    data: {
      tenantId,
      firstName: 'Vikram',
      lastName: 'Nair',
      email: 'vikram.nair@nairconsulting.example',
      phone: '+919000033333',
      pan: 'CDEFG3456H',
      addresses: {
        create: {
          tenantId,
          type: AddressType.RESIDENTIAL,
          isPrimary: true,
          addressLine1: '8 MG Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560001',
        },
      },
      comms: { create: { tenantId } },
    },
  });

  // ── Businesses ────────────────────────────────────────────────────────────
  const business1 = await prisma.business.create({
    data: {
      tenantId,
      typeId: businessTypeByCode['PRIVATE_LIMITED'].id,
      name: 'Sharma & Sons Pvt Ltd',
      legalName: 'Sharma & Sons Private Limited',
      status: BusinessStatus.ACTIVE,
      pan: 'ABCDE1234F',
      gstin: '27ABCDE1234F1Z5',
      cin: 'U74999MH2015PTC123456',
      incorporationDate: new Date('2015-06-10'),
      industry: 'Manufacturing',
      createdBy: owner.id,
      addresses: {
        create: {
          tenantId,
          type: AddressType.REGISTERED,
          isPrimary: true,
          addressLine1: '221 Nariman Point',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400021',
        },
      },
      registrations: {
        create: { tenantId, registrationType: 'GSTIN', registrationNum: '27ABCDE1234F1Z5' },
      },
      contactRoles: {
        create: { tenantId, contactId: contact1.id, roleType: ContactRoleType.DIRECTOR, isPrimary: true },
      },
    },
  });

  const business2 = await prisma.business.create({
    data: {
      tenantId,
      typeId: businessTypeByCode['PROPRIETORSHIP'].id,
      name: 'Verma Textiles',
      status: BusinessStatus.ACTIVE,
      pan: 'BCDEF2345G',
      gstin: '07BCDEF2345G1Z3',
      incorporationDate: new Date('2018-02-01'),
      industry: 'Textiles',
      createdBy: owner.id,
      addresses: {
        create: {
          tenantId,
          type: AddressType.REGISTERED,
          isPrimary: true,
          addressLine1: '10 Karol Bagh',
          city: 'New Delhi',
          state: 'Delhi',
          pincode: '110005',
        },
      },
      contactRoles: {
        create: { tenantId, contactId: contact2.id, roleType: ContactRoleType.OWNER, isPrimary: true },
      },
    },
  });

  const business3 = await prisma.business.create({
    data: {
      tenantId,
      typeId: businessTypeByCode['LLP'].id,
      name: 'Nair Consulting LLP',
      status: BusinessStatus.ACTIVE,
      pan: 'CDEFG3456H',
      incorporationDate: new Date('2020-09-15'),
      industry: 'Professional Services',
      createdBy: owner.id,
      addresses: {
        create: {
          tenantId,
          type: AddressType.REGISTERED,
          isPrimary: true,
          addressLine1: '77 Residency Road',
          city: 'Bengaluru',
          state: 'Karnataka',
          pincode: '560025',
        },
      },
      contactRoles: {
        create: { tenantId, contactId: contact3.id, roleType: ContactRoleType.PARTNER, isPrimary: true },
      },
    },
  });

  // ── Leads ─────────────────────────────────────────────────────────────────
  const lead1 = await prisma.lead.create({
    data: {
      tenantId,
      businessId: business1.id,
      contactId: contact1.id,
      title: 'GST Filing Retainer - Sharma & Sons',
      sourceId: refData.sourceByName['Website'].id,
      stageId: refData.stageByName['Won'].id,
      expectedRevenue: 120000,
      probability: 100,
      expectedCloseDate: new Date('2026-08-15'),
      activities: {
        create: {
          tenantId,
          type: ActivityType.CALL,
          description: 'Initial discovery call about monthly GST filing needs.',
          performedById: owner.id,
        },
      },
      notes: {
        create: { tenantId, content: 'Client agreed to a 12-month retainer.', authorId: owner.id },
      },
      assignments: { create: { tenantId, userId: staff.id } },
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      tenantId,
      businessId: business2.id,
      contactId: contact2.id,
      title: 'Bookkeeping Services - Verma Textiles',
      sourceId: refData.sourceByName['Referral'].id,
      stageId: refData.stageByName['Qualified'].id,
      expectedRevenue: 60000,
      probability: 60,
      expectedCloseDate: new Date('2026-09-01'),
      activities: {
        create: {
          tenantId,
          type: ActivityType.MEETING,
          description: 'Met to review current bookkeeping process and pain points.',
          performedById: staff.id,
        },
      },
      notes: {
        create: { tenantId, content: 'Needs proposal by end of month.', authorId: staff.id },
      },
      assignments: { create: { tenantId, userId: staff.id } },
    },
  });

  const lead3 = await prisma.lead.create({
    data: {
      tenantId,
      businessId: business3.id,
      contactId: contact3.id,
      title: 'Audit Engagement - Nair Consulting',
      sourceId: refData.sourceByName['Cold Call'].id,
      stageId: refData.stageByName['Contacted'].id,
      expectedRevenue: 200000,
      probability: 30,
      expectedCloseDate: new Date('2026-10-01'),
      activities: {
        create: {
          tenantId,
          type: ActivityType.EMAIL,
          description: 'Sent introductory email with firm credentials.',
          performedById: owner.id,
        },
      },
    },
  });
  void lead3;

  // ── Clients ───────────────────────────────────────────────────────────────
  const client1 = await prisma.client.create({
    data: {
      tenantId,
      businessId: business1.id,
      status: ClientStatus.ACTIVE,
      onboardedAt: new Date(),
      categoryId: refData.categoryByName['Premium'].id,
      assignments: { create: { tenantId, userId: staff.id, role: 'ACCOUNTANT' } },
      tags: {
        create: [
          { tagId: refData.tagByName['GST'].id },
          { tagId: refData.tagByName['VIP'].id },
        ],
      },
    },
  });

  await prisma.leadConversion.create({
    data: {
      tenantId,
      leadId: lead1.id,
      clientId: client1.id,
      convertedById: owner.id,
      notes: 'Converted after GST retainer was signed.',
    },
  });

  const client2 = await prisma.client.create({
    data: {
      tenantId,
      businessId: business3.id,
      status: ClientStatus.ACTIVE,
      onboardedAt: new Date(),
      categoryId: refData.categoryByName['Regular'].id,
      assignments: { create: { tenantId, userId: owner.id, role: 'PARTNER' } },
      tags: { create: [{ tagId: refData.tagByName['Urgent'].id }] },
    },
  });

  // ── Projects & Tasks ──────────────────────────────────────────────────────
  const project1 = await prisma.project.create({
    data: {
      tenantId,
      clientId: client1.id,
      managerId: owner.id,
      createdBy: owner.id,
      code: 'PRJ-0001',
      name: 'FY24-25 Statutory Audit',
      status: ProjectStatus.ACTIVE,
      startDate: new Date('2026-07-01'),
      dueDate: new Date('2026-09-30'),
      tasks: {
        create: [
          {
            tenantId,
            title: 'Collect financial statements',
            status: TaskStatus.TODO,
            assigneeId: staff.id,
            dueDate: new Date('2026-08-05'),
            createdBy: owner.id,
          },
          {
            tenantId,
            title: 'Draft audit report',
            status: TaskStatus.IN_PROGRESS,
            assigneeId: owner.id,
            dueDate: new Date('2026-09-01'),
            createdBy: owner.id,
          },
          {
            tenantId,
            title: 'Partner review',
            status: TaskStatus.REVIEW,
            assigneeId: owner.id,
            dueDate: new Date('2026-09-20'),
            createdBy: owner.id,
          },
        ],
      },
    },
  });
  void project1;

  const project2 = await prisma.project.create({
    data: {
      tenantId,
      clientId: client2.id,
      managerId: staff.id,
      createdBy: owner.id,
      code: 'PRJ-0002',
      name: 'GST Return Filing - Q1',
      status: ProjectStatus.COMPLETED,
      startDate: new Date('2026-04-01'),
      dueDate: new Date('2026-06-30'),
      completedAt: new Date('2026-06-28'),
      tasks: {
        create: [
          {
            tenantId,
            title: 'File GSTR-1',
            status: TaskStatus.COMPLETED,
            assigneeId: staff.id,
            completedAt: new Date('2026-06-10'),
            createdBy: owner.id,
          },
          {
            tenantId,
            title: 'File GSTR-3B',
            status: TaskStatus.COMPLETED,
            assigneeId: staff.id,
            completedAt: new Date('2026-06-20'),
            createdBy: owner.id,
          },
        ],
      },
    },
  });
  void project2;

  await prisma.task.create({
    data: {
      tenantId,
      title: 'Renew DSC for Sharma & Sons',
      status: TaskStatus.TODO,
      assigneeId: owner.id,
      dueDate: new Date('2026-08-30'),
      createdBy: owner.id,
    },
  });

  // ── Document folders (PRD §7.1 rule 3 — Business → category → Folder → Subfolder) ──
  // Demonstrates the adjacency-list hierarchy: a flat PAN folder plus a nested
  // GST folder, both under business1, so the frontend folder tree/breadcrumbs
  // have real data to render against out of the box.
  const panFolder = await prisma.documentFolder.create({
    data: {
      tenantId,
      businessId: business1.id,
      category: DocumentCategory.PAN,
      name: 'Registration Documents',
      createdById: owner.id,
    },
  });
  const gstFolder = await prisma.documentFolder.create({
    data: {
      tenantId,
      businessId: business1.id,
      category: DocumentCategory.GST,
      name: 'GST Certificates',
      createdById: owner.id,
    },
  });
  const gstSubFolder = await prisma.documentFolder.create({
    data: {
      tenantId,
      businessId: business1.id,
      category: DocumentCategory.GST,
      parentFolderId: gstFolder.id,
      name: 'FY 2025-26',
      createdById: owner.id,
    },
  });

  // ── Documents (metadata only — no file actually uploaded to storage) ──────
  await prisma.document.createMany({
    data: [
      {
        tenantId,
        businessId: business1.id,
        folderId: panFolder.id,
        category: DocumentCategory.PAN,
        fileName: 'sharma_sons_pan.pdf',
        storageKey: `tenants/${tenantId}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 245678,
        uploadedById: owner.id,
      },
      {
        tenantId,
        businessId: business1.id,
        folderId: gstSubFolder.id,
        category: DocumentCategory.GST,
        fileName: 'sharma_sons_gst_certificate.pdf',
        storageKey: `tenants/${tenantId}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 198234,
        uploadedById: owner.id,
      },
      {
        tenantId,
        contactId: contact1.id,
        category: DocumentCategory.IDENTITY,
        fileName: 'rohit_sharma_aadhaar.pdf',
        storageKey: `tenants/${tenantId}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 87345,
        uploadedById: owner.id,
      },
      {
        tenantId,
        businessId: business3.id,
        category: DocumentCategory.AUDIT,
        fileName: 'nair_consulting_audit_report_fy24.pdf',
        storageKey: `tenants/${tenantId}/documents/${randomUUID()}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: 512900,
        uploadedById: staff.id,
      },
    ],
  });

  // ── Business assignment — scopes the demo Accountant to Sharma & Sons only ─
  // (`DocumentAccessScopeService` denies them business2/business3's documents).
  await prisma.businessAssignment.upsert({
    where: { businessId_userId: { businessId: business1.id, userId: accountant.id } },
    update: {},
    create: { tenantId, businessId: business1.id, userId: accountant.id, role: 'ACCOUNTANT' },
  });
}

async function main(): Promise<void> {
  console.log('Seeding demo tenant...');
  const tenant = await seedTenant();

  console.log('Seeding permissions & business types...');
  await seedPermissions(prisma);
  await seedBusinessTypes(prisma);

  console.log('Seeding demo users...');
  const { owner, staff, accountant, auditor, hr, client } = await seedUsers(tenant.id);

  console.log('Seeding roles & permission grants...');
  await seedRolesAndPermissions(tenant.id, owner.id, staff.id, accountant.id, auditor.id, hr.id, client.id);

  const existingBusinessCount = await prisma.business.count({ where: { tenantId: tenant.id } });
  if (existingBusinessCount > 0) {
    console.log('Demo business/CRM/project/task/document data already present — skipping.');
  } else {
    console.log('Seeding businesses, contacts, leads, clients, projects, tasks, documents...');
    await seedDemoEntities(tenant.id, owner, staff, accountant, client);
  }

  console.log('\nDone. Log in with:');
  console.log(`  Owner: ${OWNER_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Staff: ${STAFF_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Accountant: ${ACCOUNTANT_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Auditor: ${AUDITOR_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  HR: ${HR_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Client (Sharma & Sons): ${CLIENT_EMAIL} / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Dev data seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
