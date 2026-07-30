// master-admin-scoped constants (enums, option lists, default values).
import type { TenantStatus } from '../types'

export const TENANT_STATUS_LABELS: Record<TenantStatus, string> = {
  ACTIVE: 'Active',
  TRIAL: 'Trial',
  SUSPENDED: 'Suspended',
  CANCELLED: 'Cancelled',
}
