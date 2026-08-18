// TypeScript types and interfaces scoped to contacts.
// Field shapes mirror the Contact/ContactRole/ContactAddress Prisma models - no backend routes
// are mounted for this module yet, so these describe the eventual API contract only.

export type ContactRoleType =
  | 'OWNER'
  | 'DIRECTOR'
  | 'PARTNER'
  | 'AUTHORIZED_SIGNATORY'
  | 'ACCOUNTANT'
  | 'AUDITOR'
  | 'EMPLOYEE'
  | 'CLIENT_REPRESENTATIVE'
  | 'EMERGENCY_CONTACT'
  | 'OTHER'

export interface Contact {
  id: string
  firstName: string
  lastName: string | null
  email: string | null
  phone: string | null
  pan: string | null
  /** Set once this contact has been granted portal login access - optional per the PRD. */
  portalUserId: string | null
  createdAt: string
  updatedAt: string
}

export interface ContactRole {
  id: string
  businessId: string
  contactId: string
  roleType: ContactRoleType
  customTitle: string | null
  isPrimary: boolean
  sharePercent: number | null
}

export interface ContactListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  businessId?: string
}

export interface CreateContactPayload {
  firstName: string
  lastName?: string
  email?: string
  phone?: string
  pan?: string
}

export type UpdateContactPayload = Partial<CreateContactPayload>

export interface AssignContactRolePayload {
  businessId: string
  contactId: string
  roleType: ContactRoleType
  customTitle?: string
  isPrimary?: boolean
  sharePercent?: number
}
