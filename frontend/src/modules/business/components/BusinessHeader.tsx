// src/modules/business/components/BusinessHeader.tsx
// Composes the shared PageHeader/PageActions with business-specific content - pages never build
// this header inline.
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader, PageActions } from '@/components/page'
import { BusinessStatusBadge } from './BusinessStatusBadge'
import { BusinessQuickActions } from './BusinessQuickActions'
import type { Business } from '../types'

export interface BusinessHeaderProps {
  business: Business
}

export function BusinessHeader({ business }: BusinessHeaderProps) {
  return (
    <div className="space-y-3">
      <Link
        to="/business"
        className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)] hover:text-[var(--color-text-body)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to businesses
      </Link>

      <PageHeader
        title={business.name}
        description={business.legalName ?? undefined}
        actions={
          <PageActions>
            <BusinessStatusBadge status={business.status} />
            <BusinessQuickActions business={business} />
          </PageActions>
        }
      />
    </div>
  )
}
