// src/modules/settings/pages/DashboardDefaultsSettingsPage.tsx
// PRD §10.3 - tenant-admin-only configuration of the default dashboard layout new users of a
// given coarse role land on (until they save their own personal layout, which always wins - see
// DashboardPreferenceService.getPreferences()'s fallback chain on the backend). Gated to
// TENANT_ADMIN client-side (mirrors the backend's own requireRole(TENANT_ADMIN) gate on
// GET/PUT/DELETE /dashboard/tenant-defaults) - MANAGER/CLIENT tabs are shown but marked
// "not currently assignable" because AuthService.resolveRole() on the backend only ever assigns
// TENANT_ADMIN or STAFF today (see that method's own header comment) - configuring a default for
// a role nobody can hold yet is harmless but honestly labeled, not hidden outright, so it's ready
// once that gap closes.
import { useEffect, useState } from 'react'
import { ChevronDown, ChevronUp, Save } from 'lucide-react'
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Spinner, AlertBanner } from '@/components/feedback'
import { Tabs } from '@/components/shared/Tabs/Tabs'
import { normalizeApiError } from '@/services/api-error'
import { useAuthStore } from '@/store/auth.store'
import { WIDGET_REGISTRY } from '@/modules/dashboard/constants'
import {
  useDashboardTenantDefaultsQuery,
  useUpdateDashboardTenantDefaultMutation,
  useDeleteDashboardTenantDefaultMutation,
} from '@/modules/dashboard/hooks'
import type { WidgetPreference } from '@/modules/dashboard/types'
import { SettingsNav, SettingsSection } from '../components'

const ROLE_TABS = [
  { value: 'TENANT_ADMIN', label: 'Administrator' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'MANAGER', label: 'Manager (not yet assignable)' },
  { value: 'CLIENT', label: 'Client (not yet assignable)' },
]

function moveEntry(widgets: WidgetPreference[], index: number, direction: -1 | 1): WidgetPreference[] {
  const target = index + direction
  if (target < 0 || target >= widgets.length) return widgets
  const next = [...widgets]
  ;[next[index], next[target]] = [next[target], next[index]]
  return next
}

export function DashboardDefaultsSettingsPage() {
  const user = useAuthStore((s) => s.user)
  const isTenantAdmin = user?.role === 'TENANT_ADMIN'
  const { data: defaults, isLoading, isError, error } = useDashboardTenantDefaultsQuery(isTenantAdmin)
  const updateMutation = useUpdateDashboardTenantDefaultMutation()
  const deleteMutation = useDeleteDashboardTenantDefaultMutation()

  const [role, setRole] = useState('TENANT_ADMIN')
  const [draft, setDraft] = useState<WidgetPreference[]>([])

  const configured = defaults?.find((d) => d.role === role)

  // Re-seeds the draft whenever the selected role's saved default changes (role switch, or a
  // successful save/reset) - not on every background refetch.
  useEffect(() => {
    if (configured && configured.widgets.length > 0) {
      setDraft(configured.widgets)
    } else {
      setDraft(WIDGET_REGISTRY.map((w) => ({ widgetId: w.id, visible: true })))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, defaults])

  if (user?.role !== 'TENANT_ADMIN') {
    return (
      <PageLayout>
        <PageHeader title="Dashboard Defaults" description="Only firm administrators can configure default dashboard layouts." />
        <PageContent>
          <AlertBanner variant="warning" message="You don't have permission to view this page." />
        </PageContent>
      </PageLayout>
    )
  }

  function handleSave() {
    updateMutation.mutate({ role, widgets: draft })
  }

  function handleResetToRegistry() {
    deleteMutation.mutate(role)
  }

  return (
    <PageLayout>
      <PageHeader title="Dashboard Defaults" description="Configure the default widget layout new users of each role land on. A user's own saved layout always takes priority over this." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />
          <SettingsSection title="Default Layout by Role">
            <Tabs tabs={ROLE_TABS} value={role} onChange={setRole} className="mb-4" />

            {isLoading ? (
              <Spinner fullScreen={false} label="Loading dashboard defaults…" className="py-8" />
            ) : (
              <div className="space-y-4">
                {isError && (
                  <AlertBanner variant="warning" message={`Couldn't load dashboard defaults (${normalizeApiError(error).message}).`} />
                )}

                <p className="text-[12px] text-[var(--color-text-muted)]">
                  {configured && configured.widgets.length > 0
                    ? `Configured — last updated ${configured.updatedAt ? new Date(configured.updatedAt).toLocaleString('en-IN') : 'recently'}.`
                    : 'Not configured yet — new users of this role currently see every widget, in registry order.'}
                </p>

                <ul className="space-y-1.5">
                  {draft.map((pref, index) => {
                    const widget = WIDGET_REGISTRY.find((w) => w.id === pref.widgetId)
                    if (!widget) return null
                    return (
                      <li
                        key={pref.widgetId}
                        className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-medium text-[var(--color-text-body)] truncate">{widget.label}</p>
                          <p className="text-[11px] text-[var(--color-text-muted)] truncate">{widget.description}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            aria-label={`Move ${widget.label} up`}
                            disabled={index === 0}
                            onClick={() => setDraft((prev) => moveEntry(prev, index, -1))}
                            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Move ${widget.label} down`}
                            disabled={index === draft.length - 1}
                            onClick={() => setDraft((prev) => moveEntry(prev, index, 1))}
                            className="p-1 rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <Switch
                            checked={pref.visible}
                            onCheckedChange={(visible) =>
                              setDraft((prev) => prev.map((p, i) => (i === index ? { ...p, visible } : p)))
                            }
                            aria-label={`Show ${widget.label} by default`}
                          />
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {(updateMutation.isError || deleteMutation.isError) && (
                  <AlertBanner
                    variant="danger"
                    message={normalizeApiError((updateMutation.error ?? deleteMutation.error)!).message}
                  />
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="secondary" onClick={handleResetToRegistry} loading={deleteMutation.isPending} disabled={updateMutation.isPending}>
                    Clear (use registry default)
                  </Button>
                  <Button leadingIcon={<Save className="w-3.5 h-3.5" />} onClick={handleSave} loading={updateMutation.isPending} disabled={deleteMutation.isPending}>
                    Save Default for {ROLE_TABS.find((t) => t.value === role)?.label}
                  </Button>
                </div>
              </div>
            )}
          </SettingsSection>
        </div>
      </PageContent>
    </PageLayout>
  )
}
