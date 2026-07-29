// Compliance API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: no GST/ITR/TDS/MCA backend module exists (see types/index.ts's header comment
// for the full explanation). Every function below is a typed placeholder - wire the real
// apiClient call once each area's backend module exists. No mock data, no guessed endpoint path
// beyond the plausible, provisional `/${moduleKey}` base that already matches this app's sidebar
// route naming (/gst, /itr, /tds, /mca) - not a confirmed contract.
import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type {
  ComplianceFiling,
  ComplianceFilingListFilters,
  ComplianceModuleKey,
  CreateComplianceFilingPayload,
  UpdateComplianceFilingPayload,
} from '../types'
import { COMPLIANCE_MODULES } from '../constants'

function notImplemented(moduleKey: ComplianceModuleKey, action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `${COMPLIANCE_MODULES[moduleKey].label} API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /${moduleKey}
export async function listComplianceFilings(
  moduleKey: ComplianceModuleKey,
  _filters: ComplianceFilingListFilters
): Promise<PaginatedResponse<ComplianceFiling>> {
  return notImplemented(moduleKey, 'listComplianceFilings')
}

// TODO: GET /${moduleKey}/:id
export async function getComplianceFiling(moduleKey: ComplianceModuleKey, _id: string): Promise<ComplianceFiling> {
  return notImplemented(moduleKey, 'getComplianceFiling')
}

// TODO: POST /${moduleKey}
export async function createComplianceFiling(
  moduleKey: ComplianceModuleKey,
  _payload: CreateComplianceFilingPayload
): Promise<ComplianceFiling> {
  return notImplemented(moduleKey, 'createComplianceFiling')
}

// TODO: PATCH /${moduleKey}/:id
export async function updateComplianceFiling(
  moduleKey: ComplianceModuleKey,
  _id: string,
  _payload: UpdateComplianceFilingPayload
): Promise<ComplianceFiling> {
  return notImplemented(moduleKey, 'updateComplianceFiling')
}

// TODO: DELETE /${moduleKey}/:id
export async function deleteComplianceFiling(moduleKey: ComplianceModuleKey, _id: string): Promise<void> {
  return notImplemented(moduleKey, 'deleteComplianceFiling')
}
