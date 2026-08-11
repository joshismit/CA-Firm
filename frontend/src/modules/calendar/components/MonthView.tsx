// src/modules/calendar/components/MonthView.tsx
import { isSameMonth, isToday } from 'date-fns'
import { cn } from '@/lib/utils'
import { getGridDays } from '../utils/date-range'
import { groupItemsByDay, dayKeyForDate } from '../utils/group-items'
import { CalendarItemChip } from './CalendarItemChip'
import type { CalendarItem } from '../types'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MAX_VISIBLE_PER_DAY = 3

export interface MonthViewProps {
  anchorDate: Date
  items: CalendarItem[]
  onSelectEvent: (eventId: string) => void
}

export function MonthView({ anchorDate, items, onSelectEvent }: MonthViewProps) {
  const days = getGridDays('month', anchorDate)
  const itemsByDay = groupItemsByDay(items)

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)]">
      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayItems = itemsByDay.get(dayKeyForDate(day)) ?? []
          const visible = dayItems.slice(0, MAX_VISIBLE_PER_DAY)
          const overflow = dayItems.length - visible.length
          const inMonth = isSameMonth(day, anchorDate)

          return (
            <div
              key={day.toISOString()}
              className={cn(
                'min-h-[104px] border-b border-r border-[var(--color-border)] p-1.5 last:border-r-0',
                !inMonth && 'bg-[var(--color-surface)]/60'
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-medium',
                  isToday(day)
                    ? 'bg-[var(--color-primary-600)] text-white'
                    : inMonth
                      ? 'text-[var(--color-text-body)]'
                      : 'text-[var(--color-text-disabled)]'
                )}
              >
                {day.getDate()}
              </span>
              <div className="mt-1 space-y-0.5">
                {visible.map((item) => (
                  <CalendarItemChip key={`${item.source}-${item.id}`} item={item} onSelectEvent={onSelectEvent} />
                ))}
                {overflow > 0 && <p className="px-1.5 text-[10.5px] text-[var(--color-text-muted)]">+{overflow} more</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
