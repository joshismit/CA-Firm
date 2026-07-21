/**
 * Permission action enum.
 * Defines what actions a user can perform on a resource.
 */
export enum PermissionAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  EXPORT = 'export',
  IMPORT = 'import',
  APPROVE = 'approve',
  MANAGE = 'manage',     // Full control (admin only)
}

/**
 * Permission resource enum.
 * Maps to each feature module.
 */
export enum PermissionResource {
  USERS = 'users',
  ROLES = 'roles',
  CLIENTS = 'clients',
  CONTACTS = 'contacts',
  DOCUMENTS = 'documents',
  TASKS = 'tasks',
  PROJECTS = 'projects',
  CRM = 'crm',
  BILLING = 'billing',
  REPORTS = 'reports',
  AUDIT_LOGS = 'audit_logs',
  SETTINGS = 'settings',
  NOTIFICATIONS = 'notifications',
  BUSINESS = 'business',
  SUBSCRIPTIONS = 'subscriptions',
}
