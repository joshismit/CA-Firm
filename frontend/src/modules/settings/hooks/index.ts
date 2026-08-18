// settings-scoped React hooks - data-fetching wrappers (TanStack Query) and local UI state.
// retry: false everywhere - a 501 NOT_IMPLEMENTED will never succeed on retry (same convention as
// modules/compliance, modules/client-billing, modules/notifications, modules/reports, modules/audit).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/services/query-keys'
import {
  connectIntegration,
  disconnectIntegration,
  getFirmSettings,
  getStorageSettings,
  getTeamSettings,
  listIntegrations,
  updateFirmSettings,
  updateStorageSettings,
  updateTeamSettings,
} from '../api'
import type { IntegrationProvider, UpdateFirmSettingsPayload, UpdateStorageSettingsPayload, UpdateTeamSettingsPayload } from '../types'

export function useFirmSettingsQuery() {
  return useQuery({ queryKey: queryKeys.settings.firm, queryFn: getFirmSettings, retry: false })
}

export function useUpdateFirmSettingsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateFirmSettingsPayload) => updateFirmSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.firm }),
  })
}

export function useTeamSettingsQuery() {
  return useQuery({ queryKey: queryKeys.settings.team, queryFn: getTeamSettings, retry: false })
}

export function useUpdateTeamSettingsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateTeamSettingsPayload) => updateTeamSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.team }),
  })
}

export function useIntegrationsQuery() {
  return useQuery({ queryKey: queryKeys.settings.integrations, queryFn: listIntegrations, retry: false })
}

export function useConnectIntegrationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: IntegrationProvider) => connectIntegration(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.integrations }),
  })
}

export function useDisconnectIntegrationMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (provider: IntegrationProvider) => disconnectIntegration(provider),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.integrations }),
  })
}

// PRD §7.4 — real endpoint, unlike every hook above (no `retry: false` — a transient network
// failure here is worth a normal retry, same as any other real query in the app).
export function useStorageSettingsQuery() {
  return useQuery({ queryKey: queryKeys.settings.storage, queryFn: getStorageSettings })
}

export function useUpdateStorageSettingsMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateStorageSettingsPayload) => updateStorageSettings(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.settings.storage }),
  })
}
