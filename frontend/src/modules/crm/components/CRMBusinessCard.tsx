// src/modules/crm/components/CRMBusinessCard.tsx
// CRM is explicitly the first module that ties Business/Contacts/Tasks together, and Lead.businessId
// is a real foreign key to Business - unlike BusinessContactsCard/ContactBusinessCard (which had no
// hook to reach into the other module), Business's own useBusinessQuery already exists and is safe
// to reuse here. This is real cross-module composition, not a fabricated join: when Business's API
// is wired up, this card starts showing real data with zero changes.
import { Landmark } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useBusinessQuery } from '@/modules/business/hooks'
import { BusinessStatusBadge } from '@/modules/business/components'

export interface CRMBusinessCardProps {
  businessId: string | null
}

export function CRMBusinessCard({ businessId }: CRMBusinessCardProps) {
  const { data: business, isLoading, isError, error, refetch } = useBusinessQuery(businessId ?? '')

  return (
    <Card>
      <CardHeader title="Business" />
      {!businessId ? (
        <EmptyState icon={Landmark} title="No business linked" description="This lead isn't linked to a business yet." />
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
