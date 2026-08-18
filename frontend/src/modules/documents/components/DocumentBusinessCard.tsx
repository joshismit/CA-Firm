// src/modules/documents/components/DocumentBusinessCard.tsx
// DocumentFile.businessId is a real (nullable) foreign key, and Business's own useBusinessQuery
// hook already exists - per this phase's explicit instruction ("if a document belongs to a
// Business and a Business hook already exists, reuse useBusinessQuery"), this reuses it directly
// rather than falling back to a static EmptyState, mirroring CRMBusinessCard's identical pattern.
import { Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessQuery } from '@/modules/business/hooks'
import { BusinessStatusBadge } from '@/modules/business/components'

export interface DocumentBusinessCardProps {
  businessId: string | null
}

export function DocumentBusinessCard({ businessId }: DocumentBusinessCardProps) {
  const { data: business, isLoading, isError, error, refetch } = useBusinessQuery(businessId ?? '')

  return (
    <Card>
      <CardHeader title="Business" />
      {!businessId ? (
        <EmptyState icon={Landmark} title="No business linked" description="This document isn't linked to a business yet." />
      ) : isLoading ? (
        <Spinner fullScreen={false} label="Loading business…" className="py-8" />
      ) : isError || !business ? (
        <ErrorState
          title="Couldn't load business"
          message={error ? normalizeApiError(error).message : 'Business not found.'}
          onRetry={refetch}
          className="py-8"
        />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Link
              to={`/business/${business.id}`}
              className="text-[13px] font-medium text-[var(--color-text-body)] hover:text-[var(--color-primary-600)] truncate"
            >
              {business.name}
            </Link>
            {business.legalName && (
              <p className="text-[11px] text-[var(--color-text-muted)] truncate">{business.legalName}</p>
            )}
          </div>
          <BusinessStatusBadge status={business.status} />
        </div>
      )}
    </Card>
  )
}
