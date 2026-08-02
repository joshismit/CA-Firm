// src/modules/dashboard/pages/DashboardPage.tsx
// Widget list is API-driven (GET /dashboard/preferences), not hardcoded: WIDGET_REGISTRY in
// ../constants is the catalog, useDashboardLayout (../hooks) merges the caller's saved show/hide +
// order onto it, filtered to widgets their permissions allow. First-time users (no saved
// preference row yet) get every widget visible in registry order - the same layout this page
// always rendered before "Customize Dashboard" existed. Every number still comes from a real,
// already-existing hook pointed at a real endpoint, or is an honest, clearly-labeled "not
// available yet" placeholder - unchanged from before, just reachable via the registry now.
import { RefreshCw } from 'lucide-react'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useDashboardLayout } from '../hooks'
import { WIDGET_SIZE_CLASS } from '../constants'
import { CustomizeDashboardDrawer } from '../components'

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const today = new Date()
  const { entries, isLoading } = useDashboardLayout()

  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : ''

  return (
    <PageLayout>
      <PageHeader
        title="Dashboard"
        description={`${displayName ? `Good morning, ${displayName}. ` : ''}Here's what's happening today — ${today.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`}
        actions={
          <PageActions>
            <CustomizeDashboardDrawer />
            <Button variant="secondary" leadingIcon={<RefreshCw className="w-3.5 h-3.5" />} onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </PageActions>
        }
      />

      <PageContent>
        {isLoading ? null : (
          <div className="grid grid-cols-12 gap-4">
            {entries
              .filter((entry) => entry.visible)
              .map(({ widget }) => (
                <div key={widget.id} className={WIDGET_SIZE_CLASS[widget.size]}>
                  <widget.component />
                </div>
              ))}
          </div>
        )}
      </PageContent>
    </PageLayout>
  )
}
