// contacts-scoped constants (enums, option lists, default values).

export const CONTACT_ROLE_LABELS: Record<string, string> = {
  OWNER: 'Owner',
  DIRECTOR: 'Director',
  PARTNER: 'Partner',
  AUTHORIZED_SIGNATORY: 'Authorized Signatory',
  ACCOUNTANT: 'Accountant',
  AUDITOR: 'Auditor',
  EMPLOYEE: 'Employee',
  CLIENT_REPRESENTATIVE: 'Client Representative',
  EMERGENCY_CONTACT: 'Emergency Contact',
  OTHER: 'Other',
}

export const CONTACT_ROLE_OPTIONS = Object.entries(CONTACT_ROLE_LABELS).map(([value, label]) => ({ value, label }))
