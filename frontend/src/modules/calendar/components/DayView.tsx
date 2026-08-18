// src/modules/calendar/components/DayView.tsx
import { CalendarDays } from 'lucide-react'
import { Card } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'
import { groupItemsByDay, dayKeyForDate } from '../utils/group-items'
import { CalendarItemRow } from './CalendarItemRow'
import type { CalendarItem } from '../types'

export interface DayViewProps {
  anchorDate: Date
  items: CalendarItem[]
  onSelectEvent: (eventId: string) => void
}

export function DayView({ anchorDate, items, onSelectEvent }: DayViewProps) {
  const dayItems = groupItemsByDay(items).get(dayKeyForDate(anchorDate)) ?? []

  return (
    <Card padding="sm">
      {dayItems.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Nothing scheduled" description="Task due dates and events for this day will show up here." />
      ) : (
        <div className="divide-y divide-[var(--color-border)]">
          {dayItems.map((item) => (
            <CalendarItemRow key={`${item.source}-${item.id}`} item={item} onSelectEvent={onSelectEvent} />
          ))}
        </div>
      )}
    </Card>
  )
}
