// src/modules/white-label/pages/WhiteLabelSettingsPage.tsx (PRD §4.3 — white-label)
import { PageLayout, PageHeader, PageContent } from '@/components/page'
import { Spinner, AlertBanner } from '@/components/feedback'
import { Can } from '@/components/common/Can'
import { PERMISSIONS } from '@/config/permissions.config'
import { normalizeApiError } from '@/services/api-error'
import { SettingsNav, SettingsSection } from '@/modules/settings/components'
import {
  useBrandingQuery,
  useUpdateBrandingMutation,
  useUploadBrandingAssetMutation,
  useDomainQuery,
  useCreateDomainMutation,
  useVerifyDomainMutation,
  useDeleteDomainMutation,
} from '../hooks'
import { BrandingForm, BrandingAssetUploader, DomainSection } from '../components'

export function WhiteLabelSettingsPage() {
  const brandingQuery = useBrandingQuery()
  const updateBrandingMutation = useUpdateBrandingMutation()
  const uploadAssetMutation = useUploadBrandingAssetMutation()

  const domainQuery = useDomainQuery()
  const createDomainMutation = useCreateDomainMutation()
  const verifyDomainMutation = useVerifyDomainMutation()
  const deleteDomainMutation = useDeleteDomainMutation()

  return (
    <PageLayout>
      <PageHeader title="White Label" description="Your firm's branding and a custom portal address (PRD §4.3)." />
      <PageContent>
        <div className="space-y-4">
          <SettingsNav />

          <SettingsSection title="Branding">
            {brandingQuery.isLoading ? (
              <Spinner fullScreen={false} label="Loading branding…" className="py-8" />
            ) : (
              <div className="space-y-5">
                {brandingQuery.isError && (
                  <AlertBanner
                    variant="warning"
                    message={`Couldn't load your current branding (${normalizeApiError(brandingQuery.error).message}).`}
                    action={
                      <button onClick={() => brandingQuery.refetch()} className="text-[11px] font-semibold text-[var(--color-warning-fg)] hover:underline shrink-0">
                        Try again
                      </button>
                    }
                  />
                )}

                <Can permission={PERMISSIONS.SETTINGS_MANAGE}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <BrandingAssetUploader
                      slot="logo"
                      label="Logo"
                      currentUrl={brandingQuery.data?.logoUrl}
                      onUpload={(file) => uploadAssetMutation.mutate({ slot: 'logo', file })}
                      isUploading={uploadAssetMutation.isPending}
                      canManage
                    />
                    <BrandingAssetUploader
                      slot="favicon"
                      label="Favicon"
                      currentUrl={brandingQuery.data?.faviconUrl}
                      onUpload={(file) => uploadAssetMutation.mutate({ slot: 'favicon', file })}
                      isUploading={uploadAssetMutation.isPending}
                      canManage
                    />
                  </div>
                </Can>

                <Can
                  permission={PERMISSIONS.SETTINGS_MANAGE}
                  fallback={<BrandingForm branding={brandingQuery.data} onSubmit={() => {}} canManage={false} />}
                >
                  <BrandingForm
                    branding={brandingQuery.data}
                    onSubmit={(payload) => updateBrandingMutation.mutate(payload)}
                    isSubmitting={updateBrandingMutation.isPending}
                    submitError={updateBrandingMutation.isError ? normalizeApiError(updateBrandingMutation.error).message : undefined}
                    canManage
                  />
                </Can>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="Custom Domain">
            {domainQuery.isLoading ? (
              <Spinner fullScreen={false} label="Loading domain settings…" className="py-8" />
            ) : (
              <>
                {domainQuery.isError && (
                  <AlertBanner
                    variant="warning"
                    message={`Couldn't load your current domain settings (${normalizeApiError(domainQuery.error).message}).`}
                    action={
                      <button onClick={() => domainQuery.refetch()} className="text-[11px] font-semibold text-[var(--color-warning-fg)] hover:underline shrink-0">
                        Try again
                      </button>
                    }
                  />
                )}
                <Can permission={PERMISSIONS.SETTINGS_MANAGE} fallback={<DomainSection domain={domainQuery.data} onCreate={() => {}} onVerify={() => {}} onDelete={() => {}} canManage={false} />}>
                  <DomainSection
                    domain={domainQuery.data}
                    onCreate={(payload) => createDomainMutation.mutate(payload)}
                    onVerify={() => verifyDomainMutation.mutate()}
                    onDelete={() => deleteDomainMutation.mutate()}
                    isCreating={createDomainMutation.isPending}
                    isVerifying={verifyDomainMutation.isPending}
                    isDeleting={deleteDomainMutation.isPending}
                    createError={createDomainMutation.isError ? normalizeApiError(createDomainMutation.error).message : undefined}
                    canManage
                  />
                </Can>
              </>
            )}
          </SettingsSection>
        </div>
      </PageContent>
    </PageLayout>
  )
}
