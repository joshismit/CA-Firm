// Centralized TanStack Query key factory - the single source of truth for cache keys across every
// module. Every module's hooks/index.ts imports its section from here rather than hand-rolling a
// local key factory - keeps invalidation, DevTools debugging, and collision-avoidance consistent
// as the app grows. (Kept the existing `queryKeys` export name, not `QUERY_KEYS`, so the
// already-wired Projects/Tasks modules - which are off-limits to modify - don't need touching.)

import type { ProjectListFilters } from '@/modules/projects/types'
import type { TaskListFilters } from '@/modules/tasks/types'
import type { BusinessListFilters } from '@/modules/business/types'
import type { ContactListFilters } from '@/modules/contacts/types'
import type { LeadListFilters } from '@/modules/crm/types'
import type { DocumentListFilters, DocumentTemplateListFilters } from '@/modules/documents/types'
import type { InvoiceListFilters } from '@/modules/billing/types'
import type { NotificationListFilters } from '@/modules/notifications/types'
import type { ReportFilters, ReportType } from '@/modules/reports/types'
import type { AuditLogFilters } from '@/modules/audit/types'
import type { UserListFilters } from '@/modules/users/types'
import type { RoleListFilters } from '@/modules/roles/types'
import type { ComplianceFilingListFilters, ComplianceModuleKey } from '@/modules/compliance/types'
import type {
  ExpenseListFilters,
  InvoiceListFilters as ClientInvoiceListFilters,
  PaymentListFilters,
} from '@/modules/client-billing/types'
import type { TenantListFilters } from '@/modules/master-admin/types'
import type { SharedDocumentListFilters } from '@/modules/client-portal/types'
import type { AnalyticsFilters } from '@/modules/dashboard/types'

export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
    sessions: ['auth', 'sessions'] as const,
    invite: (token: string) => ['auth', 'invite', token] as const,
  },

  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: ProjectListFilters) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    overdue: () => [...queryKeys.projects.all, 'overdue'] as const,
    byClient: (clientId: string) => [...queryKeys.projects.all, 'client', clientId] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (filters: TaskListFilters) => [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    overdue: () => [...queryKeys.tasks.all, 'overdue'] as const,
    byProject: (projectId: string) => [...queryKeys.tasks.all, 'project', projectId] as const,
    byAssignee: (assigneeId: string) => [...queryKeys.tasks.all, 'assignee', assigneeId] as const,
  },

  business: {
    all: ['business'] as const,
    lists: () => [...queryKeys.business.all, 'list'] as const,
    list: (filters: BusinessListFilters) => [...queryKeys.business.lists(), filters] as const,
    details: () => [...queryKeys.business.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.business.details(), id] as const,
    types: ['business', 'types'] as const,
  },
  contacts: {
    all: ['contacts'] as const,
    lists: () => [...queryKeys.contacts.all, 'list'] as const,
    list: (filters: ContactListFilters) => [...queryKeys.contacts.lists(), filters] as const,
    details: () => [...queryKeys.contacts.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.contacts.details(), id] as const,
    roles: (contactId: string) => [...queryKeys.contacts.all, 'roles', contactId] as const,
  },
  crm: {
    all: ['crm', 'leads'] as const,
    lists: () => [...queryKeys.crm.all, 'list'] as const,
    list: (filters: LeadListFilters) => [...queryKeys.crm.lists(), filters] as const,
    details: () => [...queryKeys.crm.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.crm.details(), id] as const,
    stages: ['crm', 'lead-stages'] as const,
  },
  documents: {
    all: ['documents'] as const,
    lists: () => [...queryKeys.documents.all, 'list'] as const,
    list: (filters: DocumentListFilters) => [...queryKeys.documents.lists(), filters] as const,
    details: () => [...queryKeys.documents.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.documents.details(), id] as const,
    downloadUrl: (id: string) => [...queryKeys.documents.all, 'download-url', id] as const,
    templates: ['documents', 'templates'] as const,
    templatesList: (filters: DocumentTemplateListFilters) => [...queryKeys.documents.templates, filters] as const,
  },
  billing: {
    subscription: ['billing', 'subscription'] as const,
    plans: ['billing', 'plans'] as const,
    invoices: (filters: InvoiceListFilters) => ['billing', 'invoices', filters] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    lists: () => [...queryKeys.notifications.all, 'list'] as const,
    list: (filters: NotificationListFilters) => [...queryKeys.notifications.lists(), filters] as const,
    details: () => [...queryKeys.notifications.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notifications.details(), id] as const,
    preferences: ['notifications', 'preferences'] as const,
  },
  reports: {
    report: (type: ReportType, filters: ReportFilters) => ['reports', type, filters] as const,
  },
  whiteLabel: {
    branding: ['white-label', 'branding'] as const,
    domain: ['white-label', 'domain'] as const,
    publicBranding: (host: string) => ['white-label', 'public-branding', host] as const,
  },
  audit: {
    list: (filters: AuditLogFilters) => ['audit', 'logs', filters] as const,
    details: ['audit', 'logs', 'detail'] as const,
    detail: (id: string) => [...queryKeys.audit.details, id] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserListFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
    roles: (id: string) => [...queryKeys.users.all, 'roles', id] as const,
    sessions: (id: string) => [...queryKeys.users.all, 'sessions', id] as const,
  },
  roles: {
    all: ['roles'] as const,
    lists: () => [...queryKeys.roles.all, 'list'] as const,
    list: (filters: RoleListFilters) => [...queryKeys.roles.lists(), filters] as const,
    details: () => [...queryKeys.roles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.roles.details(), id] as const,
    users: (id: string) => [...queryKeys.roles.all, 'users', id] as const,
  },
  permissions: {
    list: ['permissions', 'list'] as const,
    groups: ['permissions', 'groups'] as const,
    matrix: (roleId: string) => ['permissions', 'matrix', roleId] as const,
  },
  settings: {
    firm: ['settings', 'firm'] as const,
    team: ['settings', 'team'] as const,
    integrations: ['settings', 'integrations'] as const,
  },
  compliance: {
    all: (moduleKey: ComplianceModuleKey) => ['compliance', moduleKey] as const,
    lists: (moduleKey: ComplianceModuleKey) => [...queryKeys.compliance.all(moduleKey), 'list'] as const,
    list: (moduleKey: ComplianceModuleKey, filters: ComplianceFilingListFilters) =>
      [...queryKeys.compliance.lists(moduleKey), filters] as const,
    details: (moduleKey: ComplianceModuleKey) => [...queryKeys.compliance.all(moduleKey), 'detail'] as const,
    detail: (moduleKey: ComplianceModuleKey, id: string) => [...queryKeys.compliance.details(moduleKey), id] as const,
  },
  // Client-facing billing (Invoices/Expenses/Payments to the firm's own clients) - distinct from
  // the `billing` section above, which is the tenant's own SaaS subscription billing.
  clientInvoices: {
    all: ['client-billing', 'invoices'] as const,
    lists: () => [...queryKeys.clientInvoices.all, 'list'] as const,
    list: (filters: ClientInvoiceListFilters) => [...queryKeys.clientInvoices.lists(), filters] as const,
    details: () => [...queryKeys.clientInvoices.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clientInvoices.details(), id] as const,
  },
  clientExpenses: {
    all: ['client-billing', 'expenses'] as const,
    lists: () => [...queryKeys.clientExpenses.all, 'list'] as const,
    list: (filters: ExpenseListFilters) => [...queryKeys.clientExpenses.lists(), filters] as const,
    details: () => [...queryKeys.clientExpenses.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clientExpenses.details(), id] as const,
  },
  clientPayments: {
    all: ['client-billing', 'payments'] as const,
    lists: () => [...queryKeys.clientPayments.all, 'list'] as const,
    list: (filters: PaymentListFilters) => [...queryKeys.clientPayments.lists(), filters] as const,
    details: () => [...queryKeys.clientPayments.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.clientPayments.details(), id] as const,
  },
  masterAdmin: {
    tenants: ['master-admin', 'tenants'] as const,
    tenantsList: (filters: TenantListFilters) => [...queryKeys.masterAdmin.tenants, filters] as const,
    tenantDetail: (id: string) => [...queryKeys.masterAdmin.tenants, 'detail', id] as const,
    plans: ['master-admin', 'plans'] as const,
  },
  clientPortal: {
    summary: ['client-portal', 'summary'] as const,
    documents: ['client-portal', 'documents'] as const,
    documentsList: (filters: SharedDocumentListFilters) => [...queryKeys.clientPortal.documents, filters] as const,
  },
  dashboard: {
    analyticsSummary: (filters: AnalyticsFilters) => ['dashboard', 'analytics-summary', filters] as const,
    revenueTrend: (filters: AnalyticsFilters) => ['dashboard', 'revenue-trend', filters] as const,
    clientGrowthTrend: (filters: AnalyticsFilters) => ['dashboard', 'client-growth-trend', filters] as const,
  },
} as const
