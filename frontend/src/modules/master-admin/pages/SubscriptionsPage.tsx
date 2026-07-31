// src/modules/master-admin/pages/SubscriptionsPage.tsx
// Plan catalog grid, backed by the real backend/src/modules/master-admin `/plans` endpoint (which
// itself reuses modules/billing's own PlanController - see routes/master-admin.routes.ts's "Plan
// catalog" section). Read-only for now: editing price/limits/active-status happens by calling
// PATCH /master-admin/plans/:id directly (useUpdatePlanMutation) - no dedicated edit form yet.
import { CreditCard } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Skeleton, EmptyState, ErrorState } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { formatINR } from '@/lib/utils'
import { useAdminPlansQuery } from '@/modules/billing/hooks'
import { BILLING_CYCLE_LABELS } from '@/modules/billing/constants'

export function SubscriptionsPage() {
  const { data, isLoading, isError, error, refetch } = useAdminPlansQuery()

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
          <EmptyState icon={CreditCard} title="No plans yet" description="Create plans directly against POST /master-admin/plans to populate this catalog." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.map((plan) => (
              <Card key={plan.id}>
                <div className="flex items-center justify-between">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-[var(--color-primary-600)]" />
                  </div>
                  <StatusBadge variant={plan.isActive ? 'success' : 'default'} dot>
                    {plan.isActive ? 'Active' : 'Inactive'}
                  </StatusBadge>
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-text-heading)]">{plan.name}</h3>
                <p className="mt-1 text-[20px] font-semibold text-[var(--color-text-heading)] tabular-nums">
                  {formatINR(plan.priceInPaise / 100, 0)}
                  <span className="text-[12px] font-normal text-[var(--color-text-muted)]"> / {BILLING_CYCLE_LABELS[plan.billingCycle]}</span>
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
