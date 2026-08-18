// tasks API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/tasks (backend/src/modules/tasks/routes/task.routes.ts) -
// one of only two modules with a real implemented API today.
//
// NOTE: unlike Projects, Task restore is PATCH (not POST), and there is no archive endpoint or
// ARCHIVED status for tasks at all.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  AssignableStaffMember,
  AssignableStaffQuery,
  CreateTaskPayload,
  Task,
  TaskListFilters,
  UpdateTaskPayload,
  UpdateTaskStatusPayload,
} from '../types'

export async function listTasks(filters: TaskListFilters): Promise<PaginatedResponse<Task>> {
  const { data } = await apiClient.get<PaginatedResponse<Task>>('/tasks', { params: filters })
  return data
}

export async function getTask(id: string): Promise<Task> {
  const { data } = await apiClient.get<ApiResponse<Task>>(`/tasks/${id}`)
  return data.data
}

export async function getOverdueTasks(): Promise<Task[]> {
  const { data } = await apiClient.get<ApiResponse<Task[]>>('/tasks/overdue')
  return data.data
}

export async function getTasksByProject(projectId: string): Promise<Task[]> {
  const { data } = await apiClient.get<ApiResponse<Task[]>>(`/tasks/project/${projectId}`)
  return data.data
}

export async function getTasksByAssignee(assigneeId: string): Promise<Task[]> {
  const { data } = await apiClient.get<ApiResponse<Task[]>>(`/tasks/assignee/${assigneeId}`)
  return data.data
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const { data } = await apiClient.post<ApiResponse<Task>>('/tasks', payload)
  return data.data
}

export async function updateTask(id: string, payload: UpdateTaskPayload): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}`, payload)
  return data.data
}

export async function updateTaskStatus(id: string, payload: UpdateTaskStatusPayload): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/status`, payload)
  return data.data
}

/**
 * Assign/reassign via the dedicated PRD §9 endpoint (permission tasks:assign), distinct from
 * `updateTask({ assigneeId })` (permission tasks:update) - the CLIENT role is granted the former
 * but not the latter, so the client-portal assignee picker must call this, not updateTask().
 */
export async function assignTask(id: string, assigneeId: string): Promise<Task> {
  const { data } = await apiClient.post<ApiResponse<Task>>(`/tasks/${id}/assign`, { assigneeId })
  return data.data
}

/** Staff eligible to be assigned a task, scoped to the caller's own client (CLIENT users) or the given business/client (staff). */
export async function getAssignableStaff(query: AssignableStaffQuery = {}): Promise<AssignableStaffMember[]> {
  const { data } = await apiClient.get<ApiResponse<AssignableStaffMember[]>>('/tasks/assignable-staff', { params: query })
  return data.data
}

export async function restoreTask(id: string): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/restore`)
  return data.data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`)
}
