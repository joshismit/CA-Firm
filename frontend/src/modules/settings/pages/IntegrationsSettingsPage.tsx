// src/modules/settings/pages/IntegrationsSettingsPage.tsx
// listIntegrations/connectIntegration/disconnectIntegration always 501 (no backend module
// exists). The provider grid is a fixed, known catalog (constants/index.ts), not fetched data, so
// it always renders - every tile honestly shows "Not connected" (connection lookup finds nothing
// when the list call fails) rather than blocking the whole page behind an ErrorState, with an
// inline warning banner surfacing the real fetch failure instead.
import { useState } from 'react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Spinner, AlertBanner } from '@/components/feedback'
import { normalizeApiError } from '@/services/api-error'
import { useIntegrationsQuery, useConnectIntegrationMutation, useDisconnectIntegrationMutation } from '../hooks'
import { SettingsNav, SettingsSection, IntegrationCard } from '../components'
import { INTEGRATION_PROVIDERS } from '../constants'
import type { IntegrationProvider } from '../types'

export function IntegrationsSettingsPage() {
  const { data, isLoading, isError, error, refetch } = useIntegrationsQuery()
  const connectMutation = useConnectIntegrationMutation()
  const disconnectMutation = useDisconnectIntegrationMutation()
  const [pendingProvider, setPendingProvider] = useState<IntegrationProvider | null>(null)

  const handleConnect = (provider: IntegrationProvider) => {
    setPendingProvider(provider)
    connectMutation.mutate(provider, { onSettled: () => setPendingProvider(null) })
  }

  const handleDisconnect = (provider: IntegrationProvider) => {
    setPendingProvider(provider)
    disconnectMutation.mutate(provider, { onSettled: () => setPendingProvider(null) })
  }

  return (
    <PageLayout>
      <PageHeader title="Integrations" description="Connect email, SMS, payment, and storage providers." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />

          <SettingsSection title="Providers">
            {isLoading ? (
              <Spinner fullScreen={false} label="Loading integrations…" className="py-8" />
            ) : (
              <div className="space-y-4">
                {isError && (
                  <AlertBanner
                    variant="warning"
                    message={`Couldn't load your current connection status (${normalizeApiError(error).message}) - every provider below shows as "Not connected" until this can be checked.`}
                    action={
                      <button onClick={() => refetch()} className="text-[11px] font-semibold text-[var(--color-warning-fg)] hover:underline shrink-0">
                        Try again
                      </button>
                    }
                  />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {INTEGRATION_PROVIDERS.map((config) => (
                    <IntegrationCard
                      key={config.provider}
                      config={config}
                      connection={data?.find((c) => c.provider === config.provider)}
                      onConnect={() => handleConnect(config.provider)}
                      onDisconnect={() => handleDisconnect(config.provider)}
                      isPending={pendingProvider === config.provider && (connectMutation.isPending || disconnectMutation.isPending)}
                    />
                  ))}
                </div>
              </div>
            )}
            {(connectMutation.isError || disconnectMutation.isError) && (
              <p className="mt-3 text-[12px] text-[var(--color-danger)]">
                {normalizeApiError(connectMutation.error ?? disconnectMutation.error).message}
              </p>
            )}
          </SettingsSection>
        </div>
      </PageContent>
    </PageLayout>
  )
}
