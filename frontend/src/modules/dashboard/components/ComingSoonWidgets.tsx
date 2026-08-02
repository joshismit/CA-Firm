// src/modules/dashboard/components/ComingSoonWidgets.tsx
// Extracted from DashboardPage.tsx's former inline "honest placeholder" Cards so each can be a
// single, independently show/hide-able entry in the widget registry (see ../constants) - still
// no fabricated data, no behavior change, just moved out of the page body.
import { LineChart, BarChart3, Users2, CalendarDays } from 'lucide-react'
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

export function TeamPerformanceWidget() {
  return (
    <Card>
      <CardHeader title="Team Performance" />
      <EmptyState
        icon={Users2}
        title="Not available yet"
        description="Per-staff workload and completion analytics need a reporting backend that doesn't exist yet."
      />
    </Card>
  )
}

export function CalendarWidget() {
  return (
    <Card>
      <CardHeader title="Calendar" />
      <EmptyState
        icon={CalendarDays}
        title="Not available yet"
        description="A shared firm calendar needs a scheduling backend that doesn't exist yet."
      />
    </Card>
  )
}
