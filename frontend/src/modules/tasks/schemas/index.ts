// Zod schemas for tasks forms and API payload/response validation.
// Mirrors backend/src/modules/tasks/schemas exactly.

import { z } from 'zod'

const taskTitle = z.string().trim().min(2, 'Title must be at least 2 characters').max(255)

export const createTaskSchema = z.object({
  title: taskTitle,
  description: z.string().trim().max(2000).optional(),
  projectId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
})

export const updateTaskSchema = z.object({
  title: taskTitle.optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
  startDate: z.coerce.date().nullable().optional(),
  dueDate: z.coerce.date().nullable().optional(),
})

export const taskStatusValues = ['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'CANCELLED'] as const

export const updateTaskStatusSchema = z.object({
  status: z.enum(taskStatusValues),
})

export type CreateTaskFormValues = z.infer<typeof createTaskSchema>
export type UpdateTaskFormValues = z.infer<typeof updateTaskSchema>
export type UpdateTaskStatusFormValues = z.infer<typeof updateTaskStatusSchema>
