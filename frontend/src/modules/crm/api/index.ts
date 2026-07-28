// crm API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: backend/src/modules has no `crm` module. Every function below is a typed
// placeholder - wire the real apiClient call once the backend implements it. No mock data, no
// guessed endpoint path.

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type {
  ConvertLeadPayload,
  CreateLeadPayload,
  Lead,
  LeadListFilters,
  LeadStage,
  UpdateLeadPayload,
} from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `CRM API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /api/v1/crm/leads
export async function listLeads(_filters: LeadListFilters): Promise<PaginatedResponse<Lead>> {
  return notImplemented('listLeads')
}

// TODO: GET /api/v1/crm/leads/:id
export async function getLead(_id: string): Promise<Lead> {
  return notImplemented('getLead')
}

// TODO: GET /api/v1/crm/lead-stages
export async function listLeadStages(): Promise<LeadStage[]> {
  return notImplemented('listLeadStages')
}

// TODO: POST /api/v1/crm/leads
export async function createLead(_payload: CreateLeadPayload): Promise<Lead> {
  return notImplemented('createLead')
}

// TODO: PATCH /api/v1/crm/leads/:id
export async function updateLead(_id: string, _payload: UpdateLeadPayload): Promise<Lead> {
  return notImplemented('updateLead')
}

// TODO: POST /api/v1/crm/leads/:id/convert
export async function convertLead(_payload: ConvertLeadPayload): Promise<Lead> {
  return notImplemented('convertLead')
}
