// TypeScript types and interfaces scoped to projects.
// Matches backend/src/modules/projects exactly (routes/project.routes.ts, dto/*.res.dto.ts).

export type ProjectStatus = 'DRAFT' | 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED' | 'CANCELLED'

export interface Project {
  id: string
  code: string
  name: string
  status: ProjectStatus
  clientId: string
  managerId: string | null
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  archivedAt: string | null
  isOverdue: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: ProjectStatus
  clientId?: string
  managerId?: string
  dueBefore?: string
  dueAfter?: string
}

export interface CreateProjectPayload {
  clientId: string
  managerId?: string
  code: string
  name: string
  startDate?: string
  dueDate?: string
}

export interface UpdateProjectPayload {
  managerId?: string | null
  name?: string
  startDate?: string | null
  dueDate?: string | null
}

export interface UpdateProjectStatusPayload {
  status: ProjectStatus
  reason?: string
}
