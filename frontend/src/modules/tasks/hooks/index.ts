// tasks-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  assignTask,
  createTask,
  deleteTask,
  getAssignableStaff,
  getOverdueTasks,
  getTask,
  getTasksByAssignee,
  getTasksByProject,
  listTasks,
  restoreTask,
  updateTask,
  updateTaskStatus,
} from '../api'
import type {
  AssignableStaffQuery,
  CreateTaskPayload,
  TaskListFilters,
  UpdateTaskPayload,
  UpdateTaskStatusPayload,
} from '../types'

export function useTasksQuery(filters: TaskListFilters) {
  return useQuery({
    queryKey: queryKeys.tasks.list(filters),
    queryFn: () => listTasks(filters),
    placeholderData: keepPreviousData,
  })
}

export function useTaskQuery(id: string) {
  return useQuery({
    queryKey: queryKeys.tasks.detail(id),
    queryFn: () => getTask(id),
    enabled: !!id,
  })
}

export function useOverdueTasksQuery() {
  return useQuery({
    queryKey: queryKeys.tasks.overdue(),
    queryFn: getOverdueTasks,
  })
}

export function useTasksByProjectQuery(projectId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.byProject(projectId),
    queryFn: () => getTasksByProject(projectId),
    enabled: !!projectId,
  })
}

export function useTasksByAssigneeQuery(assigneeId: string) {
  return useQuery({
    queryKey: queryKeys.tasks.byAssignee(assigneeId),
    queryFn: () => getTasksByAssignee(assigneeId),
    enabled: !!assigneeId,
  })
}

export function useCreateTaskMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => createTask(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() }),
  })
}

export function useUpdateTaskMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTaskPayload) => updateTask(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tasks.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
    },
  })
}

/** PRD §9 - assigns/reassigns via the dedicated tasks:assign endpoint, not updateTask() (tasks:update). */
export function useAssignTaskMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (assigneeId: string) => assignTask(id, assigneeId),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tasks.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
    },
  })
}

export function useAssignableStaffQuery(query: AssignableStaffQuery = {}) {
  return useQuery({
    queryKey: queryKeys.tasks.assignableStaff(query),
    queryFn: () => getAssignableStaff(query),
  })
}

export function useUpdateTaskStatusMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTaskStatusPayload) => updateTaskStatus(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tasks.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
    },
  })
}

export function useRestoreTaskMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => restoreTask(id),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.tasks.detail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() })
    },
  })
}

export function useDeleteTaskMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tasks.lists() }),
  })
}
