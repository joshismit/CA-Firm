// settings API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: no backend module exists for firm-wide settings (see types/index.ts's header
// comment). Every function below is a typed placeholder that throws a real 501 NOT_IMPLEMENTED
// ApiError - mirrors the exact pattern already established in modules/compliance,
// modules/client-billing, modules/notifications, modules/reports, and modules/audit. No mock
// data, no guessed endpoint path beyond the plausible, provisional `/settings/*` base that matches
// this app's route naming. Never returns a fabricated successful response.
import type { ApiError } from '@/services/api-error'
import type {
  FirmSettings,
  IntegrationConnection,
  IntegrationProvider,
  TeamSettings,
  UpdateFirmSettingsPayload,
  UpdateTeamSettingsPayload,
} from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Settings API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /settings/firm
export async function getFirmSettings(): Promise<FirmSettings> {
  return notImplemented('getFirmSettings')
}

// TODO: PATCH /settings/firm
export async function updateFirmSettings(_payload: UpdateFirmSettingsPayload): Promise<FirmSettings> {
  return notImplemented('updateFirmSettings')
}

// TODO: GET /settings/team
export async function getTeamSettings(): Promise<TeamSettings> {
  return notImplemented('getTeamSettings')
}

// TODO: PATCH /settings/team
export async function updateTeamSettings(_payload: UpdateTeamSettingsPayload): Promise<TeamSettings> {
  return notImplemented('updateTeamSettings')
}

// TODO: GET /settings/integrations
export async function listIntegrations(): Promise<IntegrationConnection[]> {
  return notImplemented('listIntegrations')
}

// TODO: POST /settings/integrations/:provider/connect
export async function connectIntegration(_provider: IntegrationProvider): Promise<IntegrationConnection> {
  return notImplemented('connectIntegration')
}

// TODO: POST /settings/integrations/:provider/disconnect
export async function disconnectIntegration(_provider: IntegrationProvider): Promise<void> {
  return notImplemented('disconnectIntegration')
}
