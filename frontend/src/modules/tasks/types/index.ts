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
  dueBefore?: string
  dueAfter?: string
}

export interface CreateTaskPayload {
  title: string
  description?: string
  projectId?: string
  assigneeId?: string
  startDate?: string
  dueDate?: string
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
