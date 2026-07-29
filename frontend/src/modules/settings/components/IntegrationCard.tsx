// src/modules/settings/components/IntegrationCard.tsx
// One tile per integration provider - shown as "Not connected" honestly (never fabricated as
// connected) since listIntegrations always 501s. Connect/Disconnect genuinely call the
// (currently-stubbed) API and surface the real error rather than pretending to succeed.
import { StatusBadge } from '@/components/shared/StatusBadge/StatusBadge'
import { Card } from '@/components/shared/Card/Card'
import { Button } from '@/components/ui/button'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import type { IntegrationProviderConfig } from '../constants'
import type { IntegrationConnection } from '../types'

export interface IntegrationCardProps {
  config: IntegrationProviderConfig
  connection: IntegrationConnection | undefined
  onConnect: () => void
  onDisconnect: () => void
  isPending?: boolean
}

export function IntegrationCard({ config, connection, onConnect, onDisconnect, isPending = false }: IntegrationCardProps) {
  const Icon = config.icon
  const isConnected = connection?.isConnected ?? false

  return (
    <Card className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-[var(--color-primary-600)]" />
        </div>
        <StatusBadge variant={isConnected ? 'success' : 'default'} dot={isConnected}>
          {isConnected ? 'Connected' : 'Not connected'}
        </StatusBadge>
      </div>
      <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-text-heading)]">{config.label}</h3>
      <p className="mt-1 text-[12px] text-[var(--color-text-muted)] flex-1">{config.description}</p>
      <Can permission={PERMISSIONS.SETTINGS_MANAGE}>
        <div className="mt-3">
          {isConnected ? (
            <Button variant="secondary" size="sm" onClick={onDisconnect} loading={isPending}>
              Disconnect
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={onConnect} loading={isPending}>
              Connect
            </Button>
          )}
        </div>
      </Can>
    </Card>
  )
}
