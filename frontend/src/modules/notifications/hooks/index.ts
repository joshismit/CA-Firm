// notifications-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  getNotificationPreferences,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  updateNotificationPreference,
} from '../api'
import type { NotificationListFilters, NotificationPreference } from '../types'

export function useNotificationsQuery(filters: NotificationListFilters) {
  return useQuery({ queryKey: queryKeys.notifications.list(filters), queryFn: () => listNotifications(filters) })
}

export function useNotificationPreferencesQuery() {
  return useQuery({ queryKey: queryKeys.notifications.preferences, queryFn: getNotificationPreferences })
}

export function useMarkNotificationAsReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() }),
  })
}

export function useMarkAllNotificationsAsReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() }),
  })
}

export function useUpdateNotificationPreferenceMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: NotificationPreference) => updateNotificationPreference(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.preferences }),
  })
}
