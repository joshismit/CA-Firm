// calendar-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvent,
  getCalendarItems,
  updateCalendarEvent,
} from '../api'
import type { CalendarQueryFilters, CreateCalendarEventPayload, UpdateCalendarEventPayload } from '../types'

export function useCalendarItemsQuery(filters: CalendarQueryFilters) {
  return useQuery({
    queryKey: queryKeys.calendar.items(filters),
    queryFn: () => getCalendarItems(filters),
    placeholderData: keepPreviousData,
  })
}

export function useCalendarEventQuery(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.calendar.eventDetail(id ?? ''),
    queryFn: () => getCalendarEvent(id as string),
    enabled: !!id,
  })
}

export function useCreateCalendarEventMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateCalendarEventPayload) => createCalendarEvent(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendar.all }),
  })
}

export function useUpdateCalendarEventMutation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateCalendarEventPayload) => updateCalendarEvent(id, payload),
    onSuccess: (updated) => {
      qc.setQueryData(queryKeys.calendar.eventDetail(id), updated)
      qc.invalidateQueries({ queryKey: queryKeys.calendar.all })
    },
  })
}

export function useDeleteCalendarEventMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.calendar.all }),
  })
}
