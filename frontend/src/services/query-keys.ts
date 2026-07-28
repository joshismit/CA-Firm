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
import type { DocumentListFilters } from '@/modules/documents/types'
import type { InvoiceListFilters } from '@/modules/billing/types'
import type { NotificationListFilters } from '@/modules/notifications/types'
import type { ReportFilters, ReportType } from '@/modules/reports/types'
import type { AuditLogFilters } from '@/modules/audit/types'
import type { UserListFilters } from '@/modules/users/types'
import type { RoleListFilters } from '@/modules/roles/types'

export const queryKeys = {
  // No GET-based session/profile query exists yet (login is a mutation) - reserved for when a
  // real /auth/me endpoint lands.
  auth: {
    session: ['auth', 'session'] as const,
  },

  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: ProjectListFilters) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    overdue: () => [...queryKeys.projects.all, 'overdue'] as const,
    byClient: (clientId: string) => [...queryKeys.projects.all, 'client', clientId] as const,
    byManager: (managerId: string) => [...queryKeys.projects.all, 'manager', managerId] as const,
    byCode: (code: string) => [...queryKeys.projects.all, 'code', code] as const,
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
    preferences: ['notifications', 'preferences'] as const,
  },
  reports: {
    report: (type: ReportType, filters: ReportFilters) => ['reports', type, filters] as const,
  },
  audit: {
    list: (filters: AuditLogFilters) => ['audit', 'logs', filters] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => [...queryKeys.users.all, 'list'] as const,
    list: (filters: UserListFilters) => [...queryKeys.users.lists(), filters] as const,
    details: () => [...queryKeys.users.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.users.details(), id] as const,
  },
  roles: {
    all: ['roles'] as const,
    lists: () => [...queryKeys.roles.all, 'list'] as const,
    list: (filters: RoleListFilters) => [...queryKeys.roles.lists(), filters] as const,
    details: () => [...queryKeys.roles.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.roles.details(), id] as const,
  },
  permissions: {
    list: ['permissions', 'list'] as const,
    groups: ['permissions', 'groups'] as const,
    matrix: (roleId: string) => ['permissions', 'matrix', roleId] as const,
  },
} as const
