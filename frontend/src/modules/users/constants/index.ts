// users-scoped constants (enums, option lists, default values).

export const USER_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  INVITED: 'Invited',
  SUSPENDED: 'Suspended',
  DELETED: 'Deleted',
}

export const INVITATION_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  EXPIRED: 'Expired',
  REVOKED: 'Revoked',
}
