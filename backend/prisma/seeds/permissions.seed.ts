import { PrismaClient, PermissionAction as PrismaPermissionAction } from '@prisma/client';
import { PermissionAction, PermissionResource } from '../../src/shared/enums';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Permission Seed — Projects & Tasks Modules
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * IMPORTANT — pre-existing enum drift (found while writing this seed, not
 * introduced by it):
 *
 *   `shared/enums/permission.enum.ts`'s `PermissionAction` and the Prisma
 *   schema's `enum PermissionAction` are NOT the same values despite sharing
 *   a name and despite the shared enum's own doc comment claiming they
 *   "MUST mirror the Prisma schema enum values exactly":
 *
 *     shared/enums   CREATE = 'create' (lowercase) — no SHARE, no ASSIGN, has IMPORT
 *     Prisma schema  CREATE = 'CREATE' (uppercase) — has SHARE, ASSIGN, no IMPORT
 *
 *   `Permission.code` (e.g. "projects:create") must stay lowercase because
 *   that's what `requirePermission()` checks against `req.user.permissions`
 *   everywhere in the app — so `code` is built from `shared/enums`.
 *   `Permission.action` is a real Prisma enum column, so it must use Prisma's
 *   generated `PermissionAction` — hence both enums are imported and used
 *   deliberately below, one per concern. This file does not attempt to
 *   reconcile the drift itself; that's a cross-cutting decision beyond a
 *   permission-seed script.
 * ─────────────────────────────────────────────────────────────────────────────
 */

interface PermissionDefinition {
  /** shared/enums action — determines the lowercase `code` suffix (e.g. "create"). */
  action: PermissionAction;
  /** Prisma's generated action enum — stored in the `Permission.action` DB column. */
  dbAction: PrismaPermissionAction;
  name: string;
  description: string;
  isSensitive?: boolean;
}

const PROJECT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.CREATE,
    dbAction: PrismaPermissionAction.CREATE,
    name: 'Create Projects',
    description: 'Create new projects (engagements).',
  },
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Projects',
    description: 'View project details and lists.',
  },
  {
    action: PermissionAction.UPDATE,
    dbAction: PrismaPermissionAction.UPDATE,
    name: 'Update Projects',
    description: 'Edit project details and transition project status.',
  },
  {
    action: PermissionAction.DELETE,
    dbAction: PrismaPermissionAction.DELETE,
    name: 'Delete Projects',
    description: 'Soft-delete projects.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Projects',
    description: 'Full control over projects, including archive and restore.',
    isSensitive: true,
  },
  {
    action: PermissionAction.APPROVE,
    dbAction: PrismaPermissionAction.APPROVE,
    name: 'Approve Projects',
    description: 'Approve project-level actions requiring sign-off (e.g. engagement completion).',
    isSensitive: true,
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Projects',
    description: 'Export project lists and reports.',
  },
];

const BUSINESS_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.CREATE,
    dbAction: PrismaPermissionAction.CREATE,
    name: 'Create Businesses',
    description: 'Create new businesses (client entities).',
  },
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Businesses',
    description: 'View business details and lists, and the business type catalog.',
  },
  {
    action: PermissionAction.UPDATE,
    dbAction: PrismaPermissionAction.UPDATE,
    name: 'Update Businesses',
    description: 'Edit business details.',
  },
  {
    action: PermissionAction.DELETE,
    dbAction: PrismaPermissionAction.DELETE,
    name: 'Delete Businesses',
    description: 'Soft-delete businesses.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Businesses',
    description: 'Full control over businesses.',
    isSensitive: true,
  },
  {
    action: PermissionAction.APPROVE,
    dbAction: PrismaPermissionAction.APPROVE,
    name: 'Approve Businesses',
    description: 'Approve business-level actions requiring sign-off.',
    isSensitive: true,
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Businesses',
    description: 'Export business lists and reports.',
  },
];

const CONTACT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.CREATE,
    dbAction: PrismaPermissionAction.CREATE,
    name: 'Create Contacts',
    description: 'Create new contacts (people).',
  },
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Contacts',
    description: 'View contact details and lists, and their business role assignments.',
  },
  {
    action: PermissionAction.UPDATE,
    dbAction: PrismaPermissionAction.UPDATE,
    name: 'Update Contacts',
    description: 'Edit contact details and assign contacts to businesses with a role.',
  },
  {
    action: PermissionAction.DELETE,
    dbAction: PrismaPermissionAction.DELETE,
    name: 'Delete Contacts',
    description: 'Soft-delete contacts.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Contacts',
    description: 'Full control over contacts.',
    isSensitive: true,
  },
  {
    action: PermissionAction.APPROVE,
    dbAction: PrismaPermissionAction.APPROVE,
    name: 'Approve Contacts',
    description: 'Approve contact-level actions requiring sign-off.',
    isSensitive: true,
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Contacts',
    description: 'Export contact lists and reports.',
  },
];

const CRM_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.CREATE,
    dbAction: PrismaPermissionAction.CREATE,
    name: 'Create Leads',
    description: 'Create new CRM leads.',
  },
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Leads',
    description: 'View lead details and lists, and the lead stage catalog.',
  },
  {
    action: PermissionAction.UPDATE,
    dbAction: PrismaPermissionAction.UPDATE,
    name: 'Update Leads',
    description: 'Edit lead details.',
  },
  {
    action: PermissionAction.DELETE,
    dbAction: PrismaPermissionAction.DELETE,
    name: 'Delete Leads',
    description: 'Soft-delete leads.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Leads',
    description: 'Full control over leads, including converting a lead into a client.',
    isSensitive: true,
  },
  {
    action: PermissionAction.APPROVE,
    dbAction: PrismaPermissionAction.APPROVE,
    name: 'Approve Leads',
    description: 'Approve lead-level actions requiring sign-off.',
    isSensitive: true,
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Leads',
    description: 'Export lead lists and reports.',
  },
];

const DOCUMENT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.CREATE,
    dbAction: PrismaPermissionAction.CREATE,
    name: 'Create Documents',
    description: 'Upload new documents.',
  },
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Documents',
    description: 'View document details and lists.',
  },
  {
    action: PermissionAction.UPDATE,
    dbAction: PrismaPermissionAction.UPDATE,
    name: 'Update Documents',
    description: 'Edit document metadata and upload new versions.',
  },
  {
    action: PermissionAction.DELETE,
    dbAction: PrismaPermissionAction.DELETE,
    name: 'Delete Documents',
    description: 'Soft-delete documents.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Documents',
    description: 'Full control over documents, including restoring soft-deleted documents.',
    isSensitive: true,
  },
  {
    action: PermissionAction.APPROVE,
    dbAction: PrismaPermissionAction.APPROVE,
    name: 'Approve Documents',
    description: 'Approve document-level actions requiring sign-off.',
    isSensitive: true,
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Documents',
    description: 'Export/download document lists and reports.',
  },
];

const TASK_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.CREATE,
    dbAction: PrismaPermissionAction.CREATE,
    name: 'Create Tasks',
    description: 'Create new tasks (standalone or under a project).',
  },
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Tasks',
    description: 'View task details and lists.',
  },
  {
    action: PermissionAction.UPDATE,
    dbAction: PrismaPermissionAction.UPDATE,
    name: 'Update Tasks',
    description: 'Edit task details and transition task status.',
  },
  {
    action: PermissionAction.DELETE,
    dbAction: PrismaPermissionAction.DELETE,
    name: 'Delete Tasks',
    description: 'Soft-delete tasks.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Tasks',
    description: 'Full control over tasks, including restoring soft-deleted tasks.',
    isSensitive: true,
  },
  {
    action: PermissionAction.APPROVE,
    dbAction: PrismaPermissionAction.APPROVE,
    name: 'Approve Tasks',
    description: 'Approve task-level actions requiring sign-off (e.g. review completion).',
    isSensitive: true,
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Tasks',
    description: 'Export task lists and reports.',
  },
];

/**
 * Only READ/MANAGE — the frontend's permission registry
 * (frontend/src/config/permissions.config.ts) never defines granular
 * `users:create`/`update`/`delete` for this resource, only
 * `PERMISSIONS.USERS_READ`/`USERS_MANAGE` (see
 * `src/modules/users/constants/user.permissions.ts`), so this mirrors that
 * exactly instead of seeding permissions no role assignment or `<Can>` guard
 * will ever reference.
 */
const USER_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Users',
    description: 'View staff user details, lists, and their assigned roles/sessions.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Users',
    description: 'Invite, update, and remove staff users, and manage their invitations.',
    isSensitive: true,
  },
];

/**
 * Only READ/MANAGE — the frontend's permission registry
 * (frontend/src/config/permissions.config.ts) never defines granular
 * `roles:create`/`update`/`delete` for this resource, only
 * `PERMISSIONS.ROLES_READ`/`ROLES_MANAGE` (see
 * `src/modules/roles/constants/role.permissions.ts`), so this mirrors that
 * exactly instead of seeding permissions no role assignment or `<Can>` guard
 * will ever reference.
 */
const ROLE_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Roles',
    description: 'View role details, lists, and the users assigned to each role.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Roles',
    description: 'Create, update, and delete custom roles, and assign/revoke roles for users.',
    isSensitive: true,
  },
];

/**
 * Client Billing (Invoices/Expenses/Payments to the firm's own clients) —
 * only READ/MANAGE, shared across all three sub-resources; the frontend's
 * permission registry defines only `PERMISSIONS.CLIENT_BILLING_READ`/
 * `MANAGE`, no granular `invoice:*`/`expense:*`/`payment:*` codes (see
 * `src/modules/client-billing/constants/client-billing.permissions.ts`).
 * Deliberately distinct from `PermissionResource.BILLING` (the unrelated
 * SaaS-subscription resource) — never conflated with it.
 */
const CLIENT_BILLING_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Client Billing',
    description: 'View invoices, expenses, and payments for the firm\'s own clients.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Client Billing',
    description: 'Create, update, and delete invoices, expenses, and payments for the firm\'s own clients.',
    isSensitive: true,
  },
];

/**
 * Platform Billing (the tenant's own subscription to the ERP vendor — plans,
 * checkout, invoice history) — only READ/MANAGE, mirroring
 * `CLIENT_BILLING_PERMISSION_DEFINITIONS`'s shape exactly. Deliberately
 * distinct from `PermissionResource.CLIENT_BILLING` (the unrelated
 * firm-to-its-own-clients resource) — never conflated with it.
 */
const BILLING_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Billing',
    description: 'View the firm\'s current plan, usage limits, and platform invoice history.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Billing',
    description: 'Change the firm\'s subscription plan and complete checkout.',
    isSensitive: true,
  },
];

/**
 * Audit Log (PRD §14.1) — READ only, matching the frontend's own
 * `PERMISSIONS.AUDIT_LOGS_READ` exactly (see
 * `src/config/permissions.config.ts` — no `AUDIT_LOGS_MANAGE` is defined
 * there). Entries are system-generated by `AuditLogRecorder` from other
 * modules' own business actions, never created/updated/deleted through this
 * resource directly — same reasoning as `REPORT_PERMISSION_DEFINITIONS`.
 */
const AUDIT_LOGS_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Audit Logs',
    description: 'View the security-relevant activity trail across the firm\'s account.',
    isSensitive: true,
  },
];

/**
 * Settings — READ/MANAGE, matching the frontend's own
 * `PERMISSIONS.SETTINGS_READ`/`SETTINGS_MANAGE` exactly. Gates firm-wide
 * settings generally; `modules/tenant`'s branding/custom-domain endpoints
 * (PRD §4.3 white-label) are its first real consumer.
 */
const SETTINGS_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Settings',
    description: 'View firm-wide settings, including branding and custom domain configuration.',
  },
  {
    action: PermissionAction.MANAGE,
    dbAction: PrismaPermissionAction.MANAGE,
    name: 'Manage Settings',
    description: 'Change firm-wide settings, including branding and custom domain configuration.',
    isSensitive: true,
  },
];

/**
 * Reports (read-only generated projections over existing data) — only
 * READ/EXPORT, matching the frontend's own `PERMISSIONS.REPORTS_READ`/
 * `REPORTS_EXPORT` pair exactly (see
 * `src/modules/reports/constants/report.permissions.ts`). No
 * CREATE/UPDATE/DELETE — reports are never created, updated, or deleted,
 * only generated and exported.
 */
const REPORT_PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    action: PermissionAction.READ,
    dbAction: PrismaPermissionAction.READ,
    name: 'View Reports',
    description: 'Generate and view reports across clients, finances, and operations.',
  },
  {
    action: PermissionAction.EXPORT,
    dbAction: PrismaPermissionAction.EXPORT,
    name: 'Export Reports',
    description: 'Export generated reports as files (CSV).',
  },
];

/**
 * Upserts every permission for a single resource, keyed on the unique `code`
 * column. Safe to run any number of times — never creates duplicates.
 */
async function upsertResourcePermissions(
  prisma: PrismaClient,
  resource: PermissionResource,
  definitions: PermissionDefinition[],
): Promise<void> {
  for (const def of definitions) {
    const code = `${resource}:${def.action}`;

    await prisma.permission.upsert({
      where: { code },
      update: {
        name: def.name,
        description: def.description,
        module: resource,
        action: def.dbAction,
        resource,
        isSensitive: def.isSensitive ?? false,
      },
      create: {
        code,
        name: def.name,
        description: def.description,
        module: resource,
        action: def.dbAction,
        resource,
        isSensitive: def.isSensitive ?? false,
      },
    });
  }
}

/**
 * Seeds all `Permission` records for the Projects, Tasks, Business, Contacts,
 * CRM, Documents, Users, and Roles modules — i.e. every module actually
 * wired up in `src/app.ts`. Idempotent — re-running upserts on the unique
 * `code` column instead of inserting duplicates. Does not touch `Role` rows
 * themselves or `RolePermission` grants — role/grant seeding is explicitly
 * out of scope here.
 */
export async function seedPermissions(prisma: PrismaClient): Promise<void> {
  await upsertResourcePermissions(
    prisma,
    PermissionResource.PROJECTS,
    PROJECT_PERMISSION_DEFINITIONS,
  );
  await upsertResourcePermissions(prisma, PermissionResource.TASKS, TASK_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.BUSINESS, BUSINESS_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.CONTACTS, CONTACT_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.CRM, CRM_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.DOCUMENTS, DOCUMENT_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.USERS, USER_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.ROLES, ROLE_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.CLIENT_BILLING, CLIENT_BILLING_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.REPORTS, REPORT_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.BILLING, BILLING_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.AUDIT_LOGS, AUDIT_LOGS_PERMISSION_DEFINITIONS);
  await upsertResourcePermissions(prisma, PermissionResource.SETTINGS, SETTINGS_PERMISSION_DEFINITIONS);
}
