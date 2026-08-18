// src/modules/calendar/components/WeekView.tsx
// Seven day columns (Mon-Sun), each a scrollable stack of that day's items - not an hour grid,
// which would be a lot of new UI machinery for marginal benefit over a clear per-day list at
// this feature's scope (PRD §13/§14 "prioritize work information over decorative calendar features").
import { isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/feedback'
import { CalendarDays } from 'lucide-react'
import { getGridDays } from '../utils/date-range'
import { groupItemsByDay, dayKeyForDate } from '../utils/group-items'
import { CalendarItemChip } from './CalendarItemChip'
import type { CalendarItem } from '../types'

export interface WeekViewProps {
  anchorDate: Date
  items: CalendarItem[]
  onSelectEvent: (eventId: string) => void
}

export function WeekView({ anchorDate, items, onSelectEvent }: WeekViewProps) {
  const days = getGridDays('week', anchorDate)
  const itemsByDay = groupItemsByDay(items)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled this week"
        description="Task due dates and events for this week will show up here."
      />
    )
  }

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((day) => {
        const dayItems = itemsByDay.get(dayKeyForDate(day)) ?? []
        return (
          <div key={day.toISOString()} className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(day)}
              </span>
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium',
                  isToday(day) ? 'bg-[var(--color-primary-600)] text-white' : 'text-[var(--color-text-body)]'
                )}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="min-h-[220px] space-y-0.5">
              {dayItems.map((item) => (
                <CalendarItemChip key={`${item.source}-${item.id}`} item={item} onSelectEvent={onSelectEvent} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
