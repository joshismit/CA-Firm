// client-portal API request functions, built on the shared Axios instance from src/services/axios.ts.
//
// NOT YET AVAILABLE: the external client-facing portal (document sharing, e-signatures) has no
// backend module or routes yet (no /portal-facing routes are mounted - see backend/src/app.ts).
// Every function below is a typed placeholder - wire the real apiClient call once a client-portal
// backend module exists. No mock data, no guessed endpoint path beyond the plausible `/portal/...`
// base already implied by this app's own route naming (/portal, /portal/documents).

import type { ApiError } from '@/services/api-error'
import type { PaginatedResponse } from '@/types/api.types'
import type { ClientPortalSummary, SharedDocument, SharedDocumentListFilters } from '../types'

function notImplemented(action: string): never {
  throw {
    status: 501,
    code: 'NOT_IMPLEMENTED',
    message: `Client Portal API is not available yet (${action}).`,
  } satisfies ApiError
}

// TODO: GET /portal/summary
export async function getPortalSummary(): Promise<ClientPortalSummary> {
  return notImplemented('getPortalSummary')
}

// TODO: GET /portal/documents
export async function listSharedDocuments(_filters: SharedDocumentListFilters): Promise<PaginatedResponse<SharedDocument>> {
  return notImplemented('listSharedDocuments')
}
