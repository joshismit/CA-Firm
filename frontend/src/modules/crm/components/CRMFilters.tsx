// src/modules/crm/components/CRMFilters.tsx
// Filter controls for the CRM (Leads) list - rendered inside DataTable's toolbarFilters slot.
// Stage filter is a real Select backed by useLeadStagesQuery() (GET /crm/stages) - it degrades to
// a disabled placeholder only while that query is loading/erroring, rather than rendering a broken
// empty dropdown. Source filter has no equivalent listLeadSources hook - the backend never added a
// GET /crm/lead-sources endpoint, so - same placeholder-until-a-picker-exists pattern as Business's
// typeId / Contacts' businessId - it's a raw UUID input, not invented Select options.
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import type { LeadStage } from '../types'

const STAGE_ALL_OPTION = { value: '__all__', label: 'All stages' }

export interface CRMFiltersProps {
  stages: LeadStage[]
  stagesLoading: boolean
  stageId: string | undefined
  onStageIdChange: (stageId: string | undefined) => void
  sourceId: string
  onSourceIdChange: (sourceId: string) => void
}

export function CRMFilters({ stages, stagesLoading, stageId, onStageIdChange, sourceId, onSourceIdChange }: CRMFiltersProps) {
  const stageOptions = [STAGE_ALL_OPTION, ...stages.map((s) => ({ value: s.id, label: s.name }))]

  return (
    <div className="flex items-center gap-2">
      <Select
        value={stageId ?? '__all__'}
        onChange={(value) => onStageIdChange(value === '__all__' ? undefined : value)}
        options={stageOptions}
        disabled={stagesLoading || stages.length === 0}
        className="h-8 w-[160px]"
        placeholder={stages.length === 0 ? 'Stages unavailable' : 'Stage'}
      />
      <Input
        value={sourceId}
        onChange={(e) => onSourceIdChange(e.target.value)}
        placeholder="Filter by source ID (UUID)"
        className="h-8 w-[200px]"
        aria-label="Filter leads by source ID"
      />
    </div>
  )
}
