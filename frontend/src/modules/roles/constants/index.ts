// roles-scoped constants (enums, option lists, default values).
// The PRD's fixed role list (CA/HR/Accountant/Auditor/Client) is intended to be seeded as
// RoleType.SYSTEM rows server-side, not hardcoded here - the ACL layer must never branch on
// role name (see hooks/use-permission.ts), so this file only documents the expected system roles.

export const SYSTEM_ROLE_NAMES = ['CA', 'HR', 'Accountant', 'Auditor', 'Client'] as const

export const ROLE_TYPE_LABELS: Record<string, string> = {
  SYSTEM: 'System',
  CUSTOM: 'Custom',
}
