// src/modules/settings/components/SettingsSection.tsx
// Reusable "settings card" layout - title, optional description, optional right-aligned action,
// content body. Every settings page (Profile/Firm/Billing/Team/Integrations) composes its forms
// inside one or more of these instead of hand-rolling its own Card+CardHeader wiring each time.
import type { ReactNode } from 'react'
import { Card, CardHeader } from '@/components/shared/Card/Card'

export interface SettingsSectionProps {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function SettingsSection({ title, description, action, children, className }: SettingsSectionProps) {
  return (
    <Card className={className}>
      <CardHeader title={title} action={action} />
      {description && <p className="text-[12px] text-[var(--color-text-muted)] -mt-2 mb-4">{description}</p>}
      {children}
    </Card>
  )
}
