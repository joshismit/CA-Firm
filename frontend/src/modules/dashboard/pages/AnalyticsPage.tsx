// src/modules/dashboard/pages/AnalyticsPage.tsx
import { BarChart3 } from 'lucide-react'
import { FeatureUnavailable } from '@/components/feedback'

export function AnalyticsPage() {
  return (
    <FeatureUnavailable
      title="Analytics"
      icon={BarChart3}
      reason="There's no reporting/analytics backend yet, so this page can't show real numbers. Once revenue, filing, and client-growth data has an API behind it, this will become a live analytics dashboard - not before, and not with placeholder figures."
    />
  )
}
