// TypeScript types and interfaces scoped to crm.
// Field shapes mirror the Lead/LeadSource/LeadStage/LeadActivity/LeadNote/LeadConversion Prisma
// models - the backend module is real and mounted (see api/index.ts), matching these shapes.

export type LeadActivityType = 'CALL' | 'MEETING' | 'EMAIL' | 'WHATSAPP' | 'SYSTEM_LOG'

export interface LeadSource {
  id: string
  name: string
}

export interface LeadStage {
  id: string
  name: string
  order: number
}

export interface Lead {
  id: string
  businessId: string | null
  contactId: string | null
  title: string
  sourceId: string
  stageId: string
  expectedRevenue: number | null
  probability: number | null
  expectedCloseDate: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadActivity {
  id: string
  leadId: string
  type: LeadActivityType
  description: string
  activityDate: string
  performedById: string
}

export interface LeadNote {
  id: string
  leadId: string
  content: string
  authorId: string
  createdAt: string
}

export interface LeadListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  stageId?: string
  sourceId?: string
}

export interface CreateLeadPayload {
  businessId?: string
  contactId?: string
  title: string
  sourceId: string
  stageId: string
  expectedRevenue?: number
  probability?: number
  expectedCloseDate?: string
}

export type UpdateLeadPayload = Partial<CreateLeadPayload>

export interface ConvertLeadPayload {
  leadId: string
  notes?: string
}
