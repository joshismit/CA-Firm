// src/modules/dashboard/components/ComingSoonWidgets.tsx
// Extracted from DashboardPage.tsx's former inline "honest placeholder" Cards so each can be a
// single, independently show/hide-able entry in the widget registry (see ../constants) - still
// no fabricated data, no behavior change, just moved out of the page body.
//
// `TeamPerformanceWidget` and `CalendarWidget` used to live here as stubs - both are now real,
// backend-computed components (PerformanceWidget.tsx, CalendarWidget.tsx, PRD §10.6/§10.7) and
// have moved to their own files. Only Revenue/Trends remain genuinely unavailable - both need a
// billing/analytics backend this codebase doesn't have yet.
import { LineChart, BarChart3 } from 'lucide-react'
import { Card, CardHeader } from '@/components/shared/Card/Card'
import { EmptyState } from '@/components/feedback'

export function RevenueWidget() {
  return (
    <Card>
      <CardHeader title="Revenue" />
      <EmptyState
        icon={LineChart}
        title="Not available yet"
        description="Revenue tracking needs a billing backend, which doesn't exist yet - see the Client Billing module."
      />
    </Card>
  )
}

export function TrendsWidget() {
  return (
    <Card>
      <CardHeader title="Trends" />
      <EmptyState
        icon={BarChart3}
        title="Not available yet"
        description="Trend charts need historical data the backend doesn't track yet."
      />
    </Card>
  )
}
