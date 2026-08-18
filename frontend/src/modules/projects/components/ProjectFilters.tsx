// src/modules/projects/components/ProjectFilters.tsx
// Filter controls for the Projects list - rendered inside DataTable's toolbarFilters slot.
// Only `status` and `clientId` are wired here: those are the only extra filters
// listProjectsQuerySchema actually accepts (backend/src/modules/projects/schemas/project.schema.ts)
// beyond pagination/search/sort. There is no `priority` field anywhere on Project, so no priority
// filter is rendered. clientId has no picker (no mounted Clients API to look up business names by
// client) - same raw-UUID-input precedent as ContactFilters' businessId field.
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { PROJECT_STATUS_LABELS } from '../constants'
import type { ProjectStatus } from '../types'

const STATUS_FILTER_OPTIONS = [
  { value: '__all__', label: 'All statuses' },
  ...Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

export interface ProjectFiltersProps {
  status: ProjectStatus | undefined
  onStatusChange: (status: ProjectStatus | undefined) => void
  clientId: string
  onClientIdChange: (clientId: string) => void
}

export function ProjectFilters({ status, onStatusChange, clientId, onClientIdChange }: ProjectFiltersProps) {
  return (
    <>
      <Select
        value={status ?? '__all__'}
        onChange={(value) => onStatusChange(value === '__all__' ? undefined : (value as ProjectStatus))}
        options={STATUS_FILTER_OPTIONS}
        className="h-8 w-[150px]"
        placeholder="Status"
      />
      <Input
        value={clientId}
        onChange={(e) => onClientIdChange(e.target.value)}
        placeholder="Filter by client ID (UUID)"
        className="h-8 w-[220px]"
        aria-label="Filter projects by client ID"
      />
    </>
  )
}
