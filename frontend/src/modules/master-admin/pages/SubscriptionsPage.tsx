// src/modules/master-admin/pages/SubscriptionsPage.tsx
// Plan catalog grid, same composition style as Reports' ReportTypeCard grid - but genuinely
// data-fetched (not a static local catalog like Reports' 8 fixed types), so it carries real
// isLoading/isError/empty states wired to the subscriptions stub (api/index.ts's notImplemented()).
import { CreditCard } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { Skeleton, EmptyState, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useSubscriptionPlansQuery } from '../hooks'

export function SubscriptionsPage() {
  const { data, isLoading, isError, error, refetch } = useSubscriptionPlansQuery()

  return (
    <PageLayout>
      <PageHeader title="Subscriptions & Plans" description="Pricing plans available to tenants on this platform." />
      <PageContent>
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <Skeleton height={20} width={120} />
                <Skeleton height={28} width={80} className="mt-3" />
                <Skeleton height={14} width={100} className="mt-2" />
              </Card>
            ))}
          </div>
        ) : isError ? (
          <ErrorState title="Couldn't load plans" message={normalizeApiError(error).message} onRetry={refetch} />
        ) : !data || data.length === 0 ? (
          <EmptyState icon={CreditCard} title="No plans yet" description="Subscription plans configured for this platform will show up here." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((plan) => (
              <Card key={plan.id}>
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-[var(--color-primary-600)]" />
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-text-heading)]">{plan.name}</h3>
                <p className="mt-1 text-[20px] font-semibold text-[var(--color-text-heading)] tabular-nums">
                  ₹{plan.priceMonthly.toLocaleString('en-IN')}
                  <span className="text-[12px] font-normal text-[var(--color-text-muted)]">/mo</span>
                </p>
                <p className="mt-1 text-[12px] text-[var(--color-text-muted)]">
                  {plan.tenantCount} tenant{plan.tenantCount === 1 ? '' : 's'}
                </p>
              </Card>
            ))}
          </div>
        )}
      </PageContent>
    </PageLayout>
  )
}
