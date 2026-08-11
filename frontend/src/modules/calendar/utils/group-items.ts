// Groups CalendarItems onto calendar-grid day cells. See this file's `dayKeyForItem` comment for
// the timezone reasoning - the one place in this module an off-by-one-day bug would otherwise creep in.
import type { CalendarItem } from '../types'

function localDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function utcDateKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

/**
 * The calendar-grid day cell an item belongs on. All-day items (Tasks) use their UTC date
 * components - `Task.dueDate` is stored as UTC midnight representing a specific calendar day
 * regardless of viewer timezone (mirrors the backend's own UTC-day-boundary convention, see
 * `TaskReminderService`). Timed items (CalendarEvents) use local date components - a specific
 * instant legitimately falls on whichever local day the viewer is in.
 */
export function dayKeyForItem(item: CalendarItem): string | null {
  const raw = item.startAt ?? item.endAt
  if (!raw) return null
  const date = new Date(raw)
  return item.allDay ? utcDateKey(date) : localDateKey(date)
}

export function dayKeyForDate(date: Date): string {
  return localDateKey(date)
}

export function groupItemsByDay(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const key = dayKeyForItem(item)
    if (!key) continue
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  for (const list of map.values()) {
    list.sort((a, b) => {
      const aTime = a.startAt ? new Date(a.startAt).getTime() : 0
      const bTime = b.startAt ? new Date(b.startAt).getTime() : 0
      return aTime - bTime
    })
  }
  return map
}
