// src/modules/dashboard/components/TodayWorkWidget.tsx
// Work Calendar dashboard summary (PRD §19) - reuses the same GET /calendar endpoint and
// useCalendarItemsQuery hook the full Work Calendar page uses (no duplicate query logic), scoped
// to "today" + "my work". The existing CalendarWidget.tsx (GET /dashboard/calendar) is left
// untouched - it's a distinct 30-day task/invoice/compliance feed with its own consumer.
import { useNavigate } from 'react-router-dom'
import { CalendarClock } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Skeleton, ErrorState, EmptyState } from '@/components/feedback'
import { useCalendarItemsQuery } from '@/modules/calendar/hooks'
import { CalendarItemRow } from '@/modules/calendar/components/CalendarItemRow'
import type { CalendarState } from '@/modules/calendar/types'

const SUMMARY_STATES: { state: CalendarState; label: string }[] = [
  { state: 'OVERDUE', label: 'Overdue' },
  { state: 'CURRENTLY_WORKING', label: 'Currently Working' },
  { state: 'PENDING', label: 'Pending' },
  { state: 'UPCOMING', label: 'Upcoming' },
]

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfToday(): Date {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

export function TodayWorkWidget() {
  const navigate = useNavigate()
  const { data, isLoading, isError } = useCalendarItemsQuery({
    from: startOfToday().toISOString(),
    to: endOfToday().toISOString(),
    scope: 'mine',
  })

  const items = data ?? []
  const counts = SUMMARY_STATES.map(({ state, label }) => ({
    label,
    state,
    count: items.filter((item) => item.calendarState === state).length,
  }))

  return (
    <Card>
      <CardHeader title="Today's Work" action={<CalendarClock className="w-4 h-4 text-[var(--color-text-muted)]" />} />
      {isLoading ? (
        <Skeleton variant="table" rows={4} height={32} />
      ) : isError ? (
        <ErrorState message="Couldn't load today's work." />
      ) : (
        <>
          <div className="mb-3 grid grid-cols-4 gap-2">
            {counts.map(({ label, count }) => (
              <div key={label} className="rounded-[var(--radius-md)] bg-[var(--color-surface)] px-2 py-2 text-center">
                <p className="text-[16px] font-semibold text-[var(--color-text-heading)]">{count}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] leading-tight">{label}</p>
              </div>
            ))}
          </div>

          {items.length === 0 ? (
            <EmptyState title="Nothing scheduled today" description="Task due dates and events for today will show up here." />
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {items.slice(0, 6).map((item) => (
                <CalendarItemRow key={`${item.source}-${item.id}`} item={item} onSelectEvent={() => navigate('/calendar')} />
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}
