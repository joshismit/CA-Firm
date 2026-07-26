// Centralized TanStack Query key factory to keep cache keys consistent and collision-free across modules.
// Extend this object as each module's hooks/index.ts is built - never hand-roll a query key inline.

import type { ProjectListFilters } from '@/modules/projects/types'
import type { TaskListFilters } from '@/modules/tasks/types'

export const queryKeys = {
  projects: {
    all: ['projects'] as const,
    lists: () => [...queryKeys.projects.all, 'list'] as const,
    list: (filters: ProjectListFilters) => [...queryKeys.projects.lists(), filters] as const,
    details: () => [...queryKeys.projects.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.projects.details(), id] as const,
    overdue: () => [...queryKeys.projects.all, 'overdue'] as const,
    byClient: (clientId: string) => [...queryKeys.projects.all, 'client', clientId] as const,
    byManager: (managerId: string) => [...queryKeys.projects.all, 'manager', managerId] as const,
    byCode: (code: string) => [...queryKeys.projects.all, 'code', code] as const,
  },
  tasks: {
    all: ['tasks'] as const,
    lists: () => [...queryKeys.tasks.all, 'list'] as const,
    list: (filters: TaskListFilters) => [...queryKeys.tasks.lists(), filters] as const,
    details: () => [...queryKeys.tasks.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.tasks.details(), id] as const,
    overdue: () => [...queryKeys.tasks.all, 'overdue'] as const,
    byProject: (projectId: string) => [...queryKeys.tasks.all, 'project', projectId] as const,
    byAssignee: (assigneeId: string) => [...queryKeys.tasks.all, 'assignee', assigneeId] as const,
  },
} as const
