// TypeScript types and interfaces scoped to business.
// Field shapes mirror the Business/BusinessType/BusinessAddress/BusinessRegistration Prisma
// models (backend/prisma/schema.prisma) - the backend has no mounted routes for this module yet,
// so these types describe the eventual API contract, not a currently-callable one.

export type BusinessStatus = 'ACTIVE' | 'INACTIVE' | 'DORMANT' | 'STRUCK_OFF' | 'DISSOLVED'

export type AddressType = 'REGISTERED' | 'CORPORATE' | 'BRANCH' | 'FACTORY' | 'RESIDENTIAL' | 'OTHER'

export interface BusinessType {
  id: string
  code: string
  name: string
  description?: string | null
  isActive: boolean
}

export interface Business {
  id: string
  typeId: string
  name: string
  legalName: string | null
  status: BusinessStatus
  pan: string | null
  gstin: string | null
  cin: string | null
  incorporationDate: string | null
  financialYearStart: number
  industry: string | null
  /** PRD §7.4 — per-business storage quota override in MB; null inherits the tenant's default. */
  storageQuotaMb: number | null
  /** PRD §7.4 — live usage summary. Only present on `GET /business/:id`, omitted from the list endpoint. */
  storageUsage?: BusinessStorageUsage
  createdAt: string
  updatedAt: string
}

export interface BusinessStorageUsage {
  usedBytes: number
  quotaBytes: number
  remainingBytes: number
}

export interface BusinessAddress {
  id: string
  businessId: string
  type: AddressType
  isPrimary: boolean
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string
  pincode: string
  country: string
}

export interface BusinessRegistration {
  id: string
  businessId: string
  registrationType: string
  registrationNum: string
  issueDate: string | null
}

export interface BusinessListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  typeId?: string
  status?: BusinessStatus
}

export interface CreateBusinessPayload {
  typeId: string
  name: string
  legalName?: string
  pan?: string
  gstin?: string
  cin?: string
  incorporationDate?: string
  financialYearStart?: number
  industry?: string
}

export type UpdateBusinessPayload = Partial<Omit<CreateBusinessPayload, 'typeId'>> & {
  /** PRD §7.4 — set to override, or `null` to revert to the tenant's default quota. */
  storageQuotaMb?: number | null
}
