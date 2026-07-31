// white-label-scoped React hooks - data-fetching wrappers (TanStack Query).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  getBranding,
  updateBranding,
  uploadBrandingAsset,
  getDomain,
  createDomain,
  verifyDomain,
  deleteDomain,
  resolvePublicBranding,
} from '../api'
import type { UpdateTenantBrandingPayload, BrandingAssetSlot, CreateTenantDomainPayload } from '../types'

export function useBrandingQuery() {
  return useQuery({ queryKey: queryKeys.whiteLabel.branding, queryFn: getBranding })
}

export function useUpdateBrandingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTenantBrandingPayload) => updateBranding(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.whiteLabel.branding }),
  })
}

export function useUploadBrandingAssetMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ slot, file }: { slot: BrandingAssetSlot; file: File }) => uploadBrandingAsset(slot, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.whiteLabel.branding }),
  })
}

export function useDomainQuery() {
  return useQuery({ queryKey: queryKeys.whiteLabel.domain, queryFn: getDomain })
}

export function useCreateDomainMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTenantDomainPayload) => createDomain(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.whiteLabel.domain }),
  })
}

export function useVerifyDomainMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => verifyDomain(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.whiteLabel.domain }),
  })
}

export function useDeleteDomainMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => deleteDomain(),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.whiteLabel.domain }),
  })
}

/** `enabled: !!host` - `AuthLayout` doesn't know the hostname until after mount (`window.location.hostname`). `retry: false` - a hostname with no matching tenant isn't a transient failure. */
export function usePublicBrandingQuery(host: string | undefined) {
  return useQuery({
    queryKey: queryKeys.whiteLabel.publicBranding(host ?? ''),
    queryFn: () => resolvePublicBranding(host as string),
    enabled: !!host,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })
}
