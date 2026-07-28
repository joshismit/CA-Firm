// src/modules/business/components/BusinessInformationCard.tsx
// Reuses BusinessForm in read-only "view" mode - no separate hand-rolled info display.
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { BusinessForm } from './BusinessForm'
import type { Business } from '../types'

export interface BusinessInformationCardProps {
  business: Business
}

export function BusinessInformationCard({ business }: BusinessInformationCardProps) {
  return (
    <Card>
      <CardHeader title="Information" />
      <BusinessForm mode="view" business={business} />
    </Card>
  )
}
