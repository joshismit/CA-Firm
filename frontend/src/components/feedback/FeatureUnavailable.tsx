// src/components/feedback/FeatureUnavailable.tsx
// Reusable page state for sidebar modules that have real UI but no backend behind them yet.
// Composes existing primitives only (PageHeader + EmptyState) so every not-yet-built module
// renders the same honest, on-brand "unavailable" message instead of a generic placeholder or
// fabricated data - swap in per <FeatureUnavailable> call, never duplicate this component.
import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader/PageHeader'
import { EmptyState } from './EmptyState'

export interface FeatureUnavailableProps {
  title: string
  reason: string
  icon?: LucideIcon
}

export function FeatureUnavailable({ title, reason, icon = Construction }: FeatureUnavailableProps) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} />
      <EmptyState icon={icon} title="Not available yet" description={reason} />
    </div>
  )
}
