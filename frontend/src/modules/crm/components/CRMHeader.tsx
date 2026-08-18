// src/modules/crm/components/CRMHeader.tsx
// Composes the shared PageHeader/PageActions with lead-specific content - pages never build this
// header inline. `stageName` is resolved by the caller (CRMDetailPage) via useLeadStagesQuery() and
// passed down, so this stays a pure presentational component like BusinessHeader/ContactHeader.
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { CRMStatusBadge } from './CRMStatusBadge'
import { CRMQuickActions } from './CRMQuickActions'
import type { Lead } from '../types'

export interface CRMHeaderProps {
  lead: Lead
  stageName: string | undefined
}

export function CRMHeader({ lead, stageName }: CRMHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/crm"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to leads
      </Link>

      <PageHeader
        title={lead.title}
        actions={
          <PageActions>
            <CRMStatusBadge stageName={stageName} />
            <CRMQuickActions lead={lead} />
          </PageActions>
        }
      />
    </div>
  )
}
