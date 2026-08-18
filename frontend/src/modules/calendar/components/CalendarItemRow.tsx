// src/modules/calendar/components/CalendarItemRow.tsx
// Full-detail row (time, title, client, assignee, state badge) - used by DayView/AgendaView, where
// there's room to show more than MonthView/WeekView's compact CalendarItemChip. Clicking the
// client name navigates to the existing BusinessDetailPage (PRD §16) - a separate target from the
// row's own click-through, so it's a nested Link with its own stopPropagation.
import { Link } from 'react-router-dom'
import { CalendarDays, CheckSquare } from 'lucide-react'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { cn } from '@/lib/utils'
import { CALENDAR_STATE_CONFIG, CALENDAR_EVENT_TYPE_LABELS } from '../constants'
import type { CalendarItem } from '../types'

export interface CalendarItemRowProps {
  item: CalendarItem
  onSelectEvent: (eventId: string) => void
}

function itemTime(item: CalendarItem): string {
  if (item.allDay || !item.startAt) return 'All day'
  return new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(item.startAt))
}

export function CalendarItemRow({ item, onSelectEvent }: CalendarItemRowProps) {
  const stateConfig = CALENDAR_STATE_CONFIG[item.calendarState]
  const Icon = item.source === 'TASK' ? CheckSquare : CalendarDays
  const subtitle = item.source === 'EVENT' && item.eventType ? CALENDAR_EVENT_TYPE_LABELS[item.eventType] : item.status

  const body = (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-surface)]">
        <Icon className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--color-text-body)]">{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          {subtitle && <span>{subtitle}</span>}
          {item.business && (
            <>
              <span aria-hidden="true">·</span>
              <Link
                to={`/business/${item.business.id}`}
                onClick={(e) => e.stopPropagation()}
                className="hover:text-[var(--color-primary-600)] hover:underline"
              >
                {item.business.name}
              </Link>
            </>
          )}
          {item.assignee && (
            <>
              <span aria-hidden="true">·</span>
              <span>Assigned: {item.assignee.name}</span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{itemTime(item)}</span>
        <StatusBadge variant={stateConfig.variant} dot>
          {stateConfig.label}
        </StatusBadge>
      </div>
    </>
  )

  const rowClassName = cn(
    'flex w-full items-center gap-3 rounded-[var(--radius-md)] p-2.5 text-left',
    'hover:bg-[var(--color-hover)] transition-colors'
  )

  if (item.source === 'TASK') {
    return (
      <Link to={`/tasks/${item.id}`} className={rowClassName}>
        {body}
      </Link>
    )
  }

  return (
    <button type="button" onClick={() => onSelectEvent(item.id)} className={rowClassName}>
      {body}
    </button>
  )
}
