// business-scoped constants (enums, option lists, default values).
// Business types are actually a seeded DB table (BusinessType), not a hardcoded enum - this list
// is a client-side reference matching the PRD's type list until a real business-types endpoint exists.

export const BUSINESS_STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  DORMANT: 'Dormant',
  STRUCK_OFF: 'Struck Off',
  DISSOLVED: 'Dissolved',
}

export const BUSINESS_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'PROPRIETORSHIP', label: 'Proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'LLP', label: 'LLP' },
  { value: 'PRIVATE_LIMITED', label: 'Private Limited' },
  { value: 'PUBLIC_LIMITED', label: 'Public Limited' },
  { value: 'OPC', label: 'One Person Company' },
  { value: 'TRUST', label: 'Trust' },
  { value: 'SOCIETY', label: 'Society' },
  { value: 'NGO', label: 'NGO / Section 8 Company' },
  { value: 'HUF', label: 'HUF' },
  { value: 'OTHER', label: 'Other' },
] as const
