// projects API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/projects (backend/src/modules/projects/routes/project.routes.ts) -
// one of only two modules with a real implemented API today.

import { apiClient } from '@/services/axios'
import type { ApiResponse, PaginatedResponse } from '@/types/api.types'
import type {
  CreateProjectPayload,
  Project,
  ProjectListFilters,
  UpdateProjectPayload,
  UpdateProjectStatusPayload,
} from '../types'

export async function listProjects(filters: ProjectListFilters): Promise<PaginatedResponse<Project>> {
  const { data } = await apiClient.get<PaginatedResponse<Project>>('/projects', { params: filters })
  return data
}

export async function getProject(id: string): Promise<Project> {
  const { data } = await apiClient.get<ApiResponse<Project>>(`/projects/${id}`)
  return data.data
}

export async function getOverdueProjects(): Promise<Project[]> {
  const { data } = await apiClient.get<ApiResponse<Project[]>>('/projects/overdue')
  return data.data
}

export async function getProjectsByClient(clientId: string): Promise<Project[]> {
  const { data } = await apiClient.get<ApiResponse<Project[]>>(`/projects/client/${clientId}`)
  return data.data
}

export async function createProject(payload: CreateProjectPayload): Promise<Project> {
  const { data } = await apiClient.post<ApiResponse<Project>>('/projects', payload)
  return data.data
}

export async function updateProject(id: string, payload: UpdateProjectPayload): Promise<Project> {
  const { data } = await apiClient.patch<ApiResponse<Project>>(`/projects/${id}`, payload)
  return data.data
}

export async function updateProjectStatus(id: string, payload: UpdateProjectStatusPayload): Promise<Project> {
  const { data } = await apiClient.patch<ApiResponse<Project>>(`/projects/${id}/status`, payload)
  return data.data
}

export async function archiveProject(id: string): Promise<Project> {
  const { data } = await apiClient.post<ApiResponse<Project>>(`/projects/${id}/archive`)
  return data.data
}

export async function restoreProject(id: string): Promise<Project> {
  const { data } = await apiClient.post<ApiResponse<Project>>(`/projects/${id}/restore`)
  return data.data
}

export async function deleteProject(id: string): Promise<void> {
  await apiClient.delete(`/projects/${id}`)
}
