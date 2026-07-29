// src/modules/settings/pages/BillingSettingsPage.tsx
// Reuses modules/billing directly - this is the tenant's own SaaS subscription (what the firm
// pays this ERP vendor), a distinct concern from modules/client-billing (what the firm invoices
// its own clients). Both are currently NOT_IMPLEMENTED on the backend, so this page composes
// modules/billing's existing hooks/types/constants rather than re-deriving a third copy of
// subscription-billing logic.
import { CreditCard } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Spinner, ErrorState, EmptyState } from '@/components/feedback'
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Card } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { formatDate, formatINR } from '@/lib/utils'
import { useSubscriptionQuery, usePlansQuery, useCreateCheckoutSessionMutation } from '@/modules/billing/hooks'
import { BILLING_CYCLE_LABELS, SUBSCRIPTION_STATUS_LABELS } from '@/modules/billing/constants'
import { SettingsNav, SettingsSection } from '../components'

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'danger'> = {
  TRIAL: 'default',
  ACTIVE: 'success',
  PAST_DUE: 'warning',
  SUSPENDED: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
}

export function BillingSettingsPage() {
  const subscriptionQuery = useSubscriptionQuery()
  const plansQuery = usePlansQuery()
  const checkoutMutation = useCreateCheckoutSessionMutation()

  return (
    <PageLayout>
      <PageHeader title="Billing Settings" description="Your subscription plan and billing cycle for this ERP." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />

          <SettingsSection title="Current Subscription">
            {subscriptionQuery.isLoading ? (
              <Spinner fullScreen={false} label="Loading subscription…" className="py-8" />
            ) : subscriptionQuery.isError ? (
              <ErrorState
                title="Couldn't load your subscription"
                message={normalizeApiError(subscriptionQuery.error).message}
                onRetry={subscriptionQuery.refetch}
                className="py-8"
              />
            ) : subscriptionQuery.data ? (
              <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-[13px]">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Plan</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">{subscriptionQuery.data.planCode}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge variant={STATUS_VARIANT[subscriptionQuery.data.status] ?? 'default'} dot>
                      {SUBSCRIPTION_STATUS_LABELS[subscriptionQuery.data.status] ?? subscriptionQuery.data.status}
                    </StatusBadge>
                  </dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-[var(--color-text-muted)]">Renews / Expires</dt>
                  <dd className="mt-0.5 text-[var(--color-text-body)]">
                    {subscriptionQuery.data.expiresAt ? formatDate(subscriptionQuery.data.expiresAt) : '—'}
                  </dd>
                </div>
              </dl>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Available Plans">
            {plansQuery.isLoading ? (
              <Spinner fullScreen={false} label="Loading plans…" className="py-8" />
            ) : plansQuery.isError ? (
              <ErrorState title="Couldn't load plans" message={normalizeApiError(plansQuery.error).message} onRetry={plansQuery.refetch} className="py-8" />
            ) : !plansQuery.data || plansQuery.data.length === 0 ? (
              <EmptyState icon={CreditCard} title="No plans available" description="Plan pricing isn't available yet." />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {plansQuery.data.map((plan) => (
                  <Card key={plan.code} padding="sm">
                    <h4 className="text-[13px] font-semibold text-[var(--color-text-heading)]">{plan.name}</h4>
                    <p className="mt-1 font-mono text-[18px] font-bold text-[var(--color-text-heading)]">
                      {formatINR(plan.priceInPaise / 100, 0)}
                      <span className="text-[11px] font-normal text-[var(--color-text-muted)]"> / {BILLING_CYCLE_LABELS[plan.billingCycle]}</span>
                    </p>
                    <Can permission={PERMISSIONS.BILLING_MANAGE}>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="mt-3"
                        loading={checkoutMutation.isPending}
                        onClick={() => checkoutMutation.mutate({ planCode: plan.code, billingCycle: plan.billingCycle })}
                      >
                        Choose plan
                      </Button>
                    </Can>
                  </Card>
                ))}
              </div>
            )}
            {checkoutMutation.isError && (
              <p className="mt-3 text-[12px] text-[var(--color-danger)]">{normalizeApiError(checkoutMutation.error).message}</p>
            )}
          </SettingsSection>
        </div>
      </PageContent>
    </PageLayout>
  )
}
