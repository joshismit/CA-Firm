// src/modules/calendar/components/AgendaView.tsx
// Flat, day-grouped list across the visible range - the mobile-friendly view (PRD §13).
import { isToday } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'
import { getGridDays } from '../utils/date-range'
import { groupItemsByDay, dayKeyForDate } from '../utils/group-items'
import { CalendarItemRow } from './CalendarItemRow'
import type { CalendarItem, CalendarView } from '../types'

export interface AgendaViewProps {
  anchorDate: Date
  items: CalendarItem[]
  onSelectEvent: (eventId: string) => void
}

const AGENDA_VIEW: CalendarView = 'agenda'

export function AgendaView({ anchorDate, items, onSelectEvent }: AgendaViewProps) {
  const days = getGridDays(AGENDA_VIEW, anchorDate)
  const itemsByDay = groupItemsByDay(items)
  const daysWithItems = days.filter((day) => (itemsByDay.get(dayKeyForDate(day)) ?? []).length > 0)

  if (daysWithItems.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled in the next 14 days"
        description="Task due dates and events will show up here as they're created."
      />
    )
  }

  return (
    <div className="space-y-4">
      {daysWithItems.map((day) => {
        const dayItems = itemsByDay.get(dayKeyForDate(day)) ?? []
        return (
          <div key={day.toISOString()}>
            <p className="mb-1.5 px-1 text-[12px] font-semibold text-[var(--color-text-heading)]">
              {new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }).format(day)}
              {isToday(day) && <span className="ml-1.5 font-normal text-[var(--color-primary-600)]">Today</span>}
            </p>
            <Card padding="sm">
              <div className="divide-y divide-[var(--color-border)]">
                {dayItems.map((item) => (
                  <CalendarItemRow key={`${item.source}-${item.id}`} item={item} onSelectEvent={onSelectEvent} />
                ))}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
