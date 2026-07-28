// Zod schemas for crm forms and API payload/response validation.

import { z } from 'zod'

export const leadActivityTypeValues = ['CALL', 'MEETING', 'EMAIL', 'WHATSAPP', 'SYSTEM_LOG'] as const

export const createLeadSchema = z.object({
  businessId: z.string().uuid().optional(),
  contactId: z.string().uuid().optional(),
  title: z.string().trim().min(2, 'Title must be at least 2 characters').max(255),
  sourceId: z.string().uuid('Select a lead source'),
  stageId: z.string().uuid('Select a stage'),
  expectedRevenue: z.coerce.number().min(0).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional(),
})

export const updateLeadSchema = createLeadSchema.partial()

export const convertLeadSchema = z.object({
  leadId: z.string().uuid(),
  notes: z.string().trim().max(1000).optional(),
})

export const createLeadNoteSchema = z.object({
  content: z.string().trim().min(1, 'Note cannot be empty').max(2000),
})

export type CreateLeadFormValues = z.infer<typeof createLeadSchema>
export type UpdateLeadFormValues = z.infer<typeof updateLeadSchema>
export type ConvertLeadFormValues = z.infer<typeof convertLeadSchema>
