// TypeScript types and interfaces scoped to tasks.
// Matches backend/src/modules/tasks exactly (routes/task.routes.ts, dto/*.res.dto.ts).

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'CANCELLED'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  projectId: string | null
  assigneeId: string | null
  createdBy: string | null
  /** The client this task belongs to - set server-side for client-portal-created tasks, never trust a client-supplied value. */
  clientId: string | null
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  isOverdue: boolean
  isCompleted: boolean
  createdAt: string
  updatedAt: string
}

export interface TaskListFilters {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  search?: string
  status?: TaskStatus
  projectId?: string
  assigneeId?: string
  clientId?: string
  dueBefore?: string
  dueAfter?: string
}

export interface CreateTaskPayload {
  title: string
  description?: string
  projectId?: string
  assigneeId?: string
  /** Only honored for a staff caller - a CLIENT caller's own client is always resolved server-side, this field is ignored for them. */
  clientId?: string
  startDate?: string
  dueDate?: string
}

/** `GET /tasks/assignable-staff` - eligible assignees for a task, scoped to the caller's own client (for CLIENT users) or the given business/client (for staff). */
export interface AssignableStaffQuery {
  businessId?: string
  clientId?: string
}

export interface AssignableStaffMember {
  id: string
  firstName: string
  lastName: string | null
  email: string
}

export interface UpdateTaskPayload {
  title?: string
  description?: string | null
  projectId?: string | null
  assigneeId?: string | null
  startDate?: string | null
  dueDate?: string | null
}

export interface UpdateTaskStatusPayload {
  status: TaskStatus
}
