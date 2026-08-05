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
  SHARE = 'share',
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
  /** SaaS subscription billing (tenant → ERP vendor) — NOT the firm's client-facing billing. */
  BILLING = 'billing',
  /** The firm's client-facing billing (Invoices/Expenses/Payments to its own clients) — a separate domain from BILLING above. */
  CLIENT_BILLING = 'client_billing',
  REPORTS = 'reports',
  AUDIT_LOGS = 'audit_logs',
  SETTINGS = 'settings',
  NOTIFICATIONS = 'notifications',
  BUSINESS = 'business',
  SUBSCRIPTIONS = 'subscriptions',
}
