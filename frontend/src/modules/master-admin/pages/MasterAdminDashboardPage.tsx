// src/modules/master-admin/pages/MasterAdminDashboardPage.tsx
// Landing page for the /master-admin portal - overview stats + quick links to Tenants/Subscriptions.
// Rendered inside MasterAdminLayout's own header shell, so no PageHeader actions row is needed here.
import { Link } from 'react-router-dom'
import { ArrowRight, Building2, CreditCard, ShieldCheck } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Card } from '@/components/shared/Card/Card'
import { TenantStatsCards } from '../components'

export function MasterAdminDashboardPage() {
  return (
    <PageLayout>
      <PageHeader title="Master Admin" description="Platform-wide tenant and subscription overview." />
      <PageContent>
        <TenantStatsCards />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link to="/master-admin/tenants" className="block h-full">
            <Card className="h-full hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-[var(--color-primary-600)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--color-text-heading)]">Tenants</h3>
                  <p className="text-[12px] text-[var(--color-text-muted)]">Manage firms provisioned on this platform.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              </div>
            </Card>
          </Link>

          <Link to="/master-admin/subscriptions" className="block h-full">
            <Card className="h-full hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4 text-[var(--color-primary-600)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--color-text-heading)]">Subscriptions & Plans</h3>
                  <p className="text-[12px] text-[var(--color-text-muted)]">Review pricing plans and tenant distribution.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              </div>
            </Card>
          </Link>

          <Link to="/master-admin/audit" className="block h-full">
            <Card className="h-full hover:border-[var(--color-primary-300)] hover:shadow-[var(--shadow-md)] transition-all">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--color-primary-50)] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4 text-[var(--color-primary-600)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-[14px] font-semibold text-[var(--color-text-heading)]">Audit Logs</h3>
                  <p className="text-[12px] text-[var(--color-text-muted)]">System-level activity across every tenant.</p>
                </div>
                <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] shrink-0" />
              </div>
            </Card>
          </Link>
        </div>
      </PageContent>
    </PageLayout>
  )
}
