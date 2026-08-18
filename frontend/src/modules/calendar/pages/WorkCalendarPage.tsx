// src/modules/calendar/pages/WorkCalendarPage.tsx
import { useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { PageLayout } from '@/components/page/PageLayout'
import { PageContent } from '@/components/page/PageContent'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { Button } from '@/components/ui/button'
import { Skeleton, ErrorState } from '@/components/feedback'
import { useAuthStore } from '@/store/auth.store'
import { useCalendarItemsQuery } from '../hooks'
import { WorkCalendarToolbar, type WorkCalendarFilters } from '../components/WorkCalendarToolbar'
import { MonthView } from '../components/MonthView'
import { WeekView } from '../components/WeekView'
import { DayView } from '../components/DayView'
import { AgendaView } from '../components/AgendaView'
import { CalendarEventDialog } from '../components/CalendarEventDialog'
import { getViewRange, shiftAnchorDate } from '../utils/date-range'
import type { CalendarView } from '../types'

const UNRESTRICTED_ROLES = ['TENANT_ADMIN', 'MANAGER', 'MASTER_ADMIN']

export function WorkCalendarPage() {
  const role = useAuthStore((s) => s.user?.role)
  const canViewFirmWork = !!role && UNRESTRICTED_ROLES.includes(role)

  const [view, setView] = useState<CalendarView>('week')
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [filters, setFilters] = useState<WorkCalendarFilters>({ scope: 'mine' })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEventId, setEditingEventId] = useState<string | undefined>(undefined)

  const range = useMemo(() => getViewRange(view, anchorDate), [view, anchorDate])

  const { data: items, isLoading, isError, refetch } = useCalendarItemsQuery({
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    scope: filters.scope,
    businessId: filters.businessId,
    staffId: filters.scope === 'firm' ? filters.staffId : undefined,
    status: filters.status,
  })

  const openCreateDialog = () => {
    setEditingEventId(undefined)
    setDialogOpen(true)
  }

  const openEditDialog = (eventId: string) => {
    setEditingEventId(eventId)
    setDialogOpen(true)
  }

  const visibleItems = items ?? []

  return (
    <PageLayout>
      <PageHeader
        title="Work Calendar"
        description="Client work, task deadlines, and meetings in one view."
        actions={
          <Button size="sm" onClick={openCreateDialog}>
            <Plus className="h-3.5 w-3.5" />
            Add Event
          </Button>
        }
      />

      <PageContent>
        <WorkCalendarToolbar
          view={view}
          onViewChange={setView}
          anchorDate={anchorDate}
          onNavigate={(direction) => setAnchorDate((prev) => shiftAnchorDate(view, prev, direction))}
          onToday={() => setAnchorDate(new Date())}
          filters={filters}
          onFiltersChange={setFilters}
          canViewFirmWork={canViewFirmWork}
        />

        {isLoading ? (
          <Skeleton variant="card" height={480} />
        ) : isError ? (
          <ErrorState message="Couldn't load the calendar." onRetry={() => refetch()} />
        ) : view === 'month' ? (
          <MonthView anchorDate={anchorDate} items={visibleItems} onSelectEvent={openEditDialog} />
        ) : view === 'week' ? (
          <WeekView anchorDate={anchorDate} items={visibleItems} onSelectEvent={openEditDialog} />
        ) : view === 'day' ? (
          <DayView anchorDate={anchorDate} items={visibleItems} onSelectEvent={openEditDialog} />
        ) : (
          <AgendaView anchorDate={anchorDate} items={visibleItems} onSelectEvent={openEditDialog} />
        )}
      </PageContent>

      <CalendarEventDialog open={dialogOpen} onOpenChange={setDialogOpen} eventId={editingEventId} />
    </PageLayout>
  )
}
