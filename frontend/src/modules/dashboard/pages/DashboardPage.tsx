// src/modules/dashboard/pages/DashboardPage.tsx
// Widget list is API-driven (GET /dashboard/preferences), not hardcoded: WIDGET_REGISTRY in
// ../constants is the catalog, useDashboardLayout (../hooks) merges the caller's saved show/hide +
// order + size/collapsed/pinned onto it, filtered to widgets their permissions allow. First-time
// users (no saved preference row yet) inherit their tenant's configured role default if one
// exists, otherwise every widget visible in registry order (PRD §10.3). Every number still comes
// from a real, already-existing hook pointed at a real endpoint, or is an honest, clearly-labeled
// "not available yet" placeholder.
//
// Pinned entries (PRD §10.4) render first, ahead of the saved order - display-only, doesn't change
// the persisted layout. Collapsed entries (PRD §10.2) render as a compact header-only row; clicking
// it expands the widget for this session only (persisted collapse state changes go through
// CustomizeDashboardDrawer, not an inline toggle here, to avoid a network round trip per click).
import { useState } from 'react'
import { ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { PageLayout, PageHeader, PageContent, PageActions } from '@/components/page'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useDashboardLayout } from '../hooks'
import { WIDGET_SIZE_CLASS } from '../constants'
import { CustomizeDashboardDrawer } from '../components'

function CollapsedWidgetRow({ label, onExpand }: { label: string; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className="w-full flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] px-5 py-3 text-left shadow-[var(--shadow-sm)] hover:bg-[var(--color-hover)] transition-colors"
    >
      <span className="text-[13px] font-medium text-[var(--color-text-body)]">{label}</span>
      <ChevronDown className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
    </button>
  )
}

export function DashboardPage() {
  const user = useAuthStore((s) => s.user)
  const today = new Date()
  const { entries, isLoading } = useDashboardLayout()
  const [expandedOverride, setExpandedOverride] = useState<Record<string, boolean>>({})

  const displayName = user ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email : ''

  const visible = entries
    .filter((entry) => entry.visible)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned))

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
            {visible.map(({ widget, collapsed }) => {
              const isCollapsed = collapsed && !expandedOverride[widget.id]
              return (
                <div key={widget.id} className={WIDGET_SIZE_CLASS[widget.size]}>
                  {isCollapsed ? (
                    <CollapsedWidgetRow label={widget.label} onExpand={() => setExpandedOverride((prev) => ({ ...prev, [widget.id]: true }))} />
                  ) : (
                    <div className="relative group">
                      {collapsed && (
                        <button
                          type="button"
                          aria-label={`Collapse ${widget.label}`}
                          onClick={() => setExpandedOverride((prev) => ({ ...prev, [widget.id]: false }))}
                          className="absolute top-2 right-2 z-10 p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <widget.component />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </PageContent>
    </PageLayout>
  )
}
