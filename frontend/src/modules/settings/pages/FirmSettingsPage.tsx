// src/modules/settings/pages/FirmSettingsPage.tsx
// getFirmSettings/updateFirmSettings always 501 (no backend module exists). Unlike a Detail page
// for a specific record (which has nothing to show at all without a fetch), this is a single,
// firm-wide settings form - blocking the whole page behind an ErrorState would leave it
// permanently dead. Instead the form always renders (blank, since there's nothing to prefill with)
// with an inline warning banner when the load fails, so the page stays genuinely navigable and
// submitting still surfaces the real "not available yet" error rather than pretending to save.
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Spinner, AlertBanner } from '@/components/feedback'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { useFirmSettingsQuery, useUpdateFirmSettingsMutation } from '../hooks'
import { SettingsNav, SettingsSection, FirmSettingsForm } from '../components'
import type { UpdateFirmSettingsFormValues } from '../schemas'

export function FirmSettingsPage() {
  const { data, isLoading, isError, error, refetch } = useFirmSettingsQuery()
  const updateMutation = useUpdateFirmSettingsMutation()

  const handleSubmit = (values: UpdateFirmSettingsFormValues) => {
    updateMutation.mutate({
      name: values.name,
      legalName: values.legalName || undefined,
      gstin: values.gstin || undefined,
      pan: values.pan || undefined,
      addressLine1: values.addressLine1 || undefined,
      city: values.city || undefined,
      state: values.state || undefined,
      pincode: values.pincode || undefined,
      phone: values.phone || undefined,
      email: values.email || undefined,
      website: values.website || undefined,
    })
  }

  return (
    <PageLayout>
      <PageHeader title="Firm Settings" description="Your firm's company profile." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />

          <SettingsSection title="Company Profile">
            {isLoading ? (
              <Spinner fullScreen={false} label="Loading firm settings…" className="py-8" />
            ) : (
              <div className="space-y-4">
                {isError && (
                  <AlertBanner
                    variant="warning"
                    message={`Couldn't load your current firm settings (${normalizeApiError(error).message}) - showing a blank form instead.`}
                    action={
                      <button onClick={() => refetch()} className="text-[11px] font-semibold text-[var(--color-warning-fg)] hover:underline shrink-0">
                        Try again
                      </button>
                    }
                  />
                )}
                <Can permission={PERMISSIONS.SETTINGS_MANAGE} fallback={<FirmSettingsForm firmSettings={data} onSubmit={handleSubmit} canManage={false} />}>
                  <FirmSettingsForm
                    firmSettings={data}
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
