// src/modules/settings/pages/TeamSettingsPage.tsx
// getTeamSettings/updateTeamSettings always 501 (no backend module exists). Same reasoning as
// FirmSettingsPage: this is a single, firm-wide settings form, not a record Detail page - the
// form always renders (blank, since there's nothing to prefill with) with an inline warning
// banner when the load fails, rather than blocking the whole page behind an ErrorState.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Spinner, AlertBanner } from '@/components/feedback'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useTeamSettingsQuery, useUpdateTeamSettingsMutation } from '../hooks'
import { SettingsNav, SettingsSection, TeamSettingsForm } from '../components'
import type { UpdateTeamSettingsFormValues } from '../schemas'

export function TeamSettingsPage() {
  const { data, isLoading, isError, error, refetch } = useTeamSettingsQuery()
  const updateMutation = useUpdateTeamSettingsMutation()

  const handleSubmit = (values: UpdateTeamSettingsFormValues) => {
    updateMutation.mutate(values)
  }

  return (
    <PageLayout>
      <PageHeader title="Team Settings" description="Firm-wide preferences for staff and task defaults." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />

          <SettingsSection title="Team Preferences">
            {isLoading ? (
              <Spinner fullScreen={false} label="Loading team settings…" className="py-8" />
            ) : (
              <div className="space-y-4">
                {isError && (
                  <AlertBanner
                    variant="warning"
                    message={`Couldn't load your current team settings (${normalizeApiError(error).message}) - showing a blank form instead.`}
                    action={
                      <button onClick={() => refetch()} className="text-[11px] font-semibold text-[var(--color-warning-fg)] hover:underline shrink-0">
                        Try again
                      </button>
                    }
                  />
                )}
                <Can permission={PERMISSIONS.SETTINGS_MANAGE} fallback={<TeamSettingsForm teamSettings={data} onSubmit={handleSubmit} canManage={false} />}>
                  <TeamSettingsForm
                    teamSettings={data}
                    onSubmit={handleSubmit}
                    isSubmitting={updateMutation.isPending}
                    submitError={updateMutation.isError ? normalizeApiError(updateMutation.error).message : undefined}
                    canManage
                  />
                </Can>
              </div>
            )}
          </SettingsSection>
        </div>
      </PageContent>
    </PageLayout>
  )
}
