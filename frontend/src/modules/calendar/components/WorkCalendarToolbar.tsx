// src/modules/calendar/components/WorkCalendarToolbar.tsx
// View switcher (Month/Week/Day/Agenda) + My Work/Firm Work toggle + Client/Staff/Status filters,
// built from the same <Select> + synthetic "__all__" pattern as BusinessFilters.tsx, plus
// FilterChips for the active-filter row - both existing components, reused as-is.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconButton } from '@/components/ui/icon-button'
import { Select } from '@/components/ui/select'
import { FilterChips } from '@/components/shared/FilterChips/FilterChips'
import { useBusinessesQuery } from '@/modules/business/hooks'
import { useAssignableStaffQuery } from '@/modules/tasks/hooks'
import { CALENDAR_VIEW_OPTIONS } from '../constants'
import type { CalendarScope, CalendarView } from '../types'
import type { TaskStatus } from '@/modules/tasks/types'

const SCOPE_OPTIONS: { value: CalendarScope; label: string }[] = [
  { value: 'mine', label: 'My Work' },
  { value: 'firm', label: 'Firm Work' },
]

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '__all__', label: 'All statuses' },
  { value: 'TODO', label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'REVIEW', label: 'Review' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
]

function formatRangeLabel(view: CalendarView, anchorDate: Date): string {
  const monthYear = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(anchorDate)
  if (view === 'day') {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }).format(anchorDate)
  }
  return monthYear
}

export interface WorkCalendarFilters {
  scope: CalendarScope
  businessId?: string
  staffId?: string
  status?: TaskStatus
}

export interface WorkCalendarToolbarProps {
  view: CalendarView
  onViewChange: (view: CalendarView) => void
  anchorDate: Date
  onNavigate: (direction: 1 | -1) => void
  onToday: () => void
  filters: WorkCalendarFilters
  onFiltersChange: (filters: WorkCalendarFilters) => void
  /** Only unrestricted roles (TENANT_ADMIN/MANAGER/MASTER_ADMIN) may view Firm Work - the same rule the backend enforces (403 otherwise). */
  canViewFirmWork: boolean
}

export function WorkCalendarToolbar({
  view,
  onViewChange,
  anchorDate,
  onNavigate,
  onToday,
  filters,
  onFiltersChange,
  canViewFirmWork,
}: WorkCalendarToolbarProps) {
  const businessesQuery = useBusinessesQuery({ limit: 100 })
  const staffQuery = useAssignableStaffQuery(filters.businessId ? { businessId: filters.businessId } : {})

  const businessOptions = [
    { value: '__all__', label: 'All clients' },
    ...(businessesQuery.data?.data ?? []).map((b) => ({ value: b.id, label: b.name })),
  ]
  const staffOptions = [
    { value: '__all__', label: 'All staff' },
    ...(staffQuery.data ?? []).map((s) => ({ value: s.id, label: s.lastName ? `${s.firstName} ${s.lastName}` : s.firstName })),
  ]

  const scopeOptions = canViewFirmWork ? SCOPE_OPTIONS : SCOPE_OPTIONS.filter((o) => o.value === 'mine')

  const chips = [
    filters.businessId && {
      key: 'businessId',
      label: `Client: ${businessOptions.find((o) => o.value === filters.businessId)?.label ?? '…'}`,
    },
    filters.staffId && {
      key: 'staffId',
      label: `Staff: ${staffOptions.find((o) => o.value === filters.staffId)?.label ?? '…'}`,
    },
    filters.status && { key: 'status', label: `Status: ${STATUS_OPTIONS.find((o) => o.value === filters.status)?.label}` },
  ].filter((c): c is { key: string; label: string } => !!c)

  const removeFilter = (key: string) => {
    if (key === 'businessId') onFiltersChange({ ...filters, businessId: undefined })
    if (key === 'staffId') onFiltersChange({ ...filters, staffId: undefined })
    if (key === 'status') onFiltersChange({ ...filters, status: undefined })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onToday}>
            Today
          </Button>
          <div className="flex items-center gap-0.5">
            <IconButton label="Previous" size="sm" variant="ghost" onClick={() => onNavigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </IconButton>
            <IconButton label="Next" size="sm" variant="ghost" onClick={() => onNavigate(1)}>
              <ChevronRight className="h-4 w-4" />
            </IconButton>
          </div>
          <span className="text-[14px] font-semibold text-[var(--color-text-heading)]">{formatRangeLabel(view, anchorDate)}</span>
        </div>

        <div role="tablist" className="flex items-center rounded-[var(--radius-md)] border border-[var(--color-border)] p-0.5">
          {CALENDAR_VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={view === opt.value}
              onClick={() => onViewChange(opt.value)}
              className={`h-7 rounded-[var(--radius-sm)] px-3 text-[12px] font-medium transition-colors ${
                view === opt.value
                  ? 'bg-[var(--color-primary-600)] text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-hover)]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.scope}
          onChange={(value) => onFiltersChange({ ...filters, scope: value as CalendarScope })}
          options={scopeOptions}
          className="h-8 w-[130px]"
        />
        <Select
          value={filters.businessId ?? '__all__'}
          onChange={(value) => onFiltersChange({ ...filters, businessId: value === '__all__' ? undefined : value })}
          options={businessOptions}
          disabled={businessesQuery.isLoading}
          className="h-8 w-[170px]"
          placeholder="Client"
        />
        {filters.scope === 'firm' && (
          <Select
            value={filters.staffId ?? '__all__'}
            onChange={(value) => onFiltersChange({ ...filters, staffId: value === '__all__' ? undefined : value })}
            options={staffOptions}
            disabled={staffQuery.isLoading}
            className="h-8 w-[160px]"
            placeholder="Staff"
          />
        )}
        <Select
          value={filters.status ?? '__all__'}
          onChange={(value) => onFiltersChange({ ...filters, status: value === '__all__' ? undefined : (value as TaskStatus) })}
          options={STATUS_OPTIONS}
          className="h-8 w-[150px]"
        />
        <FilterChips chips={chips} onRemove={removeFilter} onClearAll={() => onFiltersChange({ scope: filters.scope })} />
      </div>
    </div>
  )
}
