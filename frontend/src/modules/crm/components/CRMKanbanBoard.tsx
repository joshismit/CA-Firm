// src/modules/crm/components/CRMKanbanBoard.tsx
// CRM-specific wiring around the generic KanbanBoard: columns come from real LeadStage rows
// (GET /crm/stages via useLeadStagesQuery, ordered by `order` - never hardcoded stage names), and
// dropping a card calls the real PATCH /crm/:id endpoint (useMoveLeadStageMutation) to persist the
// new stageId. Each card also exposes a real <Select> "move to stage" control, since native
// drag-and-drop alone isn't keyboard-operable.
import { useNavigate } from 'react-router-dom'
import { KanbanBoard, type KanbanColumn } from '@/components/shared/Kanban/KanbanBoard'
import { Card } from '@/components/shared/Card/Card'
import { Select } from '@/components/ui/select'
import { formatCompactINR, formatDate } from '@/lib/utils'
import { useMoveLeadStageMutation } from '../hooks'
import type { Lead, LeadStage } from '../types'

export interface CRMKanbanBoardProps {
  leads: Lead[]
  stages: LeadStage[]
}

export function CRMKanbanBoard({ leads, stages }: CRMKanbanBoardProps) {
  const navigate = useNavigate()
  const moveMutation = useMoveLeadStageMutation()

  const orderedStages = [...stages].sort((a, b) => a.order - b.order)
  const stageOptions = orderedStages.map((s) => ({ value: s.id, label: s.name }))

  const columns: KanbanColumn<Lead>[] = orderedStages.map((stage) => ({
    id: stage.id,
    title: stage.name,
    items: leads.filter((lead) => lead.stageId === stage.id),
  }))

  const handleMove = (leadId: string, _fromStageId: string, toStageId: string) => {
    moveMutation.mutate({ id: leadId, stageId: toStageId })
  }

  if (orderedStages.length === 0) {
    return (
      <Card className="text-center py-10">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          No lead stages configured yet - the Kanban board has no columns to show.
        </p>
      </Card>
    )
  }

  return (
    <KanbanBoard<Lead>
      columns={columns}
      getItemId={(lead) => lead.id}
      onMove={handleMove}
      renderColumnHeader={(column) => (
        <>
          <span className="text-[12px] font-semibold text-[var(--color-text-heading)] truncate">{column.title}</span>
          <span className="text-[11px] text-[var(--color-text-muted)] shrink-0">{column.items.length}</span>
        </>
      )}
      renderCard={(lead, { moveTo }) => (
        <div
          role="button"
          tabIndex={0}
          onClick={() => navigate(`/crm/${lead.id}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') navigate(`/crm/${lead.id}`)
          }}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-3 space-y-2 hover:shadow-[var(--shadow-sm)] transition-shadow cursor-pointer"
        >
          <p className="text-[12.5px] font-medium text-[var(--color-text-body)] line-clamp-2">{lead.title}</p>
          <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
            <span className="font-mono">{lead.expectedRevenue != null ? formatCompactINR(lead.expectedRevenue) : '—'}</span>
            <span>{lead.probability != null ? `${lead.probability}%` : '—'}</span>
          </div>
          <p className="text-[10.5px] text-[var(--color-text-muted)]">Expected close: {lead.expectedCloseDate ? formatDate(lead.expectedCloseDate) : '—'}</p>
          <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <Select
              value={lead.stageId}
              onChange={(value) => value !== lead.stageId && moveTo(value)}
              options={stageOptions}
              className="h-7 text-[11px]"
              aria-label={`Move "${lead.title}" to a different stage`}
            />
          </div>
        </div>
      )}
    />
  )
}
