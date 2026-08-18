// Work Calendar API request functions, built on the shared Axios instance from src/services/axios.ts.
// Hits the real backend at ${env.apiBaseUrl}/calendar (backend/src/modules/calendar/routes/calendar.routes.ts).

import { apiClient } from '@/services/axios'
import type { ApiResponse } from '@/types/api.types'
import type {
  CalendarEvent,
  CalendarItem,
  CalendarQueryFilters,
  CreateCalendarEventPayload,
  UpdateCalendarEventPayload,
} from '../types'

export async function getCalendarItems(filters: CalendarQueryFilters): Promise<CalendarItem[]> {
  const { data } = await apiClient.get<ApiResponse<{ items: CalendarItem[] }>>('/calendar', { params: filters })
  return data.data.items
}

export async function createCalendarEvent(payload: CreateCalendarEventPayload): Promise<CalendarEvent> {
  const { data } = await apiClient.post<ApiResponse<CalendarEvent>>('/calendar/events', payload)
  return data.data
}

export async function getCalendarEvent(id: string): Promise<CalendarEvent> {
  const { data } = await apiClient.get<ApiResponse<CalendarEvent>>(`/calendar/events/${id}`)
  return data.data
}

export async function updateCalendarEvent(id: string, payload: UpdateCalendarEventPayload): Promise<CalendarEvent> {
  const { data } = await apiClient.patch<ApiResponse<CalendarEvent>>(`/calendar/events/${id}`, payload)
  return data.data
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  await apiClient.delete(`/calendar/events/${id}`)
}
