// Zod schemas for projects forms and API payload/response validation.
// Mirrors backend/src/modules/projects/schemas exactly, plus a client-side .refine() for
// instant feedback on the reason-required rule (the server's 422 remains the source of truth).

import { z } from 'zod'

const projectCode = z
  .string()
  .trim()
  .min(2, 'Code must be at least 2 characters')
  .max(50, 'Code must be at most 50 characters')
  .regex(/^[A-Za-z0-9\-/_.]+$/, 'Code may only contain letters, numbers, and - / _ . characters')

const projectName = z.string().trim().min(2, 'Name must be at least 2 characters').max(255)

export const createProjectSchema = z.object({
  clientId: z.string().uuid('Select a client'),
  managerId: z.string().uuid().optional(),
  code: projectCode,
  name: projectName,
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
})

export const updateProjectSchema = z.object({
  managerId: z.string().uuid().nullable().optional(),
  name: projectName.optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
})

export const projectStatusValues = [
  'DRAFT',
  'PLANNED',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
] as const

export const updateProjectStatusSchema = z
  .object({
    status: z.enum(projectStatusValues),
    reason: z.string().trim().min(3).max(500).optional(),
  })
  .refine((data) => !(['ON_HOLD', 'CANCELLED'].includes(data.status) && !data.reason), {
    message: 'A reason is required when moving to On Hold or Cancelled',
    path: ['reason'],
  })

export type CreateProjectFormValues = z.infer<typeof createProjectSchema>
export type UpdateProjectFormValues = z.infer<typeof updateProjectSchema>
export type UpdateProjectStatusFormValues = z.infer<typeof updateProjectStatusSchema>
