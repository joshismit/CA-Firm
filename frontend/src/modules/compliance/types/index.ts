// TypeScript types shared by all four Compliance areas (GST Returns, ITR, TDS/26Q, MCA/ROC).
//
// Field shapes mirror backend/src/modules/compliance/dto/compliance-filing.res.dto.ts exactly - one
// generic `ComplianceFiling` backend model/module, mounted once per category at /gst, /itr, /tds,
// /mca (backend/src/app.ts). There is still no dedicated compliance permission resource in either
// backend/src/shared/enums/permission.enum.ts or config/permissions.config.ts - by explicit product
// decision, these routes are reachable by any authenticated tenant user (auth + tenant scoping
// only), matching this module's ungated <Can>-free UI. GST, ITR, TDS, and MCA filings are, in
// reality, four quite different domains (different real-world identifiers, periods, and filing
// rules) - this file deliberately does NOT invent domain-specific fields (no "gstin",
// "assessmentYear", "form26Q", etc.) for any of them. It defines one generic "filing tracker" shape
// (reference/period/status/dueDate/notes) common to any of the four, per explicit product
// direction - `status`/`filedDate` are stored server-side but not yet settable via this API (no
// status-transition endpoint exists, since no form in this module ever collects one). Splitting
// this into four real, module-specific types remains future work once each area's real domain
// requirements land.

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
