// notifications-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  deleteNotification,
  getNotification,
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

export function useNotificationQuery(id: string) {
  return useQuery({ queryKey: queryKeys.notifications.detail(id), queryFn: () => getNotification(id), enabled: !!id })
}

// retry: false - getNotificationPreferences has no backend counterpart yet (out of scope for the
// Notifications backend module - see api/index.ts's header comment), so a 501 NOT_IMPLEMENTED will
// never succeed on retry.
export function useNotificationPreferencesQuery() {
  return useQuery({ queryKey: queryKeys.notifications.preferences, queryFn: getNotificationPreferences, retry: false })
}

export function useMarkNotificationAsReadMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notifications.lists() }),
  })
}

export function useDeleteNotificationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
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
