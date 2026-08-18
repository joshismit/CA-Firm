// projects-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  archiveProject,
  createProject,
  deleteProject,
  getOverdueProjects,
  getProject,
  getProjectsByClient,
  listProjects,
  restoreProject,
  updateProject,
  updateProjectStatus,
} from '../api'
import type {
  CreateProjectPayload,
  ProjectListFilters,
  UpdateProjectPayload,
  UpdateProjectStatusPayload,
} from '../types'

export function useProjectsQuery(filters: ProjectListFilters) {
  return useQuery({
    queryKey: queryKeys.projects.list(filters),
    queryFn: () => listProjects(filters),
    placeholderData: keepPreviousData,
  })
}

export function useProjectQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: () => getProject(id),
    enabled: !!id,
  })
}

export function useOverdueProjectsQuery() {
  return useQuery({
    queryKey: queryKeys.projects.overdue(),
    queryFn: getOverdueProjects,
  })
}

export function useProjectsByClientQuery(clientId: string) {
  return useQuery({
    queryKey: queryKeys.projects.byClient(clientId),
    queryFn: () => getProjectsByClient(clientId),
    enabled: !!clientId,
  })
}

export function useCreateProjectMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) => createProject(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.lists() }),
  })
}

export function useUpdateProjectMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateProjectPayload) => updateProject(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.projects.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.projects.lists() })
    },
  })
}

export function useUpdateProjectStatusMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateProjectStatusPayload) => updateProjectStatus(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.projects.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.projects.lists() })
    },
  })
}

export function useArchiveProjectMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => archiveProject(id),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.projects.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.projects.lists() })
    },
  })
}

export function useRestoreProjectMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => restoreProject(id),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.projects.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.projects.lists() })
    },
  })
}

export function useDeleteProjectMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects.lists() }),
  })
}
