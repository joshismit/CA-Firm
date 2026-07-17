/**
 * User role enum.
 * Defines the role hierarchy in the system.
 */
export enum UserRole {
  MASTER_ADMIN = 'MASTER_ADMIN',     // Platform-level admin (across all tenants)
  TENANT_ADMIN = 'TENANT_ADMIN',     // Admin of a single CA firm tenant
  MANAGER = 'MANAGER',               // Senior CA / Manager
  STAFF = 'STAFF',                   // Junior staff
  CLIENT = 'CLIENT',                 // External client portal user
}

/**
 * User status enum.
 */
export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
}
