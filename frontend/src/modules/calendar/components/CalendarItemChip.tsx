// src/modules/calendar/components/CalendarItemChip.tsx
// Single calendar item chip, shared by MonthView/WeekView/DayView/AgendaView. A TASK item
// navigates to the existing TaskDetailPage (no separate calendar-task-detail page, per the PRD) -
// an EVENT item opens CalendarEventDialog in view/edit mode instead.
import { Link } from 'react-router-dom'
import { CalendarDays, CheckSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CALENDAR_STATE_CONFIG } from '../constants'
import type { CalendarItem } from '../types'

const STATE_DOT_CLASS: Record<string, string> = {
  danger: 'bg-[var(--color-danger)]',
  warning: 'bg-[var(--color-warning)]',
  info: 'bg-[var(--color-info)]',
  primary: 'bg-[var(--color-primary-600)]',
  success: 'bg-[var(--color-success)]',
  default: 'bg-[var(--color-text-muted)]',
}

export interface CalendarItemChipProps {
  item: CalendarItem
  onSelectEvent: (eventId: string) => void
  className?: string
}

function itemTime(item: CalendarItem): string | null {
  if (item.allDay || !item.startAt) return null
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(item.startAt))
}

export function CalendarItemChip({ item, onSelectEvent, className }: CalendarItemChipProps) {
  const stateConfig = CALENDAR_STATE_CONFIG[item.calendarState]
  const time = itemTime(item)
  const Icon = item.source === 'TASK' ? CheckSquare : CalendarDays

  const content = (
    <>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATE_DOT_CLASS[stateConfig.variant])} />
      <Icon className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-[var(--color-text-body)]">{item.title}</span>
      {time && <span className="shrink-0 text-[10.5px] text-[var(--color-text-muted)]">{time}</span>}
    </>
  )

  const sharedClassName = cn(
    'flex w-full items-center gap-1.5 rounded-[var(--radius-xs)] px-1.5 py-1 text-left',
    'hover:bg-[var(--color-hover)] transition-colors',
    className
  )

  if (item.source === 'TASK') {
    return (
      <Link to={`/tasks/${item.id}`} className={sharedClassName} title={item.title}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={() => onSelectEvent(item.id)} className={sharedClassName} title={item.title}>
      {content}
    </button>
  )
}
