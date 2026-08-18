// src/modules/crm/components/CRMQuickActions.tsx
// A real deleteLead()/useDeleteLeadMutation() now exist (DELETE /crm/:id), but no Delete button is
// added here deliberately - this phase's brief is backend wiring only, with instructions not to add
// new UI surfaces that didn't already exist. Edit and Convert both gate on PERMISSIONS.CRM_UPDATE -
// CRM's permission registry does define CRM_UPDATE (unlike Business/Contacts, which had no
// *_UPDATE and had to reuse a stand-in), so no permission substitution was needed here.
import { Pencil, ArrowRightCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useConvertLeadMutation } from '../hooks'
import type { Lead } from '../types'

export interface CRMQuickActionsProps {
  lead: Lead
}

export function CRMQuickActions({ lead }: CRMQuickActionsProps) {
  const navigate = useNavigate()
  const convertMutation = useConvertLeadMutation()

  const handleConvert = () => {
    if (!window.confirm(`Convert "${lead.title}" to a client? This cannot be undone.`)) return
    convertMutation.mutate({ leadId: lead.id })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Can permission={PERMISSIONS.CRM_UPDATE}>
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Pencil className="w-3.5 h-3.5" />}
            onClick={() => navigate(`/crm/${lead.id}/edit`)}
          >
            Edit
          </Button>
        </Can>
        <Can permission={PERMISSIONS.CRM_UPDATE}>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<ArrowRightCircle className="w-3.5 h-3.5" />}
            onClick={handleConvert}
            loading={convertMutation.isPending}
          >
            Convert to Client
          </Button>
        </Can>
      </div>
      {convertMutation.isError && (
        <p className="text-[12px] text-[var(--color-danger)]">{normalizeApiError(convertMutation.error).message}</p>
      )}
      {convertMutation.isSuccess && <p className="text-[12px] text-[var(--color-success)]">Lead converted.</p>}
    </div>
  )
}
