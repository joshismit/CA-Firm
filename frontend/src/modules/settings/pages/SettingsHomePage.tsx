// src/modules/settings/pages/SettingsHomePage.tsx
// Settings hub - a real, static, navigable catalog of the 5 sections that already have routes
// (settings.routes.tsx). No data fetching here; each card just links through.
import { Link } from 'react-router-dom'
import { ArrowRight, User, Building2, CreditCard, UsersRound, Plug } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { SettingsNav } from '../components'

const SETTINGS_SECTIONS = [
  { to: '/settings/profile', label: 'Profile', description: 'Your account details, password, and active sessions.', icon: User },
  { to: '/settings/firm', label: 'Firm', description: "Your firm's company profile - name, GSTIN, PAN, address.", icon: Building2 },
  { to: '/settings/billing', label: 'Billing', description: 'Your subscription plan and billing cycle for this ERP.', icon: CreditCard },
  { to: '/settings/team', label: 'Team', description: 'Firm-wide preferences for staff and task defaults.', icon: UsersRound },
  { to: '/settings/integrations', label: 'Integrations', description: 'Connect email, SMS, payment, and storage providers.', icon: Plug },
]

export function SettingsHomePage() {
  return (
    <PageLayout>
      <PageHeader title="Settings" description="Manage your account, firm, and integrations." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SETTINGS_SECTIONS.map(({ to, label, description, icon: Icon }) => (
              <Link key={to} to={to} className="block h-full">
                <Card className="h-full flex flex-col hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
                  <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-[var(--color-primary-600)]" />
                  </div>
                  <h3 className="mt-3 text-[14px] font-semibold text-[var(--color-text-heading)]">{label}</h3>
                  <p className="mt-1 text-[12px] text-[var(--color-text-muted)] flex-1">{description}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--color-primary-600)]">
                    Manage <ArrowRight className="w-3 h-3" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </PageContent>
    </PageLayout>
  )
}
