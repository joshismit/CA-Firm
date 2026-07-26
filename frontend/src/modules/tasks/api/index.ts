// tasks API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/tasks (backend/src/modules/tasks/routes/task.routes.ts) -
// one of only two modules with a real implemented API today.
//
// NOTE: unlike Projects, Task restore is PATCH (not POST), and there is no archive endpoint or
// ARCHIVED status for tasks at all.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
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

export async function restoreTask(id: string): Promise<Task> {
  const { data } = await apiClient.patch<ApiResponse<Task>>(`/tasks/${id}/restore`)
  return data.data
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`)
}
