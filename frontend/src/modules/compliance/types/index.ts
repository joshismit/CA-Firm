// TypeScript types shared by all four Compliance areas (GST Returns, ITR, TDS/26Q, MCA/ROC).
//
// NOT YET AVAILABLE: there is no backend module, Prisma model, or permission resource for any of
// gst/itr/tds/mca (backend/src/app.ts mounts only auth/business/contacts/crm/documents/projects/
// tasks; backend/src/shared/enums/permission.enum.ts has no GST/ITR/TDS/MCA resource either). GST,
// ITR, TDS, and MCA filings are, in reality, four quite different domains (different real-world
// identifiers, periods, and filing rules) - this file deliberately does NOT invent domain-specific
// fields (no "gstin", "assessmentYear", "form26Q", etc.) for any of them. It defines one generic,
// clearly-provisional "filing tracker" shape (reference/period/status/dueDate/notes) common to any
// of the four, per explicit product direction, until each area's real backend contract exists -
// at that point this generic type should be split into four real, module-specific ones.

export type ComplianceModuleKey = 'gst' | 'itr' | 'tds' | 'mca'

export type ComplianceFilingStatus = 'DRAFT' | 'PENDING' | 'FILED' | 'OVERDUE'

export interface ComplianceFiling {
  id: string
  reference: string
  period: string
  status: ComplianceFilingStatus
  dueDate: string | null
  filedDate: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ComplianceFilingListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: ComplianceFilingStatus
}

export interface CreateComplianceFilingPayload {
  reference: string
  period: string
  dueDate?: string
  notes?: string
}

export type UpdateComplianceFilingPayload = Partial<CreateComplianceFilingPayload>
